# Offline Collaboration Conflict Resolver

This module implements a focused sync layer for the SCIBASE real-time collaborative research editor bounty. It handles the tricky part that appears when researchers edit scientific manuscripts offline and later reconnect:
deterministic operation replay, section-lock conflict detection, suggestion/comment merge safety, audit reports, and restore-ready snapshots.

It is intentionally dependency-free so reviewers can run it with stock Node.js.

## What It Covers

- Client-side offline operation queues with actor and block metadata.
- Rebase of offline edits on top of server operations.
- Section lock checks so protected manuscript areas are not overwritten.
- Safe inline comment and suggestion merging.
- Idempotent operation replay so retried offline operations do not apply twice.
- Stale version and missing suggestion conflict reporting.
- Restore-ready snapshots with content hashes.
- Reviewer-facing audit reports with stable audit hashes and duplicate replay counts.

## Demo

```bash
npm run demo
```

The demo prints a sync report where an abstract edit is applied, a locked methods edit is blocked for manual review, and a review suggestion is safely accepted.

Demo artifacts: `docs/demo.gif` and `docs/demo.svg`.

## Verification

```bash
npm run check
npm test
npm run demo
```

## Files

- `src/conflict-resolver.js` - core queue, rebase, snapshot, and report logic.
- `test/conflict-resolver.test.js` - focused tests for rebase, locks, suggestions, duplicate replay, and snapshots.
- `scripts/demo.js` - CLI demo with sample scientific manuscript blocks.
- `docs/issue-12-requirement-map.md` - mapping from issue requirements to implementation evidence.

## AI-Assisted Disclosure

This contribution was produced with AI assistance and manually verified before submission.
