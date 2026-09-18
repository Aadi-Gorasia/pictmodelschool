"use strict";

const { json, readJsonBody } = require("../http/respond");
const { requireRole } = require("../http/authGuards");
const users = require("../lib/users");

function register(router) {
  router.get("/_cms/api/users", requireRole("admin"), async (req, res, ctx) => {
    const list = await users.listUsersSafe(ctx.db);
    return json(res, 200, { users: list });
  });

  router.post("/_cms/api/users", requireRole("admin"), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 8 * 1024);
    } catch {
      return json(res, 400, { error: "Malformed request." });
    }
    const result = await users.createUser(ctx.db, body, ctx.user);
    if (!result.ok) return json(res, 400, { error: result.reason });
    return json(res, 201, { user: result.user });
  });

  router.patch("/_cms/api/users/:id", requireRole("admin"), async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 8 * 1024);
    } catch {
      return json(res, 400, { error: "Malformed request." });
    }
    const result = await users.updateUser(ctx.db, req.params.id, body, ctx.user);
    if (!result.ok) return json(res, 400, { error: result.reason });
    return json(res, 200, { user: result.user });
  });

  router.delete("/_cms/api/users/:id", requireRole("admin"), async (req, res, ctx) => {
    const result = await users.deleteUser(ctx.db, req.params.id, ctx.user);
    if (!result.ok) return json(res, 400, { error: result.reason });
    return json(res, 200, { ok: true });
  });
}

module.exports = { register };
