"use strict";
/**
 * lib/pages.js
 * ---------------------------------------------------------------------------
 * Everything to do with "what is a page, and what state is it in."
 *
 * A page's identity IS its relative path under the site root (e.g.
 * "about.html") - there is no separate fake page database (see spec
 * section 8: "the page system must understand the project's actual
 * filesystem/page architecture"). Draft content lives in a mirrored
 * directory tree under CMS_DATA_DIR/drafts, kept completely separate from
 * the live site tree so an in-progress edit can never accidentally become
 * visible to the public.
 *
 * A brand-new page starts out as DRAFT ONLY - there is deliberately no live
 * file until the first Publish. This is what makes "Draft vs Live vs
 * History" a real, honest distinction rather than a label on top of a
 * system that actually always writes straight to production.
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { atomicWriteFile, newId } = require("./store");
const htmlmeta = require("./htmlmeta");
const { renderTokensStyleBlock } = require("./tokens");
const { record: recordActivity } = require("./activity");

const UPLOADS_DIRNAME = "uploads";

function computeStamp(text) {
  return crypto.createHash("sha256").update(text || "", "utf8").digest("hex").slice(0, 16);
}

/** Validate + resolve a caller-supplied relative page path against `baseDir`.
 *  Returns the absolute path, or null if the relPath is unsafe/invalid. */
function safeRelPath(baseDir, relPath) {
  if (typeof relPath !== "string" || !relPath.length) return null;
  if (relPath.includes("\0")) return null;
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || !normalized.toLowerCase().endsWith(".html")) return null;
  const abs = path.resolve(baseDir, normalized);
  if (abs !== baseDir && !abs.startsWith(baseDir + path.sep)) return null;
  return abs;
}

/** Resolve an incoming URL pathname to a live-site file, honoring clean URLs
 *  ("/about" -> about.html or about/index.html) the same way the original
 *  implementation did. Returns { absPath, relPath } or null. */
function resolveRequestPath(rootDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (relative.includes("\0")) return null;
  let candidate = path.resolve(rootDir, relative);
  if (candidate !== rootDir && !candidate.startsWith(rootDir + path.sep)) return null;

  if (!path.extname(candidate)) {
    const htmlCandidate = candidate + ".html";
    const indexCandidate = path.join(candidate, "index.html");
    if (fs.existsSync(htmlCandidate)) candidate = htmlCandidate;
    else if (fs.existsSync(indexCandidate)) candidate = indexCandidate;
  }

  const relPath = path.relative(rootDir, candidate).split(path.sep).join("/");
  return { absPath: candidate, relPath };
}

async function walkHtmlFiles(rootDir) {
  const results = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (dir === rootDir && entry.name === UPLOADS_DIRNAME) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        results.push(path.relative(rootDir, abs).split(path.sep).join("/"));
      }
    }
  }
  await walk(rootDir);
  return results.sort();
}

function draftPathFor(dataDir, relPath) {
  return safeRelPath(path.join(dataDir, "drafts"), relPath);
}

function livePathFor(rootDir, relPath) {
  return safeRelPath(rootDir, relPath);
}

