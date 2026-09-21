"use strict";

const { json, readJsonBody } = require("../http/respond");
const { requireAuth, requireRole } = require("../http/authGuards");
const pages = require("../lib/pages");

function register(router) {
  router.get("/_cms/api/pages", requireAuth, async (req, res, ctx) => {
    const list = await pages.listPagesWithStatus(ctx.db, ctx.rootDir, ctx.dataDir);
    return json(res, 200, { pages: list });
  });

  router.post("/_cms/api/pages", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 16 * 1024);
    } catch {
      return json(res, 400, { error: "Malformed request." });
    }
    const relPath = normalizePagePath(body.path);
    if (!relPath) return json(res, 400, { error: "Provide a page path ending in .html, e.g. 'services.html'." });

    const result = await pages.createPage({
      rootDir: ctx.rootDir,
      dataDir: ctx.dataDir,
      relPath,
      title: body.title,
      actor: ctx.user,
      db: ctx.db,
    });
    if (!result.ok) return json(res, 400, { error: result.reason });
    return json(res, 201, { ok: true, path: relPath });
  });

  router.post("/_cms/api/pages/duplicate", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 16 * 1024);
    } catch {
      return json(res, 400, { error: "Malformed request." });
    }
    const sourceRelPath = normalizePagePath(body.sourcePath);
    const targetRelPath = normalizePagePath(body.targetPath);
    if (!sourceRelPath || !targetRelPath) {
      return json(res, 400, { error: "Both sourcePath and targetPath are required and must end in .html." });
    }
    const result = await pages.duplicatePage({
      rootDir: ctx.rootDir,
      dataDir: ctx.dataDir,
      sourceRelPath,
      targetRelPath,
      actor: ctx.user,
      db: ctx.db,
    });
    if (!result.ok) return json(res, 400, { error: result.reason });
    return json(res, 201, { ok: true, path: targetRelPath });
  });

  router.delete("/_cms/api/pages", requireRole("admin"), async (req, res, ctx) => {
    const relPath = normalizePagePath(req.query.get("path"));
    if (!relPath) return json(res, 400, { error: "A valid ?path= is required." });
    const result = await pages.deletePage({ rootDir: ctx.rootDir, dataDir: ctx.dataDir, relPath, actor: ctx.user, db: ctx.db });
    if (!result.ok) return json(res, 404, { error: result.reason });
    return json(res, 200, { ok: true });
  });
}

function normalizePagePath(input) {
  if (typeof input !== "string") return null;
  let p = input.trim().replace(/^\/+/, "");
  if (!p) return null;
  if (!p.toLowerCase().endsWith(".html")) p += ".html";
  return p;
}

module.exports = { register, normalizePagePath };
