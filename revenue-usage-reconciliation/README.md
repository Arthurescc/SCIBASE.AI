# Revenue Usage Reconciliation

This module adds a focused revenue-ops validation layer for SCIBASE revenue infrastructure.
It reconciles plan entitlements, compute usage, top-ups, invoice totals, and anonymized analytics licensing exports so reviewers can catch undercharges, overcharges, refund risk, and unsafe licensing exports before closing a billing cycle.

It is intentionally dependency-free and can be run with stock Node.js.

## What It Covers

- Tiered plan quotas and included subscription charges.
- AI compute usage meters by capability.
- Top-up credit reconciliation before overage calculation.
- Invoice comparison against expected charges.
- Undercharge and overcharge anomaly detection.
- Anonymized licensing export safety checks.
- Revenue health reports with high-risk account lists and audit hashes.
- Entitlement regression matrix for month-over-month review.

## Demo

```bash
npm run demo
```

The demo prints a report with one clean lab account, one undercharged institutional account, and one unsafe licensing export.
Text-only demo evidence is included in `docs/demo-transcript.md` for reviewers who prefer not to inspect the GIF.

## Verification

```bash
npm run check
npm test
npm run demo
```

## Files

- `src/reconciliation.js` - core reconciliation, anomaly, health report, and regression logic.
- `test/reconciliation.test.js` - focused tests for clean billing, undercharges, licensing risk, aggregation, and regressions.
- `scripts/demo.js` - CLI demo with sample subscription, usage, invoice, and licensing data.
- `docs/issue-20-requirement-map.md` - mapping from issue requirements to implementation evidence.
- `docs/demo-transcript.md` - text-only reviewer evidence for the demo scenario.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified before submission.
