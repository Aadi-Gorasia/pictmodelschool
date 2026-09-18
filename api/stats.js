"use strict";

const fs = require("fs");
const { json } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const pages = require("../lib/pages");
const { recent } = require("../lib/activity");

function register(router) {
  router.get("/_cms/api/stats", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const [pageList, versions, activity, users, media] = await Promise.all([
      pages.listPagesWithStatus(ctx.db, ctx.rootDir, ctx.dataDir),
      ctx.db.versionsCol.list(),
      recent(ctx.db, 8),
      ctx.db.usersCol.list(),
      countMediaFiles(ctx.uploadDir),
    ]);

    versions.sort((a, b) => b.number - a.number);
    const latest = versions[0] || null;
    const draftChangesCount = pageList.filter((p) => p.status === "draft-changes" || p.status === "unpublished-draft").length;

    return json(res, 200, {
      pageCount: pageList.length,
      draftChangesCount,
      latestVersion: latest ? { number: latest.number, pagePath: latest.pagePath, createdAt: latest.createdAt, authorName: latest.authorName } : null,
      userCount: users.length,
      mediaCount: media,
      recentActivity: activity,
    });
  });
}

async function countMediaFiles(uploadDir) {
  try {
    const entries = await fs.promises.readdir(uploadDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

module.exports = { register };
