"use strict";
/**
 * http/staticSite.js
 * ---------------------------------------------------------------------------
 * Serves the actual website. This is where the original implementation's
 * biggest problem lived: it injected the full CMS editor - and accepted
 * publishes - on every request from every visitor, logged in or not. Here,
 * anonymous requests only ever see plain LIVE content. The editor chrome,
 * and even *seeing draft content*, requires a valid authenticated session.
 *
 * Modes (query string `?__cms=`), only honored when authenticated:
 *   (absent) / "edit"  -> full editor, editing the draft (or live as a
 *                         starting basis for a page that's never been
 *                         touched in the CMS yet)
 *   "preview"          -> draft content, no editor chrome, small exit pill
 *   "live"             -> live content, no editor chrome, small exit pill
 * Unauthenticated requests always get plain live content; the query
 * param is ignored entirely so it can never be used to see draft state
 * or editor chrome without a session.
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const pages = require("../lib/pages");
const htmlmeta = require("../lib/htmlmeta");
const { renderTokensStyleBlock } = require("../lib/tokens");
const { buildEditorBundle } = require("../editor/buildEditorBundle");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function determineMode(query, isAuthenticated) {
  if (!isAuthenticated) return "live";
  const raw = query.get("__cms");
  if (raw === "preview") return "preview-draft";
  if (raw === "live") return "preview-live";
  return "edit";
}

function exitPill(kind, relPath) {
  const editHref = "/" + relPath;
  const label = kind === "preview-draft" ? "Previewing draft" : "Viewing live site";
  const other =
    kind === "preview-draft"
      ? `<a href="${editHref}?__cms=live">View live</a>`
      : `<a href="${editHref}?__cms=preview">View draft</a>`;
  return `
<div id="cms-exit-pill" style="position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;
  display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-radius:999px;color:#f7f7fb;
  background:rgba(15,16,22,.88);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(16px);
  font:600 12px/1.2 -apple-system,'Segoe UI',sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);">
  <span style="width:6px;height:6px;border-radius:50%;background:#7c5cff;"></span>
  <span>${label}</span>
  <span style="opacity:.35;">&middot;</span>
  <span style="display:flex;gap:8px;">${other}</span>
  <a href="${editHref}" style="padding:5px 11px;border-radius:999px;background:#7c5cff;color:white;text-decoration:none;">Back to editor</a>
</div>
<style>#cms-exit-pill a{color:#cfc8ff;text-decoration:none;} #cms-exit-pill a:hover{text-decoration:underline;}</style>`;
}

function notFoundPage(message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not found</title></head>
<body style="font-family:-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;background:#0f1016;color:#f7f7fb;">
<div style="text-align:center;max-width:420px;padding:24px;">
<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9295a5;margin-bottom:12px;">404</div>
<p style="font-size:16px;line-height:1.5;">${message}</p>
</div></body></html>`;
}

async function serveStaticSite(req, res, ctx, pathname, respond) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return respond.text(res, 405, "405 Method Not Allowed");
  }

  const resolved = pages.resolveRequestPath(ctx.rootDir, pathname);
  if (!resolved) return respond.text(res, 403, "403 Forbidden");

  const { absPath, relPath } = resolved;
  const ext = path.extname(absPath).toLowerCase();
  const isUpload = relPath.startsWith("uploads/");

  if (ext !== ".html") {
    return serveRawFile(req, res, absPath, isUpload, respond);
  }

  const mode = determineMode(req.query, Boolean(ctx.user));
  const tokens = await ctx.db.tokensDoc.read();
  const tokensBlock = renderTokensStyleBlock(tokens);

  let content = null;
  if (mode === "edit" || mode === "preview-draft") {
    content = await pages.loadEditableContent(ctx.rootDir, ctx.dataDir, relPath);
  } else {
    content = await pages.loadLive(ctx.rootDir, relPath);
  }

  if (!content) {
    const message =
      mode === "edit" || mode === "preview-draft"
        ? "There's nothing here yet - no draft or live content exists at this path."
        : ctx.user
        ? "This page hasn't been published yet."
        : "This page doesn't exist.";
    return respond.html(res, 404, notFoundPage(message), { "Cache-Control": "no-store" });
  }

  let out = htmlmeta.upsertNamedBlock(content.html, "cms-tokens", tokensBlock);

  if (mode === "edit") {
    const bundle = await buildEditorBundle({ relPath, breakpoints: (await ctx.db.settingsDoc.read()).breakpoints });
    out = htmlmeta.insertBeforeBodyClose(out, bundle);
  } else if (mode === "preview-draft" || mode === "preview-live") {
    out = htmlmeta.insertBeforeBodyClose(out, exitPill(mode, relPath));
  }

  if (req.method === "HEAD") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end();
  }
  return respond.html(res, 200, out, { "Cache-Control": "no-store" });
}

async function serveRawFile(req, res, absPath, isUpload, respond) {
  const stat = await fsp.stat(absPath).catch(() => null);
  if (!stat || !stat.isFile()) return respond.text(res, 404, "404 Not Found");

  const headers = {
    "Content-Type": contentTypeFor(absPath),
    "Content-Length": stat.size,
    "Cache-Control": isUpload ? "public, max-age=31536000, immutable" : "no-cache",
  };
  if (isUpload) {
    // User-uploaded content is sandboxed at the response level: even if a
    // malicious file slipped past upload-time checks, the browser won't
    // execute scripts or treat it as same-origin-privileged content.
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:;";
    headers["X-Content-Type-Options"] = "nosniff";
  }

  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    return res.end();
  }
  res.writeHead(200, headers);
  fs.createReadStream(absPath).pipe(res);
}

module.exports = { serveStaticSite, determineMode, contentTypeFor };
