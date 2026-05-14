"use strict";

const crypto = require("crypto");

function money(cents) {
  return Math.round(cents);
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeAccount(account) {
  if (!account || !account.id || !account.plan) {
    throw new Error("account requires id and plan");
  }

  return {
    id: account.id,
    plan: {
      name: account.plan.name,
      monthlyQuotaUnits: account.plan.monthlyQuotaUnits || 0,
      includedCents: money(account.plan.includedCents || 0),
      overageCentsPerUnit: money(account.plan.overageCentsPerUnit || 0)
    },
    topUps: Array.isArray(account.topUps) ? account.topUps : [],
    invoices: Array.isArray(account.invoices) ? account.invoices : [],
    usageEvents: Array.isArray(account.usageEvents) ? account.usageEvents : [],
    licensingExports: Array.isArray(account.licensingExports) ? account.licensingExports : []
  };
}

function summarizeUsage(usageEvents) {
  return usageEvents.reduce((summary, event) => {
    const units = Number(event.units || 0);
    summary.totalUnits += units;
    summary.byCapability[event.capability] = (summary.byCapability[event.capability] || 0) + units;
    if (event.billable === false) {
      summary.nonBillableUnits += units;
    }
    return summary;
  }, {
    totalUnits: 0,
    nonBillableUnits: 0,
    byCapability: {}
  });
}

function summarizeCredits(topUps) {
  return topUps.reduce((total, topUp) => total + Number(topUp.units || 0), 0);
}

function expectedChargeCents(account, usageSummary) {
  const includedUnits = account.plan.monthlyQuotaUnits + summarizeCredits(account.topUps);
  const billableUnits = Math.max(0, usageSummary.totalUnits - usageSummary.nonBillableUnits);
  const overageUnits = Math.max(0, billableUnits - includedUnits);
  return {
    includedUnits,
    billableUnits,
    overageUnits,
    expectedCents: money(account.plan.includedCents + (overageUnits * account.plan.overageCentsPerUnit))
  };
}

function actualInvoiceCents(invoices) {
  return money(invoices.reduce((total, invoice) => total + Number(invoice.amountCents || 0), 0));
}

function inspectLicensingExports(exports) {
  return exports.map((item) => {
    const fields = Array.isArray(item.fields) ? item.fields : [];
    const privateFields = fields.filter((field) => /email|name|orcid|private|raw/i.test(field));
    return {
      id: item.id,
      dataset: item.dataset,
      anonymized: item.anonymized === true,
      privateFields,
      safeForLicensing: item.anonymized === true && privateFields.length === 0
    };
  });
}

function reconcileAccount(accountInput) {
  const account = normalizeAccount(accountInput);
  const usageSummary = summarizeUsage(account.usageEvents);
  const expected = expectedChargeCents(account, usageSummary);
  const actualCents = actualInvoiceCents(account.invoices);
  const deltaCents = money(actualCents - expected.expectedCents);
  const licensing = inspectLicensingExports(account.licensingExports);
  const anomalies = [];

  if (deltaCents < 0) {
    anomalies.push({
      type: "undercharge",
      severity: Math.abs(deltaCents) > 5000 ? "high" : "medium",
      amountCents: Math.abs(deltaCents),
      message: "Invoice total is lower than expected entitlement and overage charge."
    });
  }

  if (deltaCents > 0) {
    anomalies.push({
      type: "overcharge",
      severity: deltaCents > 5000 ? "high" : "medium",
      amountCents: deltaCents,
      message: "Invoice total is higher than expected entitlement and overage charge."
    });
  }

  for (const exportCheck of licensing) {
    if (!exportCheck.safeForLicensing) {
      anomalies.push({
        type: "licensing-export-risk",
        severity: "high",
        exportId: exportCheck.id,
        message: "Licensing export is not safely anonymized for institutional analytics."
      });
    }
  }

  return {
    accountId: account.id,
    planName: account.plan.name,
    usageSummary,
    expected,
    actualCents,
    deltaCents,
    licensing,
    anomalies
  };
}

function buildRevenueHealthReport(accounts) {
  const reconciliations = accounts.map(reconcileAccount);
  const totals = reconciliations.reduce((summary, item) => {
    summary.expectedCents += item.expected.expectedCents;
    summary.actualCents += item.actualCents;
    summary.deltaCents += item.deltaCents;
    summary.anomalyCount += item.anomalies.length;
    return summary;
  }, {
    expectedCents: 0,
    actualCents: 0,
    deltaCents: 0,
    anomalyCount: 0
  });

  const highRiskAccounts = reconciliations
    .filter((item) => item.anomalies.some((anomaly) => anomaly.severity === "high"))
    .map((item) => item.accountId);

  return {
    status: totals.anomalyCount === 0 ? "ready-for-close" : "needs-revenue-ops-review",
    totals,
    highRiskAccounts,
    reconciliations,
    auditHash: hashPayload(reconciliations)
  };
}

function buildEntitlementRegressionMatrix(previousReport, currentReport) {
  const previousByAccount = new Map(previousReport.reconciliations.map((item) => [item.accountId, item]));
  return currentReport.reconciliations.map((current) => {
    const previous = previousByAccount.get(current.accountId);
    const previousStatus = previous
      ? (previous.anomalies.length === 0 ? "clean" : "review")
      : "new-account";
    const currentStatus = current.anomalies.length === 0 ? "clean" : "review";
    return {
      accountId: current.accountId,
      previousStatus,
      currentStatus,
      regressed: previousStatus === "clean" && currentStatus === "review",
      deltaCents: current.deltaCents - (previous ? previous.deltaCents : 0)
    };
  });
}

module.exports = {
  normalizeAccount,
  summarizeUsage,
  reconcileAccount,
  buildRevenueHealthReport,
  buildEntitlementRegressionMatrix
};
