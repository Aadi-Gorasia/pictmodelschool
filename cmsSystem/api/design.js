"use strict";

const { json, readJsonBody } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const { record: recordActivity } = require("../lib/activity");

const ALLOWED_CATEGORIES = ["colors", "typography", "spacing", "radius", "shadow", "container"];

function register(router) {
  router.get("/_cms/api/design-tokens", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const tokens = await ctx.db.tokensDoc.read();
    return json(res, 200, { tokens });
  });

  router.patch("/_cms/api/design-tokens", requireRole("admin"), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 32 * 1024);
    } catch {
      return json(res, 400, { error: "Malformed request." });
    }

    const tokens = await ctx.db.tokensDoc.update((current) => {
      const next = { ...current };
      for (const category of ALLOWED_CATEGORIES) {
        if (body[category] && typeof body[category] === "object") {
          next[category] = { ...next[category], ...sanitizeShallow(body[category]) };
        }
      }
      return next;
    });

    await recordActivity(ctx.db, { type: "settings-changed", actor: ctx.user, message: `${ctx.user.username} updated design tokens` });
    return json(res, 200, { tokens });
  });

  router.get("/_cms/api/settings", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const settings = await ctx.db.settingsDoc.read();
    return json(res, 200, { settings });
  });

  router.patch("/_cms/api/settings", requireRole("admin"), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 8 * 1024);
    } catch {
      return json(res, 400, { error: "Malformed request." });
    }
    const settings = await ctx.db.settingsDoc.update((current) => {
      const next = { ...current };
      if (typeof body.siteName === "string") next.siteName = body.siteName.slice(0, 200);
      if (body.breakpoints && typeof body.breakpoints === "object") {
        const tablet = Number(body.breakpoints.tablet);
        const mobile = Number(body.breakpoints.mobile);
        next.breakpoints = {
          tablet: Number.isFinite(tablet) && tablet > 0 ? tablet : current.breakpoints.tablet,
          mobile: Number.isFinite(mobile) && mobile > 0 ? mobile : current.breakpoints.mobile,
        };
      }
      return next;
    });
    await recordActivity(ctx.db, { type: "settings-changed", actor: ctx.user, message: `${ctx.user.username} updated site settings` });
    return json(res, 200, { settings });
  });
}

function sanitizeShallow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.length <= 300) out[k] = v;
  }
  return out;
}

module.exports = { register };
