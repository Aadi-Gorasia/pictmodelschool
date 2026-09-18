"use strict";
/**
 * lib/activity.js
 * ---------------------------------------------------------------------------
 * A single place that writes activity-log entries, so every call site
 * produces a consistent shape. Only meaningful, human-relevant events are
 * logged here (never per-keystroke noise - see server.js/api for call
 * sites, which are limited to auth, publish, draft-save, uploads, page and
 * user lifecycle, and version restores).
 */

const { newId } = require("./store");

const MAX_ENTRIES = 500; // oldest entries are pruned beyond this so the log file can't grow forever

async function record(db, { type, actor, message, meta }) {
  const entry = {
    id: newId("act"),
    type,
    actorId: actor ? actor.id : null,
    actorName: actor ? actor.username : "System",
    message,
    meta: meta || null,
    createdAt: Date.now(),
  };
  await db.activityCol.put(entry.id, entry);
  await pruneIfNeeded(db);
  return entry;
}

async function pruneIfNeeded(db) {
  const all = await db.activityCol.list();
  if (all.length <= MAX_ENTRIES) return;
  all.sort((a, b) => b.createdAt - a.createdAt);
  const toRemove = all.slice(MAX_ENTRIES);
  await db.activityCol.transact((obj) => {
    for (const entry of toRemove) delete obj[entry.id];
  });
}

async function recent(db, limit = 50, pagePath = null) {
  let all = await db.activityCol.list();
  if (pagePath) all = all.filter((e) => e.meta && e.meta.pagePath === pagePath);
  all.sort((a, b) => b.createdAt - a.createdAt);
  return all.slice(0, limit);
}

module.exports = { record, recent };
