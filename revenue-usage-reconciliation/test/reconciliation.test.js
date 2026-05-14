"use strict";

const assert = require("assert");
const {
  reconcileAccount,
  buildRevenueHealthReport,
  buildEntitlementRegressionMatrix
} = require("../src/reconciliation");

function cleanAccount() {
  return {
    id: "lab-clean",
    plan: { name: "Lab Pro", monthlyQuotaUnits: 100, includedCents: 10000, overageCentsPerUnit: 25 },
    topUps: [{ units: 50 }],
    usageEvents: [
      { capability: "ai-review", units: 125 },
      { capability: "literature-scan", units: 25 }
    ],
    invoices: [{ amountCents: 10000 }],
    licensingExports: [{ id: "lic-1", dataset: "topic-trends", anonymized: true, fields: ["topic", "score"] }]
  };
}

function testCleanAccountHasNoAnomalies() {
  const result = reconcileAccount(cleanAccount());
  assert.strictEqual(result.expected.expectedCents, 10000);
  assert.strictEqual(result.deltaCents, 0);
  assert.deepStrictEqual(result.anomalies, []);
}

function testUnderchargeDetectedForOverQuotaUsage() {
  const account = cleanAccount();
  account.usageEvents.push({ capability: "reproducibility-run", units: 20 });
  const result = reconcileAccount(account);
  assert.strictEqual(result.expected.overageUnits, 20);
  assert.strictEqual(result.anomalies[0].type, "undercharge");
  assert.strictEqual(result.anomalies[0].amountCents, 500);
}

function testOverchargeDetectedForRefundRisk() {
  const account = cleanAccount();
  account.invoices = [{ amountCents: 11250 }];
  const result = reconcileAccount(account);
  assert.strictEqual(result.deltaCents, 1250);
  assert.strictEqual(result.anomalies[0].type, "overcharge");
  assert.strictEqual(result.anomalies[0].amountCents, 1250);
}

function testLicensingExportRiskDetected() {
  const account = cleanAccount();
  account.licensingExports = [{ id: "lic-risk", dataset: "grant-map", anonymized: false, fields: ["orcid", "raw_email"] }];
  const result = reconcileAccount(account);
  assert.strictEqual(result.anomalies[0].type, "licensing-export-risk");
  assert.strictEqual(result.licensing[0].safeForLicensing, false);
}

function testRevenueHealthReportAggregatesRisk() {
  const risky = cleanAccount();
  risky.id = "risky";
  risky.invoices = [{ amountCents: 20000 }];
  const report = buildRevenueHealthReport([cleanAccount(), risky]);
  assert.strictEqual(report.status, "needs-revenue-ops-review");
  assert.strictEqual(report.totals.anomalyCount, 1);
  assert.deepStrictEqual(report.highRiskAccounts, ["risky"]);
  assert.ok(report.auditHash.length >= 32);
}

function testEntitlementRegressionMatrixFlagsNewReviewState() {
  const previous = buildRevenueHealthReport([cleanAccount()]);
  const currentAccount = cleanAccount();
  currentAccount.invoices = [{ amountCents: 8000 }];
  const current = buildRevenueHealthReport([currentAccount]);
  const matrix = buildEntitlementRegressionMatrix(previous, current);
  assert.strictEqual(matrix[0].previousStatus, "clean");
  assert.strictEqual(matrix[0].currentStatus, "review");
  assert.strictEqual(matrix[0].regressed, true);
}

function testEntitlementRegressionMatrixMarksNewAccounts() {
  const previous = buildRevenueHealthReport([]);
  const current = buildRevenueHealthReport([cleanAccount()]);
  const matrix = buildEntitlementRegressionMatrix(previous, current);
  assert.strictEqual(matrix[0].previousStatus, "new-account");
  assert.strictEqual(matrix[0].currentStatus, "clean");
}

const tests = [
  testCleanAccountHasNoAnomalies,
  testUnderchargeDetectedForOverQuotaUsage,
  testOverchargeDetectedForRefundRisk,
  testLicensingExportRiskDetected,
  testRevenueHealthReportAggregatesRisk,
  testEntitlementRegressionMatrixFlagsNewReviewState,
  testEntitlementRegressionMatrixMarksNewAccounts
];

for (const test of tests) {
  test();
}

console.log(`${tests.length} revenue reconciliation tests passed`);
