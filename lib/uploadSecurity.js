"use strict";
/**
 * lib/uploadSecurity.js
 * ---------------------------------------------------------------------------
 * Everything that keeps "let people upload files" from becoming a way to
 * plant executable content on the server:
 *  - filenames are re-derived (basename stripped, random hex prefix, a
 *    tight character allowlist), so a crafted filename can never escape the
 *    uploads directory or collide with another file
 *  - only a fixed extension allowlist is accepted - notably, .html is never
 *    allowed, so nobody can upload same-origin script content that way
 *  - the file's actual bytes are sniffed against known magic numbers for
 *    the image types, so a script renamed to `.png` is rejected rather than
 *    trusted on the strength of its extension alone
 *  - SVG uploads are the one allowed type that can itself contain script,
 *    so they get a defense-in-depth scrub (script tags/handlers/foreignObject
 *    stripped) on top of the CSP headers the server sends for /uploads/*.
 *    This is a pragmatic regex-based scrub, not a full SVG-safe-subset
 *    parser; it meaningfully reduces risk but is a second layer, not the
 *    only one - the response-level CSP sandboxing is the primary defense.
 */

const path = require("path");
const crypto = require("crypto");

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf", ".zip", ".doc", ".docx", ".txt"]);

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
};

function safeUploadName(name) {
  const raw = String(name || "upload");
  const base = path.basename(raw).replace(/[^\w.\-() ]+/g, "_").trim() || "upload";
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;
  return { filename: crypto.randomBytes(8).toString("hex") + "-" + base, ext };
}

const MAGIC_CHECKS = {
  ".png": (buf) => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  ".jpeg": (buf) => MAGIC_CHECKS[".jpg"](buf),
  ".gif": (buf) => buf.length >= 6 && (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a"),
  ".webp": (buf) => buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP",
  ".pdf": (buf) => buf.length >= 4 && buf.toString("ascii", 0, 4) === "%PDF",
};

/** For types we have a known signature for, require the bytes to match.
 *  Types without a check here (svg/zip/doc/docx/txt - text or zip-container
 *  formats too permissive to usefully signature-check) are passed through. */
function bytesMatchExtension(buf, ext) {
  const check = MAGIC_CHECKS[ext];
  if (!check) return true;
  return check(buf);
}

function sanitizeSvg(svgText) {
  return svgText
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "")
    .replace(/xlink:href\s*=\s*["']\s*javascript:[^"']*["']/gi, "")
    .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
}

module.exports = { ALLOWED_EXTENSIONS, MIME_BY_EXT, safeUploadName, bytesMatchExtension, sanitizeSvg };
