"use strict";

function json(res, status, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8", extraHeaders) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function html(res, status, body, extraHeaders) {
  return text(res, status, body, "text/html; charset=utf-8", extraHeaders);
}

async function readRequestBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const err = new Error("Request body is too large.");
      err.code = "LIMIT";
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req, maxBytes) {
  const buf = await readRequestBody(req, maxBytes);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    const err = new Error("Request body was not valid JSON.");
    err.code = "BAD_JSON";
    throw err;
  }
}

module.exports = { json, text, html, readRequestBody, readJsonBody };
