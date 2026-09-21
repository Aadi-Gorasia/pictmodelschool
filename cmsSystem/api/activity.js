"use strict";

const { json } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const { recent } = require("../lib/activity");

function register(router) {
  router.get("/_cms/api/activity", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const limit = Math.min(Number(req.query.get("limit")) || 50, 500);
    const pagePath = req.query.get("path") || null;
    const entries = await recent(ctx.db, limit, pagePath);
    return json(res, 200, { activity: entries });
  });
}

module.exports = { register };
