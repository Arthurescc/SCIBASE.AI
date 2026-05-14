# Issue #20 Requirement Map

This module is a focused revenue operations slice for the SCIBASE revenue infrastructure bounty. It is not another payment provider mock; it verifies whether usage, entitlements, invoices, top-ups, and analytics licensing exports reconcile cleanly before the month is closed.

| Issue #20 requirement | Implementation evidence |
| --- | --- |
| Tiered subscription billing | `normalizeAccount` models plan name, included quota, included price, and overage rate. |
| Volume/top-up support | `expectedChargeCents` includes top-up credits before calculating overage units. |
| AI compute usage billing | `summarizeUsage` aggregates billable and non-billable usage by capability. |
| Transparent quotas and usage meters | `reconcileAccount` reports included units, billable units, overage units, expected charge, actual charge, and delta. |
| Institutional invoicing | Invoice totals are compared against expected entitlement and usage charges. |
| Licensing APIs and analytics | `inspectLicensingExports` checks that analytics exports are anonymized and do not expose private fields. |
| Revenue health reporting | `buildRevenueHealthReport` summarizes total expected/actual revenue, anomaly counts, high-risk accounts, and an audit hash. |
| Regression evidence | `buildEntitlementRegressionMatrix` flags accounts that moved from clean to review-required between billing runs. |

## Reviewer Notes

- Dependency-free Node.js implementation for easy review.
- Designed as a revenue-ops validation layer that can sit beside existing billing or entitlement engines.
- Demo output includes one clean lab account, one undercharged institution, and one unsafe analytics export.
