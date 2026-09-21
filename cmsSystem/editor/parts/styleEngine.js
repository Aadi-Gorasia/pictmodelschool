"use strict";
module.exports = /* js */ `
/* =========================================================================
 * STYLE ENGINE
 *
 * Every visual property the inspector exposes (layout, typography, color,
 * background, borders, shadows, transforms, filters, hover/focus/active
 * states, and desktop/tablet/mobile overrides) is stored here, per element,
 * keyed by that element's stable data-cms-id - never as scattered inline
 * styles. This is rendered to a single real <style> tag on every change,
 * and the exact same renderer runs again right before saving, so what the
 * editor shows is always exactly what gets written to disk.
 *
 * Responsive preview is REAL, not a bordered rectangle: #cms-content-root
 * is a CSS containment context (container-type: inline-size), and
 * tablet/mobile overrides are written as @container rules keyed off THAT
 * container's width. Switching breakpoint tabs resizes the container, so
 * the page genuinely reflows - and because it's a container query (not a
 * viewport media query), the exact same rules also activate correctly for
 * a real visitor on a real small screen after publishing.
 *
 * Two honest limitations worth stating up front:
 *  - the site's own PRE-EXISTING @media rules (if the original HTML had
 *    hand-written responsive CSS) key off actual viewport width, not this
 *    container's width, so they won't react to the in-editor breakpoint
 *    preview (they still work correctly for real visitors on real devices).
 *  - position:fixed elements are always relative to the real browser
 *    viewport, not the resized preview container, so their preview width
 *    may not match a true narrow-device render.
 * =======================================================================*/

var COMPOSED_RENDERERS = {
  transform: function (p) {
    var out = [];
    if (p.translateX || p.translateY) out.push("translate(" + (p.translateX || "0px") + ", " + (p.translateY || "0px") + ")");
    if (p.rotate) out.push("rotate(" + p.rotate + ")");
    if (p.scaleX || p.scaleY) out.push("scale(" + (p.scaleX != null ? p.scaleX : 1) + ", " + (p.scaleY != null ? p.scaleY : 1) + ")");
    if (p.skewX || p.skewY) out.push("skew(" + (p.skewX || "0deg") + ", " + (p.skewY || "0deg") + ")");
    return out.join(" ");
  },
  filter: function (p) {
    var out = [];
    if (p.blur) out.push("blur(" + p.blur + ")");
    if (p.brightness) out.push("brightness(" + p.brightness + ")");
    if (p.contrast) out.push("contrast(" + p.contrast + ")");
    if (p.saturate) out.push("saturate(" + p.saturate + ")");
    if (p.grayscale) out.push("grayscale(" + p.grayscale + ")");
    return out.join(" ") || undefined;
  },
  backdropFilter: function (p) {
    var out = [];
    if (p.blur) out.push("blur(" + p.blur + ")");
    return out.join(" ") || undefined;
  },
  boxShadow: function (shadows) {
    if (!Array.isArray(shadows) || !shadows.length) return undefined;
    return shadows
      .map(function (s) {
        return (s.inset ? "inset " : "") + (s.x || "0px") + " " + (s.y || "0px") + " " + (s.blur || "0px") + " " + (s.spread || "0px") + " " + (s.color || "rgba(15,16,22,.25)");
      })
      .join(", ");
  },
  backgroundImage: function (p) {
    if (!p || p.kind === "none") return undefined;
    var layers = [];
    if (p.kind === "gradient") {
      var stops = (p.stops && p.stops.length ? p.stops : [{ color: "#7C5CFF", pos: 0 }, { color: "#22D3EE", pos: 100 }])
        .map(function (s) { return s.color + (s.pos != null ? " " + s.pos + "%" : ""); })
        .join(", ");
      layers.push(p.gradientType === "radial" ? "radial-gradient(" + stops + ")" : "linear-gradient(" + (p.angle != null ? p.angle : 180) + "deg, " + stops + ")");
    }
    if (p.kind === "image" && p.overlayColor) {
      var c = hexToRgba(p.overlayColor, p.overlayOpacity != null ? p.overlayOpacity : 100);
      layers.push("linear-gradient(" + c + ", " + c + ")");
    }
    if (p.kind === "image" && p.imageUrl) layers.push("url(\\"" + String(p.imageUrl).replace(/"/g, "") + "\\")");
    return layers.join(", ") || undefined;
  },
};

function hexToRgba(hex, opacityPct) {
  var h = String(hex || "#000000").replace("#", "");
  if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
  var r = parseInt(h.substring(0, 2), 16) || 0;
  var g = parseInt(h.substring(2, 4), 16) || 0;
  var b = parseInt(h.substring(4, 6), 16) || 0;
  var a = Math.max(0, Math.min(100, opacityPct != null ? opacityPct : 100)) / 100;
  return "rgba(" + r + ", " + g + ", " + b + ", " + a.toFixed(2) + ")";
}
Studio.hexToRgba = hexToRgba;

function kebab(prop) {
  return prop.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function ruleBlock(selector, props) {
  if (!props) return "";
  var lines = [];
  for (var key in props) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    var value = props[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      var renderer = COMPOSED_RENDERERS[key];
      var expanded = renderer ? renderer(value) : undefined;
      if (expanded) lines.push("  " + kebab(key) + ": " + expanded + ";");
      continue;
    }
    lines.push("  " + kebab(key) + ": " + value + ";");
  }
  if (!lines.length) return "";
  return selector + " {\\n" + lines.join("\\n") + "\\n}\\n";
}

function stateBlock(id, level) {
  if (!level) return "";
  var sel = '[data-cms-id="' + id + '"]';
  return ruleBlock(sel, level.base) + ruleBlock(sel + ":hover", level.hover) + ruleBlock(sel + ":focus-visible, " + sel + ":focus", level.focus) + ruleBlock(sel + ":active", level.active);
}

function renderStylesheetText() {
  var data = Studio.styleData || { elements: {} };
  var ids = Object.keys(data.elements || {});
  var css = "";
  var tabletCss = "";
  var mobileCss = "";
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var entry = data.elements[id];
    if (entry.hidden) continue;
    css += stateBlock(id, entry);
    if (entry.tablet) tabletCss += stateBlock(id, entry.tablet);
    if (entry.mobile) mobileCss += stateBlock(id, entry.mobile);
  }
  var bp = data.breakpoints || { tablet: 991, mobile: 640 };
  if (tabletCss.trim()) css += "@container cms-root (max-width: " + bp.tablet + "px) {\\n" + tabletCss + "}\\n";
  if (mobileCss.trim()) css += "@container cms-root (max-width: " + bp.mobile + "px) {\\n" + mobileCss + "}\\n";
  return css;
}
Studio._renderStylesheetText = renderStylesheetText;

Studio.loadStyleDataFromDom = function () {
  var fallback = { breakpoints: (Studio.config && Studio.config.breakpoints) || { tablet: 991, mobile: 640 }, elements: {} };
  var script = document.getElementById("cms-style-data");
  if (!script) {
    Studio.styleData = fallback;
    return;
  }
  try {
    var parsed = JSON.parse(script.textContent || "{}");
    Studio.styleData = { breakpoints: parsed.breakpoints || fallback.breakpoints, elements: parsed.elements || {} };
  } catch (e) {
    Studio.styleData = fallback;
  }
};

Studio.syncStyleDataScript = function () {
  var script = document.getElementById("cms-style-data");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/json";
    script.id = "cms-style-data";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(Studio.styleData);
};

Studio.refreshStylesheet = function () {
  var style = document.getElementById("cms-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "cms-styles";
    document.head.appendChild(style);
  }
  style.textContent = renderStylesheetText();
};

/* ---- read/write helpers used by the inspector ---- */

function getEntry(id) {
  if (!Studio.styleData.elements[id]) Studio.styleData.elements[id] = {};
  return Studio.styleData.elements[id];
}

function levelForWrite(id, breakpoint, styleTab) {
  var entry = getEntry(id);
  if (breakpoint === "desktop") {
    if (!entry[styleTab]) entry[styleTab] = {};
    return entry[styleTab];
  }
  if (!entry[breakpoint]) entry[breakpoint] = {};
  if (!entry[breakpoint][styleTab]) entry[breakpoint][styleTab] = {};
  return entry[breakpoint][styleTab];
}

function levelForRead(id, breakpoint, styleTab) {
  var entry = Studio.styleData.elements[id];
  if (!entry) return null;
  if (breakpoint === "desktop") return entry[styleTab] || null;
  return (entry[breakpoint] && entry[breakpoint][styleTab]) || null;
}

Studio.getStyleValue = function (el, prop) {
  var id = el.getAttribute("data-cms-id");
  if (!id) return undefined;
  var level = levelForRead(id, Studio.state.breakpoint, Studio.state.styleTab);
  return level ? level[prop] : undefined;
};

Studio.setStyleValue = function (el, prop, value) {
  var id = Studio.ensureId(el);
  var level = levelForWrite(id, Studio.state.breakpoint, Studio.state.styleTab);
  if (value === undefined || value === null || value === "") delete level[prop];
  else level[prop] = value;
  Studio.refreshStylesheet();
};

// The value currently in effect one level up the cascade (tablet falls back
// to desktop-of-same-state; mobile falls back to tablet then desktop) -
// used to show "(inherited: 24px)" placeholders and power the reset button.
Studio.getInheritedValue = function (el, prop) {
  var id = el.getAttribute("data-cms-id");
  if (!id) return undefined;
  var entry = Studio.styleData.elements[id];
  if (!entry) return undefined;
  var tab = Studio.state.styleTab;
  if (Studio.state.breakpoint === "mobile") {
    var t = entry.tablet && entry.tablet[tab] && entry.tablet[tab][prop];
    if (t !== undefined) return t;
  }
  if (Studio.state.breakpoint !== "desktop") {
    var d = entry[tab] && entry[tab][prop];
    if (d !== undefined) return d;
  }
  return undefined;
};

Studio.resetStyleValue = function (el, prop) {
  Studio.setStyleValue(el, prop, undefined);
};

Studio.getComposedValue = function (el, composedKey, subKey) {
  var id = el.getAttribute("data-cms-id");
  var level = id ? levelForRead(id, Studio.state.breakpoint, Studio.state.styleTab) : null;
  return level && level[composedKey] ? level[composedKey][subKey] : undefined;
};

Studio.setComposedValue = function (el, composedKey, subKey, value) {
  var id = Studio.ensureId(el);
  var level = levelForWrite(id, Studio.state.breakpoint, Studio.state.styleTab);
  if (!level[composedKey] || typeof level[composedKey] !== "object" || Array.isArray(level[composedKey])) level[composedKey] = {};
  if (value === undefined || value === null || value === "") delete level[composedKey][subKey];
  else level[composedKey][subKey] = value;
  if (!Object.keys(level[composedKey]).length) delete level[composedKey];
  Studio.refreshStylesheet();
};

Studio.getComposedWhole = function (el, composedKey) {
  var id = el.getAttribute("data-cms-id");
  var level = id ? levelForRead(id, Studio.state.breakpoint, Studio.state.styleTab) : null;
  return level ? level[composedKey] : undefined;
};

Studio.setComposedWhole = function (el, composedKey, value) {
  var id = Studio.ensureId(el);
  var level = levelForWrite(id, Studio.state.breakpoint, Studio.state.styleTab);
  if (value === undefined || value === null) delete level[composedKey];
  else level[composedKey] = value;
  Studio.refreshStylesheet();
};

Studio.setHiddenOnBreakpoint = function (el, breakpoint, hidden) {
  var id = Studio.ensureId(el);
  var entry = getEntry(id);
  if (breakpoint === "desktop") {
    if (hidden) entry.base = Object.assign({}, entry.base, { display: "none" });
    else if (entry.base) delete entry.base.display;
  } else {
    if (!entry[breakpoint]) entry[breakpoint] = {};
    if (!entry[breakpoint].base) entry[breakpoint].base = {};
    if (hidden) entry[breakpoint].base.display = "none";
    else delete entry[breakpoint].base.display;
  }
  Studio.refreshStylesheet();
};

Studio.isHiddenOnBreakpoint = function (el, breakpoint) {
  var id = el.getAttribute("data-cms-id");
  var entry = id && Studio.styleData.elements[id];
  if (!entry) return false;
  if (breakpoint === "desktop") return !!(entry.base && entry.base.display === "none");
  return !!(entry[breakpoint] && entry[breakpoint].base && entry[breakpoint].base.display === "none");
};
`;
