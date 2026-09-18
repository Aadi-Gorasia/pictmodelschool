"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { json, readRequestBody } = require("./respond");
const { safeUploadName, bytesMatchExtension, sanitizeSvg, MIME_BY_EXT } = require("../lib/uploadSecurity");
const { readImageDimensions } = require("../lib/imagemeta");
const { newId } = require("../lib/store");
const { record: recordActivity } = require("../lib/activity");

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

async function handleUpload(req, res, ctx) {
  if (!ctx.user) return json(res, 401, { error: "You must be signed in to upload files." });

  let originalName = "";
  try {
    originalName = decodeURIComponent(req.headers["x-filename"] || "");
  } catch {
    return json(res, 400, { error: "Invalid filename header." });
  }

  const named = safeUploadName(originalName);
  if (!named) {
    return json(res, 400, { error: "Unsupported file type. Allowed: images, SVG, PDF, ZIP, DOC/DOCX and TXT." });
  }

  let body;
  try {
    body = await readRequestBody(req, MAX_UPLOAD_SIZE);
  } catch (err) {
    if (err.code === "LIMIT") return json(res, 413, { error: "File is too large. Maximum size is 15MB." });
    throw err;
  }
  if (!body.length) return json(res, 400, { error: "Uploaded file was empty." });

  if (!bytesMatchExtension(body, named.ext)) {
    return json(res, 400, { error: "The file's contents don't match its extension." });
  }

  let finalBuffer = body;
  if (named.ext === ".svg") {
    finalBuffer = Buffer.from(sanitizeSvg(body.toString("utf8")), "utf8");
  }

  const destination = path.join(ctx.uploadDir, named.filename);
  await fsp.mkdir(ctx.uploadDir, { recursive: true });
  await fsp.writeFile(destination, finalBuffer, { flag: "wx" });

  const dims = readImageDimensions(finalBuffer, named.ext);
  const mediaRecord = {
    id: named.filename,
    originalName: path.basename(originalName) || named.filename,
    uploaderId: ctx.user.id,
    uploaderName: ctx.user.username,
    uploadedAt: Date.now(),
    size: finalBuffer.length,
    mime: MIME_BY_EXT[named.ext] || "application/octet-stream",
    width: dims ? dims.width : null,
    height: dims ? dims.height : null,
  };
  await ctx.db.mediaCol.put(mediaRecord.id, mediaRecord);

  await recordActivity(ctx.db, {
    type: "media-uploaded",
    actor: ctx.user,
    message: `${ctx.user.username} uploaded ${mediaRecord.originalName}`,
    meta: { mediaId: mediaRecord.id },
  });

  return json(res, 201, { url: "/uploads/" + encodeURIComponent(named.filename) });
}

module.exports = { handleUpload, MAX_UPLOAD_SIZE };
