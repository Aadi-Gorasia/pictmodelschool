"use strict";
/**
 * editor/buildEditorBundle.js
 * ---------------------------------------------------------------------------
 * Produces the single <div id="cms-editor-wrapper">...</div> string injected
 * before </body> in edit mode. The CSS and JS "parts" are plain Node modules
 * that each export a template-literal string of real CSS/JS - splitting the
 * source across files keeps it readable to maintain, but at request time
 * they're concatenated into one <style> and one <script> so every part
 * shares a single top-level `Studio` namespace object with no module
 * loader or bundler needed at runtime.
 */

const stylesCss = require("./parts/styles.js");
const iconsJs = require("./parts/icons.js");
const coreJs = require("./parts/core.js");
const styleEngineJs = require("./parts/styleEngine.js");
const inspectorJs = require("./parts/inspector.js");
const panelsJs = require("./parts/panels.js");

function escapeHtmlAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function jsStringLiteral(value) {
  return JSON.stringify(String(value));
}

async function buildEditorBundle({ relPath, breakpoints }) {
  const bp = breakpoints || { tablet: 991, mobile: 640 };

  const html = `
<div id="cms-editor-wrapper" aria-label="Studio CMS editor">
<style>${stylesCss}</style>

<div id="cms-sidebar-backdrop" aria-hidden="true"></div>

<div id="cms-topbar">
  <div class="cms-topbar-left">
    <div class="cms-app-mark"><span></span></div>
    <div class="cms-app-title">Studio <small>Visual CMS</small></div>
  </div>
  <div class="cms-page-pill" title="Current page">
    ${"<span data-icon=\"fileCode\"></span>"}
    <span id="cms-current-page">/${escapeHtmlAttr(relPath)}</span>
  </div>
  <button class="cms-topbar-icon-btn" id="cms-page-settings-btn" title="Page settings &amp; SEO" data-icon="globe"></button>
  <div class="cms-mode-pill" id="cms-mode-pill"><span></span><b>Edit</b></div>
</div>

<div id="cms-master-dock">
  <span class="cms-brand">Studio</span>
  <span id="cms-save-status" class="cms-status">Saved</span>
  <div class="cms-divider-v"></div>
  <button class="cms-button secondary" id="undo-btn" title="Undo (Ctrl/Cmd+Z)" style="width:36px;padding:0;" data-icon="undo"></button>
  <button class="cms-button secondary" id="redo-btn" title="Redo (Ctrl/Cmd+Shift+Z)" style="width:36px;padding:0;" data-icon="redo"></button>
  <button class="cms-button" id="save-btn">Publish</button>
</div>

<div id="cms-context-bar" role="toolbar" aria-label="Selected element actions">
  <button class="cms-btn" data-action="up" title="Move up" data-icon="chevronUp"></button>
  <button class="cms-btn" data-action="down" title="Move down" data-icon="chevronDown"></button>
  <div class="cms-divider"></div>
  <button class="cms-btn" data-action="edit" title="Edit properties" data-icon="sliders"></button>
  <button class="cms-btn" data-action="duplicate" title="Duplicate (Ctrl/Cmd+D)" data-icon="copy"></button>
  <button class="cms-btn" data-action="group" title="Group selected" data-icon="box"></button>
  <button class="cms-btn danger" data-action="delete" title="Delete" data-icon="trash"></button>
</div>

<aside id="cms-sidebar" aria-label="Element properties">
  <div class="cms-side-header">
    <div class="cms-side-title">
      <strong id="el-tag-display">Properties</strong>
      <span id="el-selector-display">No element selected</span>
    </div>
    <button class="cms-icon-button" id="close-sidebar" aria-label="Close properties" data-icon="x"></button>
  </div>
  <div class="cms-side-body">
    <section class="cms-group">
      <label class="cms-label" for="new-el-type">Insert element</label>
      <select id="new-el-type" class="cms-select">
        <option value="h1">Heading</option>
        <option value="h2">Subheading</option>
        <option value="p">Paragraph</option>
        <option value="img">Image</option>
        <option value="a">Button / Link</option>
        <option value="button">Button (native)</option>
        <option value="div">Container</option>
        <option value="ul">List</option>
        <option value="hr">Divider</option>
      </select>
      <button class="cms-button secondary" id="add-element" data-icon="plus" data-icon-label="Insert after selected"></button>
      <p class="cms-help">If nothing is selected, the element is inserted at the end of the page.</p>
    </section>
    <div id="dynamic-controls"></div>
  </div>
</aside>

<div id="cms-toast" role="status" aria-live="polite"></div>

<script>
(() => {
  "use strict";
  var Studio = { el: {}, config: { relPath: ${jsStringLiteral(relPath)}, breakpoints: ${JSON.stringify(bp)} } };

  ${iconsJs}
  ${coreJs}
  ${styleEngineJs}
  ${inspectorJs}
  ${panelsJs}

  fetch("/_cms/api/design-tokens").then(function (r) { return r.json(); }).then(function (data) {
    Studio.tokensCache = data.tokens;
    if (Studio.sidebarOpen && Studio.sidebarOpen()) Studio.updateInspector();
  }).catch(function () {});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", Studio.init);
  } else {
    Studio.init();
  }
})();
</script>
</div>`;

  return html;
}

module.exports = { buildEditorBundle };
