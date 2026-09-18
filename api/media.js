"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { json } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const { record: recordActivity } = require("../lib/activity");

function register(router) {
  router.get("/_cms/api/media", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const metaAll = await ctx.db.mediaCol.all();
    let entries;
    try {
      entries = await fsp.readdir(ctx.uploadDir, { withFileTypes: true });
    } catch {
      entries = [];
    }

    const items = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const abs = path.join(ctx.uploadDir, entry.name);
      const stat = await fsp.stat(abs).catch(() => null);
      if (!stat) continue;
      const meta = metaAll[entry.name] || null;
      items.push({
        id: entry.name,
        url: "/uploads/" + encodeURIComponent(entry.name),
        originalName: meta ? meta.originalName : entry.name,
        uploaderName: meta ? meta.uploaderName : null,
        uploadedAt: meta ? meta.uploadedAt : stat.birthtimeMs,
        size: meta ? meta.size : stat.size,
        mime: meta ? meta.mime : null,
        width: meta ? meta.width : null,
        height: meta ? meta.height : null,
      });
    }
    items.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return json(res, 200, { media: items });
  });

  router.delete("/_cms/api/media/:filename", requireRole("admin"), async (req, res, ctx) => {
    const filename = path.basename(req.params.filename || "");
    if (!filename) return json(res, 400, { error: "Missing filename." });
    const abs = path.join(ctx.uploadDir, filename);
    if (!abs.startsWith(ctx.uploadDir + path.sep)) return json(res, 400, { error: "Invalid filename." });

    try {
      await fsp.unlink(abs);
    } catch (err) {
      if (err.code === "ENOENT") return json(res, 404, { error: "File not found." });
      throw err;
    }
    await ctx.db.mediaCol.remove(filename);
    await recordActivity(ctx.db, {
      type: "media-deleted",
      actor: ctx.user,
      message: `${ctx.user.username} deleted media file ${filename}`,
    });
    return json(res, 200, { ok: true });
  });
}

module.exports = { register };
