# Revenue Usage Reconciliation Demo Transcript

This transcript gives reviewers a text-only demo artifact for issue #20 in addition to the GIF.

## Command

```bash
npm run demo
```

## Expected Highlights

- Report status is `needs-revenue-ops-review`.
- Total expected revenue is `313000` cents.
- Total actual invoice revenue is `309800` cents.
- Delta is `-3200` cents.
- Two anomalies are reported.
- `institute-undercharged` is flagged for a medium-severity undercharge.
- `agency-export-risk` is flagged for a high-severity unsafe licensing export.
- The regression matrix keeps `lab-clean` clean and marks new risky accounts as review-required.

## Reviewer Value

The demo proves this module can catch revenue leakage, refund-risk style billing mismatches, and unsafe analytics licensing exports before a billing cycle is closed.
