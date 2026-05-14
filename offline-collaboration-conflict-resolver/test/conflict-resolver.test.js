"use strict";

const assert = require("assert");
const {
  queueOfflineOperation,
  rebaseOfflineQueue,
  buildConflictReport,
  createSnapshot
} = require("../src/conflict-resolver");

function fixture() {
  return {
    id: "doc-1",
    baseRevision: "rev-1",
    locks: [{ sectionId: "locked", ownerId: "editor-b", status: "active" }],
    blocks: [
      {
        id: "intro",
        sectionId: "body",
        type: "markdown",
        content: "Initial claim.",
        citations: [],
        version: 1
      },
      {
        id: "locked-block",
        sectionId: "locked",
        type: "markdown",
        content: "Final figure caption.",
        citations: [],
        version: 1
      },
      {
        id: "review",
        sectionId: "review",
        type: "markdown",
        content: "Review note.",
        suggestions: [{ id: "s1", status: "open", text: "Add limitation." }],
        version: 1
      }
    ]
  };
}

function testRebasesOfflineUpdateAfterServerChange() {
  let queue = [];
  queue = queueOfflineOperation(queue, {
    id: "offline-intro",
    actorId: "editor-a",
    blockId: "intro",
    expectedVersion: 1,
    content: "Initial claim with replication package.",
    citations: ["doi:10.5555/repro"]
  });

  const result = rebaseOfflineQueue(fixture(), [
    {
      id: "server-intro",
      actorId: "editor-b",
      kind: "update-block",
      blockId: "intro",
      content: "Initial claim with shared dataset."
    }
  ], queue);

  assert.deepStrictEqual(result.applied, ["offline-intro"]);
  assert.strictEqual(result.blocked.length, 0);
  assert.strictEqual(result.document.blocks[0].content, "Initial claim with replication package.");
  assert.deepStrictEqual(result.document.blocks[0].citations, ["doi:10.5555/repro"]);
  assert.strictEqual(buildConflictReport(result).warningCount, 1);
  assert.ok(result.snapshot.contentHash);
}

function testBlocksLockedSectionConflict() {
  let queue = [];
  queue = queueOfflineOperation(queue, {
    id: "offline-locked",
    actorId: "editor-a",
    blockId: "locked-block",
    expectedVersion: 1,
    content: "Changed final figure caption."
  });

  const result = rebaseOfflineQueue(fixture(), [], queue);
  const report = buildConflictReport(result);

  assert.deepStrictEqual(result.applied, []);
  assert.strictEqual(result.blocked[0].conflict.type, "section-lock");
  assert.strictEqual(report.status, "manual-review-required");
  assert.strictEqual(report.blockedCount, 1);
}

function testSuggestionResolutionIsSafe() {
  let queue = [];
  queue = queueOfflineOperation(queue, {
    id: "offline-suggestion",
    actorId: "reviewer-a",
    blockId: "review",
    kind: "resolve-suggestion",
    suggestionId: "s1",
    expectedVersion: 1
  });

  const result = rebaseOfflineQueue(fixture(), [], queue);
  const suggestion = result.document.blocks
    .find((block) => block.id === "review")
    .suggestions.find((item) => item.id === "s1");

  assert.deepStrictEqual(result.applied, ["offline-suggestion"]);
  assert.strictEqual(suggestion.status, "accepted");
  assert.strictEqual(suggestion.resolvedBy, "reviewer-a");
}

function testDuplicateOfflineOperationIsSkipped() {
  let queue = [];
  const operation = {
    id: "offline-duplicate",
    actorId: "editor-a",
    blockId: "intro",
    expectedVersion: 1,
    content: "Initial claim with one offline replay."
  };
  queue = queueOfflineOperation(queue, operation);
  queue = queueOfflineOperation(queue, operation);

  const result = rebaseOfflineQueue(fixture(), [], queue);
  const report = buildConflictReport(result);
  const intro = result.document.blocks.find((block) => block.id === "intro");
  const duplicateAudit = result.audit.find((entry) => entry.status === "skipped-duplicate");

  assert.deepStrictEqual(result.applied, ["offline-duplicate"]);
  assert.strictEqual(intro.version, 2);
  assert.strictEqual(duplicateAudit.operationId, "offline-duplicate");
  assert.strictEqual(report.skippedCount, 1);
  assert.strictEqual(report.skipped[0].type, "duplicate-operation");
}

function testMissingSuggestionIsAudited() {
  let queue = [];
  queue = queueOfflineOperation(queue, {
    id: "offline-missing-suggestion",
    actorId: "reviewer-a",
    blockId: "review",
    kind: "resolve-suggestion",
    suggestionId: "missing",
    expectedVersion: 1
  });

  const result = rebaseOfflineQueue(fixture(), [], queue);
  const report = buildConflictReport(result);

  assert.strictEqual(result.blocked[0].conflict.type, "missing-suggestion");
  assert.ok(report.auditHash);
}

function testSnapshotIsRestoreReady() {
  const snapshot = createSnapshot(fixture(), "before-sync");
  assert.strictEqual(snapshot.label, "before-sync");
  assert.strictEqual(snapshot.blockCount, 3);
  assert.ok(Array.isArray(snapshot.restorePayload));
  assert.ok(snapshot.contentHash.length >= 32);
}

const tests = [
  testRebasesOfflineUpdateAfterServerChange,
  testBlocksLockedSectionConflict,
  testSuggestionResolutionIsSafe,
  testDuplicateOfflineOperationIsSkipped,
  testMissingSuggestionIsAudited,
  testSnapshotIsRestoreReady
];

for (const test of tests) {
  test();
}

console.log(`${tests.length} conflict resolver tests passed`);
