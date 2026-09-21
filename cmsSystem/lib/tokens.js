"use strict";
/**
 * lib/tokens.js
 * ---------------------------------------------------------------------------
 * Turns the site's design-token document into a <style> block of CSS custom
 * properties, injected into every page (live and draft) so the tokens are
 * real, load-bearing values rather than decoration in a settings screen.
 *
 * Scope, stated plainly: this makes tokens available as `var(--cms-color-*)`
 * etc. everywhere, and the CMS's own generated styles (see editor's style
 * engine) can bind specific properties on specific elements to a token. It
 * does NOT rewrite a site's pre-existing stylesheet to consume these
 * variables retroactively - safely rewriting arbitrary, unknown CSS for an
 * arbitrary site is not something that can be done reliably in general, so
 * it isn't faked here. New elements/styles created from inside the CMS can
 * reference tokens directly; a site's original hand-written CSS keeps using
 * whatever it already used unless someone edits it to reference a token.
 */

function flattenTokens(tokens) {
  const vars = {};
  for (const [category, values] of Object.entries(tokens || {})) {
    if (!values || typeof values !== "object") continue;
    for (const [key, value] of Object.entries(values)) {
      if (value == null || value === "") continue;
      vars[`--cms-${category}-${kebab(key)}`] = String(value);
    }
  }
  return vars;
}

function kebab(str) {
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function renderTokensStyleBlock(tokens) {
  const vars = flattenTokens(tokens);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${escapeCssValue(v)};`);
  return `<style id="cms-tokens">\n:root {\n${lines.join("\n")}\n}\n</style>`;
}

function escapeCssValue(v) {
  // Values here are author-supplied via the CMS's own token editor (hex
  // colors, font stacks, px/rem sizes) - not arbitrary HTML - but we still
  // refuse to let a value break out of the style tag.
  return String(v).replace(/<\/style/gi, "<\\/style");
}

module.exports = { flattenTokens, renderTokensStyleBlock };
