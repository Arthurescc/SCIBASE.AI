"use strict";

const {
  queueOfflineOperation,
  rebaseOfflineQueue,
  buildConflictReport
} = require("../src/conflict-resolver");

const baseDocument = {
  id: "manuscript-alpha",
  baseRevision: "rev-17",
  locks: [
    { sectionId: "methods", ownerId: "reviewer-2", status: "active" }
  ],
  blocks: [
    {
      id: "abstract",
      sectionId: "frontmatter",
      type: "markdown",
      content: "We introduce a catalyst screening workflow.",
      citations: ["doi:10.1000/base"],
      version: 2
    },
    {
      id: "method-step",
      sectionId: "methods",
      type: "notebook",
      content: "Run catalyst notebook",
      version: 3
    },
    {
      id: "discussion",
      sectionId: "discussion",
      type: "latex",
      content: "The yield improves by 12%.",
      suggestions: [{ id: "sug-1", status: "open", text: "Mention confidence interval." }],
      version: 1
    }
  ]
};

const serverOperations = [
  {
    id: "srv-1",
    actorId: "editor-remote",
    kind: "update-block",
    blockId: "abstract",
    content: "We introduce a reproducible catalyst screening workflow."
  }
];

let offlineQueue = [];
offlineQueue = queueOfflineOperation(offlineQueue, {
  id: "off-1",
  actorId: "author-1",
  blockId: "abstract",
  expectedVersion: 2,
  content: "We introduce a reproducible catalyst screening workflow for open labs.",
  citations: ["doi:10.1000/open-labs"]
});
offlineQueue = queueOfflineOperation(offlineQueue, {
  id: "off-2",
  actorId: "author-1",
  blockId: "method-step",
  expectedVersion: 3,
  content: "Run catalyst notebook with seeded environment capture."
});
offlineQueue = queueOfflineOperation(offlineQueue, {
  id: "off-3",
  actorId: "author-3",
  blockId: "discussion",
  kind: "resolve-suggestion",
  suggestionId: "sug-1",
  expectedVersion: 1
});

const result = rebaseOfflineQueue(baseDocument, serverOperations, offlineQueue);
const report = buildConflictReport(result);

console.log(JSON.stringify({
  report,
  applied: result.applied,
  blocked: result.blocked,
  snapshot: {
    id: result.snapshot.id,
    contentHash: result.snapshot.contentHash,
    blockCount: result.snapshot.blockCount
  }
}, null, 2));
