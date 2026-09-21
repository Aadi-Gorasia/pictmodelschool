"use strict";

const { json, readJsonBody } = require("../http/respond");
const { serializeCookie, COOKIE_NAME } = require("../lib/sessions");
const users = require("../lib/users");
const loginThrottle = require("../lib/loginThrottle");
const { record: recordActivity } = require("../lib/activity");

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function register(router) {
  router.post("/_cms/api/auth/login", async (req, res, ctx) => {
    let body;
    try {
      body = await readJsonBody(req, 8 * 1024);
    } catch (err) {
      return json(res, 400, { error: err.code === "LIMIT" ? "Request too large." : "Malformed request." });
    }
    const { username, password } = body;
    const ip = clientIp(req);

    const throttleState = loginThrottle.checkLocked(ip, username);
    if (throttleState.locked) {
      return json(res, 429, {
        error: "Too many failed attempts. Please wait before trying again.",
        retryAfterMs: throttleState.retryAfterMs,
      });
    }

    if (!username || !password) {
      return json(res, 400, { error: "Username and password are required." });
    }

    const user = await users.authenticate(ctx.db, username, password);
    if (!user) {
      loginThrottle.recordFailure(ip, username);
      return json(res, 401, { error: "Incorrect username or password." });
    }
    loginThrottle.recordSuccess(ip, username);

    const session = await ctx.db.sessions.create(user.id);
    await recordActivity(ctx.db, {
      type: "login",
      actor: user,
      message: `${user.username} signed in`,
    });

    res.setHeader(
      "Set-Cookie",
      serializeCookie(COOKIE_NAME, session.token, {
        maxAgeSeconds: Math.floor((session.expiresAt - Date.now()) / 1000),
        secure: ctx.config.cookieSecure,
      })
    );
    return json(res, 200, { user: users.toSafeUser(user) });
  });

  router.post("/_cms/api/auth/logout", async (req, res, ctx) => {
    if (ctx.sessionToken) await ctx.db.sessions.destroy(ctx.sessionToken);
    if (ctx.user) {
      await recordActivity(ctx.db, { type: "logout", actor: ctx.user, message: `${ctx.user.username} signed out` });
    }
    res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, "", { clear: true, secure: ctx.config.cookieSecure }));
    return json(res, 200, { ok: true });
  });

  router.get("/_cms/api/auth/me", async (req, res, ctx) => {
    if (!ctx.user) return json(res, 401, { error: "Not signed in." });
    return json(res, 200, { user: ctx.user });
  });
}

module.exports = { register };
