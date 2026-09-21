"use strict";

const { json } = require("./respond");

function requireAuth(req, res, ctx, next) {
  if (!ctx.user) {
    json(res, 401, { error: "You must be signed in to do that." });
    return;
  }
  return next();
}

function requireRole(role) {
  const roles = Array.isArray(role) ? role : [role];
  return (req, res, ctx, next) => {
    if (!ctx.user) {
      json(res, 401, { error: "You must be signed in to do that." });
      return;
    }
    if (!roles.includes(ctx.user.role)) {
      json(res, 403, { error: `This action requires the ${roles.join(" or ")} role.` });
      return;
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
