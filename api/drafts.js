"use strict";

const { json, readJsonBody } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const pages = require("../lib/pages");
const { normalizePagePath } = require("./pages");
const htmlmeta = require("../lib/htmlmeta");

function register(router) {
  router.get("/_cms/api/drafts", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const relPath = normalizePagePath(req.query.get("path"));
    if (!relPath) return json(res, 400, { error: "A valid ?path= is required." });
    const content = await pages.loadEditableContent(ctx.rootDir, ctx.dataDir, relPath);
    if (!content) return json(res, 404, { error: "Page not found." });
    return json(res, 200, {
      path: relPath,
      html: content.html,
      stamp: content.stamp,
      source: content.source,
      title: htmlmeta.extractTitle(content.html),
    });
  });

  router.post("/_cms/api/drafts", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const relPath = normalizePagePath(req.query.get("path"));
    if (!relPath) return json(res, 400, { error: "A valid ?path= is required." });

    let body;
    try {
      body = await readJsonBody(req, htmlmeta.MAX_PAGE_HTML_BYTES + 64 * 1024);
    } catch (err) {
      if (err.code === "LIMIT") return json(res, 413, { error: "Page is too large to save." });
      return json(res, 400, { error: "Malformed request." });
    }

    if (typeof body.html !== "string") return json(res, 400, { error: "Missing html in request body." });

    const result = await pages.saveDraft({
      rootDir: ctx.rootDir,
      dataDir: ctx.dataDir,
      relPath,
      html: body.html,
      ifStamp: body.ifStamp || null,
      actor: ctx.user,
      db: ctx.db,
    });

    if (result.conflict) {
      return json(res, 409, {
        error: "This page was changed elsewhere since you loaded it.",
        conflict: true,
        serverHtml: result.serverHtml,
        serverStamp: result.serverStamp,
      });
    }
    if (!result.ok) return json(res, 400, { error: result.reason });
    return json(res, 200, { ok: true, stamp: result.stamp });
  });
}

module.exports = { register };
