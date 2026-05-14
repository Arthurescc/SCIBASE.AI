"use strict";

const crypto = require("crypto");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDocument(document) {
  if (!document || !Array.isArray(document.blocks)) {
    throw new Error("document.blocks must be an array");
  }

  const blocks = document.blocks.map((block, index) => ({
    id: block.id || `block-${index + 1}`,
    type: block.type || "markdown",
    sectionId: block.sectionId || "body",
    content: block.content || "",
    citations: Array.isArray(block.citations) ? [...block.citations] : [],
    comments: Array.isArray(block.comments) ? clone(block.comments) : [],
    suggestions: Array.isArray(block.suggestions) ? clone(block.suggestions) : [],
    version: Number.isInteger(block.version) ? block.version : 1
  }));

  return {
    id: document.id || "research-document",
    baseRevision: document.baseRevision || "rev-0",
    blocks,
    locks: Array.isArray(document.locks) ? clone(document.locks) : [],
    snapshots: Array.isArray(document.snapshots) ? clone(document.snapshots) : []
  };
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createSnapshot(document, label) {
  const normalized = normalizeDocument(document);
  return {
    id: `snapshot-${hashPayload(normalized).slice(0, 12)}`,
    label,
    baseRevision: normalized.baseRevision,
    blockCount: normalized.blocks.length,
    contentHash: hashPayload(normalized.blocks),
    restorePayload: clone(normalized.blocks)
  };
}

function queueOfflineOperation(queue, operation) {
  if (!operation || !operation.id || !operation.actorId || !operation.blockId) {
    throw new Error("offline operation requires id, actorId, and blockId");
  }

  return [...queue, {
    kind: "update-block",
    timestamp: "offline",
    expectedVersion: 1,
    ...operation
  }];
}

function findBlock(document, blockId) {
  return document.blocks.find((block) => block.id === blockId);
}

function isSectionLocked(document, sectionId, actorId) {
  return document.locks.find((lock) =>
    lock.sectionId === sectionId &&
    lock.status === "active" &&
    lock.ownerId !== actorId
  );
}

function applyServerOperation(document, operation) {
  const next = clone(document);
  const block = findBlock(next, operation.blockId);

  if (!block) {
    next.blocks.push({
      id: operation.blockId,
      type: operation.type || "markdown",
      sectionId: operation.sectionId || "body",
      content: operation.content || "",
      citations: [],
      comments: [],
      suggestions: [],
      version: 1
    });
    return next;
  }

  if (operation.kind === "delete-block") {
    next.blocks = next.blocks.filter((candidate) => candidate.id !== operation.blockId);
    return next;
  }

  if (operation.content !== undefined) {
    block.content = operation.content;
  }
  if (operation.citations) {
    block.citations = [...new Set([...block.citations, ...operation.citations])];
  }
  block.version += 1;
  return next;
}

function detectConflict(document, operation) {
  const block = findBlock(document, operation.blockId);
  if (!block) {
    return {
      type: "missing-block",
      severity: "high",
      reason: `Block ${operation.blockId} no longer exists on the server revision.`
    };
  }

  const lock = isSectionLocked(document, block.sectionId, operation.actorId);
  if (lock) {
    return {
      type: "section-lock",
      severity: "high",
      reason: `Section ${block.sectionId} is locked by ${lock.ownerId}.`
    };
  }

  if (operation.expectedVersion !== undefined && operation.expectedVersion < block.version) {
    return {
      type: "stale-version",
      severity: "warning",
      reason: `Offline edit expected version ${operation.expectedVersion}, but server block is version ${block.version}.`
    };
  }

  if (operation.kind === "resolve-suggestion" && !block.suggestions.some((item) => item.id === operation.suggestionId)) {
    return {
      type: "missing-suggestion",
      severity: "medium",
      reason: `Suggestion ${operation.suggestionId} was already resolved or removed.`
    };
  }

  return null;
}

function mergeUpdate(block, operation) {
  const next = clone(block);
  if (operation.content !== undefined) {
    next.content = operation.content;
  }
  if (Array.isArray(operation.citations)) {
    next.citations = [...new Set([...next.citations, ...operation.citations])];
  }
  if (operation.comment) {
    const exists = next.comments.some((comment) => comment.id === operation.comment.id);
    if (!exists) {
      next.comments.push(operation.comment);
    }
  }
  if (operation.suggestion) {
    const exists = next.suggestions.some((suggestion) => suggestion.id === operation.suggestion.id);
    if (!exists) {
      next.suggestions.push(operation.suggestion);
    }
  }
  next.version += 1;
  return next;
}

function applyOfflineOperation(document, operation) {
  const next = clone(document);
  const index = next.blocks.findIndex((block) => block.id === operation.blockId);
  if (index === -1) {
    return next;
  }

  if (operation.kind === "resolve-suggestion") {
    next.blocks[index].suggestions = next.blocks[index].suggestions.map((suggestion) =>
      suggestion.id === operation.suggestionId
        ? { ...suggestion, status: "accepted", resolvedBy: operation.actorId }
        : suggestion
    );
    next.blocks[index].version += 1;
    return next;
  }

  next.blocks[index] = mergeUpdate(next.blocks[index], operation);
  return next;
}

function rebaseOfflineQueue(baseDocument, serverOperations, offlineQueue) {
  let serverDocument = normalizeDocument(baseDocument);
  const audit = [];
  const applied = [];
  const blocked = [];

  for (const operation of serverOperations) {
    serverDocument = applyServerOperation(serverDocument, operation);
  }

  for (const operation of offlineQueue) {
    const conflict = detectConflict(serverDocument, operation);
    if (conflict && conflict.severity !== "warning") {
      blocked.push({ operationId: operation.id, conflict });
      audit.push({
        operationId: operation.id,
        actorId: operation.actorId,
        status: "blocked",
        conflict
      });
      continue;
    }

    serverDocument = applyOfflineOperation(serverDocument, operation);
    applied.push(operation.id);
    audit.push({
      operationId: operation.id,
      actorId: operation.actorId,
      status: conflict ? "applied-with-warning" : "applied",
      blockId: operation.blockId,
      warning: conflict || undefined
    });
  }

  return {
    document: serverDocument,
    applied,
    blocked,
    audit,
    snapshot: createSnapshot(serverDocument, "post-offline-rebase")
  };
}

function buildConflictReport(result) {
  const blockers = result.blocked.map((entry) => ({
    operationId: entry.operationId,
    type: entry.conflict.type,
    severity: entry.conflict.severity,
    reason: entry.conflict.reason
  }));
  const warnings = result.audit
    .filter((entry) => entry.warning)
    .map((entry) => ({
      operationId: entry.operationId,
      type: entry.warning.type,
      reason: entry.warning.reason
    }));

  return {
    status: blockers.length === 0 ? "ready-to-sync" : "manual-review-required",
    appliedCount: result.applied.length,
    blockedCount: blockers.length,
    warningCount: warnings.length,
    blockers,
    warnings,
    auditHash: hashPayload(result.audit),
    restoreSnapshotId: result.snapshot.id
  };
}

module.exports = {
  normalizeDocument,
  createSnapshot,
  queueOfflineOperation,
  rebaseOfflineQueue,
  buildConflictReport
};
