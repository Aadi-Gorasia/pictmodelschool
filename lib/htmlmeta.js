"use strict";
/**
 * lib/htmlmeta.js
 * ---------------------------------------------------------------------------
 * String-level HTML helpers. This project intentionally does NOT pull in an
 * HTML parser (jsdom/cheerio) - the browser already has a real DOM and does
 * all structural editing there; the server only ever needs to (a) sanity
 * check that what it's about to write to disk looks like a real HTML
 * document, and (b) inject a couple of well-defined snippets (design-token
 * CSS variables, the editor bundle) at `<head>`/`</body>` boundaries it
 * controls. Regex is the wrong tool for general HTML parsing, but it is a
 * perfectly reliable tool for "does this file start with a doctype" and
 * "insert this string right before the one closing body tag" - problems
 * this module is deliberately scoped to.
 */

const MAX_PAGE_HTML_BYTES = 4 * 1024 * 1024; // 4MB - generous for a hand-built page, guards against runaway payloads

function looksLikeHtmlDocument(html) {
  if (typeof html !== "string") return { ok: false, reason: "Body was not text." };
  if (Buffer.byteLength(html, "utf8") > MAX_PAGE_HTML_BYTES) {
    return { ok: false, reason: `Page is larger than the ${MAX_PAGE_HTML_BYTES / 1024 / 1024}MB limit.` };
  }
  const trimmed = html.trimStart();
  if (!/^<!doctype html>/i.test(trimmed)) {
    return { ok: false, reason: "Document must start with <!DOCTYPE html>." };
  }
  if (!/<html[\s>]/i.test(html) || !/<\/html\s*>/i.test(html)) {
    return { ok: false, reason: "Document is missing a complete <html>...</html> element." };
  }
  if (!/<body[\s>]/i.test(html) || !/<\/body\s*>/i.test(html)) {
    return { ok: false, reason: "Document is missing a complete <body>...</body> element." };
  }
  return { ok: true };
}

/** Defense in depth: strip our own editor wrapper if a client ever sent it along.
 *  The client is expected to strip #cms-editor-wrapper before saving; this is a
 *  belt-and-braces backstop, not the primary mechanism, since general HTML can't
 *  be safely balanced-matched with regex - we only rely on the exact shape we
 *  ourselves inject (wrapper is the last element before the single </body>). */
function stripEditorWrapper(html) {
  if (!/<div id="cms-editor-wrapper"/i.test(html)) return html;
  return html.replace(/<div id="cms-editor-wrapper"[\s\S]*<\/body\s*>/i, "</body>");
}

function stripTempEditorMarkers(html) {
  return html
    .replace(/\sdata-cms-temp-id="[^"]*"/gi, "")
    .replace(/\sclass="([^"]*?)\s*cms-selected-element\s*([^"]*?)"/gi, (m, a, b) => {
      const cls = `${a} ${b}`.trim();
      return cls ? ` class="${cls}"` : "";
    });
}

function insertAfterHeadOpen(html, snippet) {
  const match = html.match(/<head[^>]*>/i);
  if (match) {
    const idx = match.index + match[0].length;
    return html.slice(0, idx) + snippet + html.slice(idx);
  }
  const htmlMatch = html.match(/<html[^>]*>/i);
  if (htmlMatch) {
    const idx = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, idx) + `<head>${snippet}</head>` + html.slice(idx);
  }
  return snippet + html;
}

/** Insert `block` (a complete tag, e.g. a whole <style id="x">...</style>)
 *  right after <head>, OR, if a tag with that same id already exists
 *  anywhere in the document, replace it in place instead of duplicating it.
 *  Used for the design-tokens block, which needs to end up baked into the
 *  saved file (so published pages are portable to any static host and
 *  don't secretly depend on this server staying involved after publish)
 *  while also staying current if the tokens change later and the page is
 *  re-saved or re-served through this server. */
function upsertNamedBlock(html, id, block) {
  const re = new RegExp(`<style[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/style\\s*>`, "i");
  if (re.test(html)) return html.replace(re, block);
  return insertAfterHeadOpen(html, block);
}

function insertBeforeBodyClose(html, snippet) {
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, snippet + "</body>");
  }
  return html + snippet;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim() || null;
}

function extractMetaContent(html, name) {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i");
  const m = html.match(re);
  if (!m) return null;
  const contentMatch = m[0].match(/content=["']([^"']*)["']/i);
  return contentMatch ? contentMatch[1] : null;
}

module.exports = {
  MAX_PAGE_HTML_BYTES,
  looksLikeHtmlDocument,
  stripEditorWrapper,
  stripTempEditorMarkers,
  insertAfterHeadOpen,
  upsertNamedBlock,
  insertBeforeBodyClose,
  extractTitle,
  extractMetaContent,
};
