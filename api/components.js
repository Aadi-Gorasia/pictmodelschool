"use strict";

const { json, readJsonBody } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const { newId } = require("../lib/store");
const { record: recordActivity } = require("../lib/activity");

const MAX_COMPONENT_HTML = 256 * 1024;

function register(router) {
  router.get("/_cms/api/components", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    const list = await ctx.db.componentsCol.list();
    list.sort((a, b) => b.createdAt - a.createdAt);
    return json(res, 200, { components: list });
  });

  router.post("/_cms/api/components", requireRole(["admin", "editor"]), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, MAX_COMPONENT_HTML + 32 * 1024);
    } catch (err) {
      if (err.code === "LIMIT") return json(res, 413, { error: "Component markup is too large." });
      return json(res, 400, { error: "Malformed request." });
    }
    if (typeof body.name !== "string" || !body.name.trim()) return json(res, 400, { error: "Give the component a name." });
    if (typeof body.html !== "string" || !body.html.trim()) return json(res, 400, { error: "Component markup was empty." });

    const record = {
      id: newId("comp"),
      name: body.name.trim().slice(0, 120),
      html: body.html,
      styleEntries: body.styleEntries && typeof body.styleEntries === "object" ? body.styleEntries : {},
      createdAt: Date.now(),
      createdBy: ctx.user.username,
    };
    await ctx.db.componentsCol.put(record.id, record);
    await recordActivity(ctx.db, { type: "component-saved", actor: ctx.user, message: `${ctx.user.username} saved component "${record.name}"` });
    return json(res, 201, { component: record });
  });

  router.delete("/_cms/api/components/:id", requireRole("admin"), async (req, res, ctx) => {
    const existed = await ctx.db.componentsCol.remove(req.params.id);
    if (!existed) return json(res, 404, { error: "Component not found." });
    await recordActivity(ctx.db, { type: "component-deleted", actor: ctx.user, message: `${ctx.user.username} deleted a component` });
    return json(res, 200, { ok: true });
  });
}

module.exports = { register };