async function readIfExists(absPath) {
  try {
    return await fsp.readFile(absPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function statOrNull(absPath) {
  try {
    return await fsp.stat(absPath);
  } catch {
    return null;
  }
}

/** Load what the editor should show: the draft if one exists, otherwise the
 *  live file as the starting basis for a first-ever edit. */
async function loadEditableContent(rootDir, dataDir, relPath) {
  const draftAbs = draftPathFor(dataDir, relPath);
  const liveAbs = livePathFor(rootDir, relPath);
  if (!draftAbs || !liveAbs) return null;

  const draftHtml = await readIfExists(draftAbs);
  if (draftHtml != null) {
    return { html: draftHtml, source: "draft", stamp: computeStamp(draftHtml) };
  }
  const liveHtml = await readIfExists(liveAbs);
  if (liveHtml != null) {
    return { html: liveHtml, source: "live-as-basis", stamp: computeStamp(liveHtml) };
  }
  return null;
}

async function loadLive(rootDir, relPath) {
  const liveAbs = livePathFor(rootDir, relPath);
  if (!liveAbs) return null;
  const html = await readIfExists(liveAbs);
  if (html == null) return null;
  return { html, stamp: computeStamp(html) };
}

/** Bake the CURRENT design tokens into the page as a real <style> tag, so
 *  the file is a fully self-contained static HTML document that renders
 *  correctly on ANY static host - not just when served through this Node
 *  server. See staticSite.js for the matching "refresh on every serve"
 *  half of this: while a page IS being served through this server (editing,
 *  or production traffic if this server stays in front), token edits still
 *  apply site-wide instantly, because every serve re-runs this same upsert
 *  with the latest tokens. Once a file leaves this server's hands (copied
 *  to another host), whatever was baked in at last publish is what stays. */
async function bakeTokens(html, db) {
  const tokens = await db.tokensDoc.read();
  const block = renderTokensStyleBlock(tokens);
  return htmlmeta.upsertNamedBlock(html, "cms-tokens", block);
}

/** Save draft content with optimistic concurrency. Returns {ok:true, stamp}
 *  or {ok:false, conflict:true, serverHtml, serverStamp}. */
async function saveDraft({ rootDir, dataDir, relPath, html, ifStamp, actor, db }) {
  const draftAbs = draftPathFor(dataDir, relPath);
  if (!draftAbs) return { ok: false, reason: "Invalid page path." };

  const validity = htmlmeta.looksLikeHtmlDocument(html);
  if (!validity.ok) return { ok: false, reason: validity.reason };

  let cleaned = htmlmeta.stripTempEditorMarkers(htmlmeta.stripEditorWrapper(html));
  cleaned = await bakeTokens(cleaned, db);

  if (ifStamp) {
    const current = await loadEditableContent(rootDir, dataDir, relPath);
    const currentStamp = current ? current.stamp : null;
    if (currentStamp && currentStamp !== ifStamp) {
      return { ok: false, conflict: true, serverHtml: current.html, serverStamp: currentStamp };
    }
  }

  await atomicWriteFile(draftAbs, cleaned);
  const stamp = computeStamp(cleaned);
  const now = Date.now();

  await db.pagesMetaCol.transact((all) => {
    const existing = all[relPath] || { path: relPath, createdAt: now, createdBy: actor.username };
    all[relPath] = { ...existing, draftUpdatedAt: now, draftUpdatedBy: actor.username, draftStamp: stamp };
  });

  return { ok: true, stamp };
}

class PublishError extends Error {}

/** Publish the current draft: validate, atomically become the live file,
 *  THEN record a version. Ordered so a failed write never creates a
 *  version for content that never actually went live, and the previous
 *  live file is left completely untouched if anything goes wrong. */
async function publishPage({ rootDir, dataDir, relPath, actor, summary, db }) {
  const draftAbs = draftPathFor(dataDir, relPath);
  const liveAbs = livePathFor(rootDir, relPath);
  if (!draftAbs || !liveAbs) throw new PublishError("Invalid page path.");

  const draftHtml = await readIfExists(draftAbs);
  if (draftHtml == null) throw new PublishError("There is no draft to publish for this page yet.");

  const validity = htmlmeta.looksLikeHtmlDocument(draftHtml);
  if (!validity.ok) throw new PublishError(`Draft failed validation: ${validity.reason}`);

  let cleaned = htmlmeta.stripTempEditorMarkers(htmlmeta.stripEditorWrapper(draftHtml));
  cleaned = await bakeTokens(cleaned, db);

  await atomicWriteFile(liveAbs, cleaned); // atomic: old live file untouched unless this fully succeeds

  const number = await db.counters.next("version");
  const now = Date.now();
  const version = {
    id: newId("ver"),
    number,
    pagePath: relPath,
    createdAt: now,
    authorId: actor.id,
    authorName: actor.username,
    html: cleaned,
    summary: summary || null,
  };
  await db.versionsCol.put(version.id, version);

  await db.pagesMetaCol.transact((all) => {
    const existing = all[relPath] || { path: relPath, createdAt: now, createdBy: actor.username };
    all[relPath] = {
      ...existing,
      lastPublishedAt: now,
      lastPublishedBy: actor.username,
      liveVersionId: version.id,
      liveVersionNumber: number,
    };
  });

  await recordActivity(db, {
    type: "publish",
    actor,
    message: `${actor.username} published ${relPath} (v${number})`,
    meta: { pagePath: relPath, versionId: version.id, versionNumber: number },
  });

  return version;
}

/** Restore a historical version into the DRAFT (never touches live). */
async function restoreVersionToDraft({ dataDir, versionId, actor, db }) {
  const version = await db.versionsCol.get(versionId);
  if (!version) throw new PublishError("That version no longer exists.");

  const draftAbs = draftPathFor(dataDir, version.pagePath);
  if (!draftAbs) throw new PublishError("Invalid page path on that version.");

  await atomicWriteFile(draftAbs, version.html);
  const stamp = computeStamp(version.html);
  const now = Date.now();

  await db.pagesMetaCol.transact((all) => {
    const existing = all[version.pagePath] || { path: version.pagePath, createdAt: now, createdBy: actor.username };
    all[version.pagePath] = {
      ...existing,
      draftUpdatedAt: now,
      draftUpdatedBy: actor.username,
      draftStamp: stamp,
      restoredFromVersion: version.number,
    };
  });

  await recordActivity(db, {
    type: "restore",
    actor,
    message: `${actor.username} restored v${version.number} of ${version.pagePath} into a new draft`,
    meta: { pagePath: version.pagePath, versionId: version.id, versionNumber: version.number },
  });

  return { pagePath: version.pagePath, stamp };
}

async function listPagesWithStatus(db, rootDir, dataDir) {
  const fsPages = await walkHtmlFiles(rootDir);
  const metaAll = await db.pagesMetaCol.all();
  const allPaths = new Set(fsPages);
  // Pages that exist ONLY as an unpublished draft won't show up in the fs walk
  // of rootDir - walk the drafts tree too and union the results.
  const draftFsPages = await walkHtmlFiles(path.join(dataDir, "drafts"));
  for (const p of draftFsPages) allPaths.add(p);

  const results = [];
  for (const relPath of Array.from(allPaths).sort()) {
    const liveAbs = livePathFor(rootDir, relPath);
    const draftAbs = draftPathFor(dataDir, relPath);
    const [liveStat, draftStat] = await Promise.all([statOrNull(liveAbs), statOrNull(draftAbs)]);
    const hasLive = Boolean(liveStat);
    const hasDraft = Boolean(draftStat);
    const meta = metaAll[relPath] || null;

    let status = "published";
    let liveHtml = null;
    let draftHtml = null;
    if (!hasLive && hasDraft) {
      status = "unpublished-draft";
      draftHtml = await readIfExists(draftAbs);
    } else if (hasLive && hasDraft) {
      [liveHtml, draftHtml] = await Promise.all([readIfExists(liveAbs), readIfExists(draftAbs)]);
      status = computeStamp(liveHtml) === computeStamp(draftHtml) ? "published" : "draft-changes";
    } else if (hasLive) {
      liveHtml = await readIfExists(liveAbs);
      status = "published";
    }

    const title = htmlmeta.extractTitle(draftHtml || liveHtml || "") || null;

    results.push({
      path: relPath,
      title,
      hasLive,
      hasDraft,
      status,
      liveModifiedAt: liveStat ? liveStat.mtimeMs : null,
      draftModifiedAt: draftStat ? draftStat.mtimeMs : null,
      lastPublishedAt: meta ? meta.lastPublishedAt || null : null,
      lastPublishedBy: meta ? meta.lastPublishedBy || null : null,
      liveVersionNumber: meta ? meta.liveVersionNumber || null : null,
      createdAt: meta ? meta.createdAt || null : liveStat ? liveStat.birthtimeMs : null,
      createdBy: meta ? meta.createdBy || null : null,
    });
  }
  return results;
}

async function createPage({ rootDir, dataDir, relPath, title, actor, db }) {
  const draftAbs = draftPathFor(dataDir, relPath);
  const liveAbs = livePathFor(rootDir, relPath);
  if (!draftAbs || !liveAbs) return { ok: false, reason: "Invalid page path. Use a relative path ending in .html." };
  if (fs.existsSync(liveAbs) || fs.existsSync(draftAbs)) {
    return { ok: false, reason: "A page already exists at that path." };
  }

  const safeTitle = (title || "Untitled page").toString().slice(0, 200);
  const skeleton = buildSkeletonPage(safeTitle);
  await atomicWriteFile(draftAbs, skeleton);

  const now = Date.now();
  await db.pagesMetaCol.transact((all) => {
    all[relPath] = { path: relPath, createdAt: now, createdBy: actor.username };
  });

  await recordActivity(db, {
    type: "page-created",
    actor,
    message: `${actor.username} created a new page: ${relPath}`,
    meta: { pagePath: relPath },
  });

  return { ok: true };
}

async function duplicatePage({ rootDir, dataDir, sourceRelPath, targetRelPath, actor, db }) {
  const targetDraftAbs = draftPathFor(dataDir, targetRelPath);
  const targetLiveAbs = livePathFor(rootDir, targetRelPath);
  if (!targetDraftAbs || !targetLiveAbs) return { ok: false, reason: "Invalid target page path." };
  if (fs.existsSync(targetLiveAbs) || fs.existsSync(targetDraftAbs)) {
    return { ok: false, reason: "A page already exists at that path." };
  }

  const source = await loadEditableContent(rootDir, dataDir, sourceRelPath);
  if (!source) return { ok: false, reason: "Source page not found." };

  await atomicWriteFile(targetDraftAbs, source.html);
  const now = Date.now();
  await db.pagesMetaCol.transact((all) => {
    all[targetRelPath] = { path: targetRelPath, createdAt: now, createdBy: actor.username, duplicatedFrom: sourceRelPath };
  });

  await recordActivity(db, {
    type: "page-created",
    actor,
    message: `${actor.username} duplicated ${sourceRelPath} as ${targetRelPath}`,
    meta: { pagePath: targetRelPath },
  });

  return { ok: true };
}

async function deletePage({ rootDir, dataDir, relPath, actor, db }) {
  const draftAbs = draftPathFor(dataDir, relPath);
  const liveAbs = livePathFor(rootDir, relPath);
  if (!draftAbs || !liveAbs) return { ok: false, reason: "Invalid page path." };

  let removedSomething = false;
  for (const abs of [liveAbs, draftAbs]) {
    try {
      await fsp.unlink(abs);
      removedSomething = true;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  if (!removedSomething) return { ok: false, reason: "Page not found." };

  await db.pagesMetaCol.remove(relPath);

  await recordActivity(db, {
    type: "page-deleted",
    actor,
    message: `${actor.username} deleted ${relPath}`,
    meta: { pagePath: relPath },
  });

  return { ok: true };
}

function buildSkeletonPage(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="">
</head>
<body>
<section style="padding:64px 24px;max-width:720px;margin:0 auto;font-family:-apple-system,'Segoe UI',sans-serif;">
<h1>${escapeHtml(title)}</h1>
<p>This page is new. Select this text to start editing.</p>
</section>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  computeStamp,
  safeRelPath,
  resolveRequestPath,
  walkHtmlFiles,
  draftPathFor,
  livePathFor,
  loadEditableContent,
  loadLive,
  saveDraft,
  publishPage,
  restoreVersionToDraft,
  listPagesWithStatus,
  createPage,
  duplicatePage,
  deletePage,
  PublishError,
};
