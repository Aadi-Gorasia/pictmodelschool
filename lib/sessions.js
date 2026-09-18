"use strict";
/**
 * lib/sessions.js
 * ---------------------------------------------------------------------------
 * Server-side sessions. The cookie holds nothing but an opaque random token;
 * all session state (who, when, expiry) lives server-side in the store. This
 * means there is no signing secret to manage/rotate/lose, and a session can
 * be revoked instantly by deleting its record (e.g. on logout, or when an
 * admin changes a user's password).
 */

const crypto = require("crypto");

const COOKIE_NAME = "studio_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, sliding
const TOUCH_THRESHOLD_MS = 5 * 60 * 1000; // only persist a sliding-renewal at most every 5 minutes

function makeSessionModule(sessionsCollection) {
  async function create(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = Date.now();
    const record = { token, userId, createdAt: now, lastSeenAt: now, expiresAt: now + SESSION_TTL_MS };
    await sessionsCollection.put(token, record);
    return record;
  }

  async function validate(token) {
    if (!token) return null;
    const record = await sessionsCollection.get(token);
    if (!record) return null;
    const now = Date.now();
    if (record.expiresAt <= now) {
      await sessionsCollection.remove(token);
      return null;
    }
    // Sliding expiration, but don't write to disk on every single request.
    if (now - record.lastSeenAt > TOUCH_THRESHOLD_MS) {
      await sessionsCollection.patch(token, (r) => ({ ...r, lastSeenAt: now, expiresAt: now + SESSION_TTL_MS }));
    }
    return record;
  }

  async function destroy(token) {
    if (!token) return;
    await sessionsCollection.remove(token);
  }

  async function destroyAllForUser(userId) {
    await sessionsCollection.transact((all) => {
      for (const [token, rec] of Object.entries(all)) {
        if (rec.userId === userId) delete all[token];
      }
    });
  }

  async function sweepExpired() {
    const now = Date.now();
    await sessionsCollection.transact((all) => {
      for (const [token, rec] of Object.entries(all)) {
        if (rec.expiresAt <= now) delete all[token];
      }
    });
  }

  return { create, validate, destroy, destroyAllForUser, sweepExpired };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function serializeCookie(name, value, { maxAgeSeconds, secure = false, clear = false } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push("Path=/");
  parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  if (secure) parts.push("Secure");
  if (clear) {
    parts.push("Max-Age=0");
  } else if (maxAgeSeconds) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  return parts.join("; ");
}

function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  makeSessionModule,
  parseCookies,
  serializeCookie,
  getSessionTokenFromRequest,
};
