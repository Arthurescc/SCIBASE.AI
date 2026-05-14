"use strict";

const {
  buildRevenueHealthReport,
  buildEntitlementRegressionMatrix
} = require("../src/reconciliation");

const previousAccounts = [
  {
    id: "lab-clean",
    plan: { name: "Lab Pro", monthlyQuotaUnits: 1000, includedCents: 9900, overageCentsPerUnit: 12 },
    topUps: [{ id: "top-1", units: 200 }],
    usageEvents: [{ capability: "ai-review", units: 900 }],
    invoices: [{ id: "inv-1", amountCents: 9900 }],
    licensingExports: [{ id: "lic-1", dataset: "topic-trends", anonymized: true, fields: ["topic", "score"] }]
  }
];

const currentAccounts = [
  {
    id: "lab-clean",
    plan: { name: "Lab Pro", monthlyQuotaUnits: 1000, includedCents: 9900, overageCentsPerUnit: 12 },
    topUps: [{ id: "top-1", units: 200 }],
    usageEvents: [{ capability: "ai-review", units: 900 }],
    invoices: [{ id: "inv-1", amountCents: 9900 }],
    licensingExports: [{ id: "lic-1", dataset: "topic-trends", anonymized: true, fields: ["topic", "score"] }]
  },
  {
    id: "institute-undercharged",
    plan: { name: "Institution", monthlyQuotaUnits: 5000, includedCents: 49900, overageCentsPerUnit: 8 },
    topUps: [],
    usageEvents: [
      { capability: "reproducibility-run", units: 5400 },
      { capability: "literature-scan", units: 200, billable: false }
    ],
    invoices: [{ id: "inv-2", amountCents: 49900 }],
    licensingExports: [{ id: "lic-2", dataset: "reuse-map", anonymized: true, fields: ["topic", "method", "score"] }]
  },
  {
    id: "agency-export-risk",
    plan: { name: "Analytics License", monthlyQuotaUnits: 0, includedCents: 250000, overageCentsPerUnit: 0 },
    topUps: [],
    usageEvents: [],
    invoices: [{ id: "inv-3", amountCents: 250000 }],
    licensingExports: [{ id: "lic-3", dataset: "grant-impact", anonymized: false, fields: ["topic", "orcid", "raw_email"] }]
  }
];

const previous = buildRevenueHealthReport(previousAccounts);
const current = buildRevenueHealthReport(currentAccounts);
const regression = buildEntitlementRegressionMatrix(previous, current);

console.log(JSON.stringify({
  report: {
    status: current.status,
    totals: current.totals,
    highRiskAccounts: current.highRiskAccounts,
    auditHash: current.auditHash
  },
  regression,
  anomalies: current.reconciliations.flatMap((account) =>
    account.anomalies.map((anomaly) => ({
      accountId: account.accountId,
      type: anomaly.type,
      severity: anomaly.severity,
      amountCents: anomaly.amountCents || 0
    }))
  )
}, null, 2));
