"use strict";
/**
 * server.js - Studio CMS
 * ---------------------------------------------------------------------------
 * A single Node process, zero npm dependencies. Three things share one HTTP
 * server:
 *   1. /_cms/api/*  and  /upload   - the JSON API (auth-gated per route)
 *   2. /_cms/*                     - the admin dashboard (static HTML/CSS/JS)
 *   3. everything else (GET only)  - the actual website being managed,
 *                                    serving plain live content to the
 *                                    public and the editor only to an
 *                                    authenticated session (see
 *                                    http/staticSite.js for why that
 *                                    distinction matters)
 *
 * Configuration is via environment variables, all optional:
 *   PORT               default 3000
 *   CMS_ROOT           the website's root directory (default ./site)
 *   CMS_DATA_DIR       where users/sessions/versions/drafts live, kept
 *                      completely separate from CMS_ROOT so admin data can
 *                      never be served as a public file (default ./.cms-data)
 *   CMS_COOKIE_SECURE  set to "1" if this is served over HTTPS (e.g. behind
 *                      a reverse proxy) to mark the session cookie Secure.
 *                      Leave unset for plain local HTTP development - a
 *                      Secure cookie is silently dropped by browsers over
 *                      plain HTTP, which would make login appear broken.
 */

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const { createDb } = require("./lib/db");
const { toSafeUser } = require("./lib/users");
const { getSessionTokenFromRequest } = require("./lib/sessions");
const { Router } = require("./http/router");
const respond = require("./http/respond");
const { serveStaticSite } = require("./http/staticSite");
const { handleUpload } = require("./http/uploadRoute");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(process.env.CMS_ROOT || path.join(__dirname, "site"));
const DATA_DIR = path.resolve(process.env.CMS_DATA_DIR || path.join(__dirname, ".cms-data"));
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const ADMIN_DIR = path.join(__dirname, "admin");
const COOKIE_SECURE = process.env.CMS_COOKIE_SECURE === "1";

fs.mkdirSync(ROOT_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = createDb(DATA_DIR);

const router = new Router();
require("./api/auth").register(router);
require("./api/pages").register(router);
require("./api/drafts").register(router);
require("./api/versions").register(router);
require("./api/media").register(router);
require("./api/users").register(router);
require("./api/design").register(router);
require("./api/activity").register(router);
require("./api/components").register(router);
require("./api/stats").register(router);

const ADMIN_PAGE_MAP = {
  "/_cms/dashboard": "dashboard.html",
  "/_cms/pages": "pages.html",
  "/_cms/media": "media.html",
  "/_cms/versions": "versions.html",
  "/_cms/users": "users.html",
  "/_cms/design": "design.html",
  "/_cms/activity": "activity.html",
};

async function buildCtx(req) {
  const token = getSessionTokenFromRequest(req);
  let user = null;
  let sessionToken = null;

  if (token) {
    const session = await db.sessions.validate(token);
    if (session) {
      const userRecord = await db.usersCol.get(session.userId);
      if (userRecord) {
        user = toSafeUser(userRecord);
        sessionToken = token;
      } else {
        await db.sessions.destroy(token); // orphaned session for a deleted user
      }
    }
  }

  return {
    db,
    rootDir: ROOT_DIR,
    dataDir: DATA_DIR,
    uploadDir: UPLOAD_DIR,
    user,
    sessionToken,
    config: { cookieSecure: COOKIE_SECURE },
  };
}

async function sendAdminPage(res, filename) {
  const abs = path.join(ADMIN_DIR, filename);
  const content = await fsp.readFile(abs, "utf8").catch(() => null);
  if (content == null) return respond.html(res, 500, "<h1>Missing admin page: " + filename + "</h1>");
  return respond.html(res, 200, content, { "Cache-Control": "no-store" });
}

const ADMIN_ASSET_TYPES = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

async function serveAdminAsset(req, res, rel) {
  const assetsDir = path.join(ADMIN_DIR, "assets");
  const abs = path.resolve(assetsDir, rel);
  if (abs !== assetsDir && !abs.startsWith(assetsDir + path.sep)) return respond.text(res, 403, "403 Forbidden");
  const stat = await fsp.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) return respond.text(res, 404, "404 Not Found");
  const type = ADMIN_ASSET_TYPES[path.extname(abs)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Cache-Control": "no-cache" });
  fs.createReadStream(abs).pipe(res);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

async function serveAdminDashboard(req, res, ctx, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return respond.text(res, 405, "405 Method Not Allowed");

  if (pathname.startsWith("/_cms/assets/")) {
    return serveAdminAsset(req, res, pathname.slice("/_cms/assets/".length));
  }

  const isLoginPage = pathname === "/_cms" || pathname === "/_cms/" || pathname === "/_cms/login";
  if (isLoginPage) {
    if (ctx.user) return redirect(res, "/_cms/dashboard");
    return sendAdminPage(res, "login.html");
  }

  if (!ctx.user) return redirect(res, "/_cms/login");

  const file = ADMIN_PAGE_MAP[pathname];
  if (!file) return respond.html(res, 404, "<h1>Not found</h1><p><a href=\"/_cms/dashboard\">Back to dashboard</a></p>");
  return sendAdminPage(res, file);
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    req.query = parsed.searchParams;
    const ctx = await buildCtx(req);

    if (parsed.pathname === "/upload" && req.method === "POST") {
      return await handleUpload(req, res, ctx);
    }

    if (parsed.pathname.startsWith("/_cms/api/")) {
      const handled = await router.handle(req, res, ctx, parsed.pathname);
      if (handled) return;
      return respond.json(res, 404, { error: "Not found." });
    }

    if (parsed.pathname === "/_cms" || parsed.pathname.startsWith("/_cms/")) {
      return await serveAdminDashboard(req, res, ctx, parsed.pathname);
    }

    return await serveStaticSite(req, res, ctx, parsed.pathname, respond);
  } catch (err) {
    console.error(err);
    if (err.code === "LIMIT") return respond.json(res, 413, { error: err.message });
    if (!res.headersSent) return respond.json(res, 500, { error: "Internal server error." });
    res.destroy();
  }
});

server.listen(PORT, () => {
  console.log("Studio CMS running at http://localhost:" + PORT);
  console.log("Website root: " + ROOT_DIR);
  console.log("Data dir:     " + DATA_DIR);
  db.usersCol.list().then((users) => {
    if (!users.length) {
      console.log("");
      console.log("No admin account exists yet. Create one with:");
      console.log("  node scripts/create-admin.js");
      console.log("");
    }
  });
});

const sweepTimer = setInterval(() => {
  db.sessions.sweepExpired().catch((err) => console.error("Session sweep failed:", err));
}, 30 * 60 * 1000);
sweepTimer.unref();

module.exports = { server, db };
