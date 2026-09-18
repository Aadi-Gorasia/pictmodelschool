"use strict";

const { json, html, readJsonBody } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const pages = require("../lib/pages");
const { normalizePagePath } = require("./pages");
const { diffLines } = require("../lib/diff");

function safeVersionSummary(v) {
  const { html: _html, ...rest } = v;
  return rest;
}

async function resolveDiffSide(ctx, token) {
  if (!token) return null;
  if (token.startsWith("live:")) {
    const relPath = normalizePagePath(token.slice(5));
    const content = relPath ? await pages.loadLive(ctx.rootDir, relPath) : null;
    return content ? { label: `Live: ${relPath}`, html: content.html } : null;
  }
  if (token.startsWith("draft:")) {
    const relPath = normalizePagePath(token.slice(6));
    const content = relPath ? await pages.loadEditableContent(ctx.rootDir, ctx.dataDir, relPath) : null;
    return content ? { label: `Draft: ${relPath}`, html: content.html } : null;
  }
  const version = await ctx.db.versionsCol.get(token);
  return version ? { label: `v${version.number} (${version.pagePath})`, html: version.html } : null;
}

function register(router) {
  router.post("/_cms/api/publish", requireRole("admin"), async (req, res, ctx) => {
    const relPath = normalizePagePath(req.query.get("path"));
    if (!relPath) return json(res, 400, { error: "A valid ?path= is required." });

    let body = {};
    try {
      body = await readJsonBody(req, 4 * 1024);
    } catch {
      /* summary is optional; ignore malformed/empty body */
    }

    try {
      const version = await pages.publishPage({
        rootDir: ctx.rootDir,
        dataDir: ctx.dataDir,
        relPath,
        actor: ctx.user,
        summary: typeof body.summary === "string" ? body.summary.slice(0, 500) : null,
        db: ctx.db,
      });
      return json(res, 200, { ok: true, version: safeVersionSummary(version) });
    } catch (err) {
      if (err instanceof pages.PublishError) return json(res, 400, { error: err.message });
      throw err;
    }
  });

  router.get("/_cms/api/versions", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const relPath = normalizePagePath(req.query.get("path"));
    let list = await ctx.db.versionsCol.list();
    if (relPath) list = list.filter((v) => v.pagePath === relPath);
    list.sort((a, b) => b.number - a.number);
    const limit = Math.min(Number(req.query.get("limit")) || 100, 500);
    return json(res, 200, { versions: list.slice(0, limit).map(safeVersionSummary) });
  });

  // NOTE: this router matches routes in registration order and has no
  // literal-vs-:param precedence of its own, so a literal path like
  // "/diff" MUST be registered before the "/:id" pattern below - otherwise
  // "/:id" (which matches any single segment) would swallow "diff" as if
  // it were an id and this route would never be reached.
  router.get("/_cms/api/versions/diff", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const aToken = req.query.get("a");
    const bToken = req.query.get("b");
    const [a, b] = await Promise.all([resolveDiffSide(ctx, aToken), resolveDiffSide(ctx, bToken)]);
    if (!a || !b) return json(res, 404, { error: "One or both versions to compare could not be found." });
    const result = diffLines(a.html, b.html);
    return json(res, 200, { aLabel: a.label, bLabel: b.label, ...result });
  });

  router.get("/_cms/api/versions/:id", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const version = await ctx.db.versionsCol.get(req.params.id);
    if (!version) return json(res, 404, { error: "Version not found." });
    return json(res, 200, { version: safeVersionSummary(version) });
  });

  router.get("/_cms/api/versions/:id/html", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const version = await ctx.db.versionsCol.get(req.params.id);
    if (!version) return json(res, 404, { error: "Version not found." });
    return html(res, 200, version.html, { "X-Frame-Options": "SAMEORIGIN" });
  });

  router.post("/_cms/api/versions/:id/restore", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    try {
      const result = await pages.restoreVersionToDraft({ dataDir: ctx.dataDir, versionId: req.params.id, actor: ctx.user, db: ctx.db });
      return json(res, 200, { ok: true, ...result });
    } catch (err) {
      if (err instanceof pages.PublishError) return json(res, 400, { error: err.message });
      throw err;
    }
  });
}

module.exports = { register };
