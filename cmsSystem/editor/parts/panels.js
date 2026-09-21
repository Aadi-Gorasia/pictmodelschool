"use strict";
module.exports = /* js */ `
/* =========================================================================
 * PANELS: Layers tree, command palette, media picker, components
 * =======================================================================*/

Studio.initPanels = function () {
  injectDockButtons();
  buildTreePanel();
  buildCommandPalette();
  wireTopbarButtons();
};

function wireTopbarButtons() {
  var pageSettingsBtn = document.getElementById("cms-page-settings-btn");
  if (pageSettingsBtn) pageSettingsBtn.addEventListener("click", function () { Studio.openPageSettings(); });
}

function injectDockButtons() {
  var dock = document.getElementById("cms-master-dock");
  if (!dock || document.getElementById("cms-browse-toggle")) return;
  var undoBtn = document.getElementById("undo-btn");

  var browse = makeDockButton("cms-browse-toggle", "pointer", "Browse", "Toggle Browse mode - links and navigation work normally.");
  browse.addEventListener("click", function () {
    Studio.setMode(Studio.state.mode === "edit" ? "browse" : "edit");
  });

  var tree = makeDockIconButton("cms-tree-toggle", "panelLeft", "Layers panel (page structure)");
  tree.addEventListener("click", Studio.toggleTree);

  var groupBtn = makeDockIconButton("cms-group-toggle", "box", "Group selected elements");
  groupBtn.addEventListener("click", Studio.groupSelected);

  var components = makeDockIconButton("cms-components-toggle", "puzzle", "Components");
  components.addEventListener("click", Studio.openComponentLibrary);

  var palette = makeDockIconButton("cms-palette-toggle", "command", "Command palette (Ctrl/Cmd+K)");
  palette.addEventListener("click", Studio.toggleCommandPalette);

  [browse, tree, groupBtn, components, palette].forEach(function (b) { dock.insertBefore(b, undoBtn); });
}

function makeDockButton(id, iconName, label, title) {
  var btn = document.createElement("button");
  btn.id = id;
  btn.className = "cms-button secondary";
  btn.style.width = "auto";
  btn.style.minWidth = "84px";
  btn.title = title || label;
  btn.innerHTML = Studio.icon(iconName) + "<span>" + label + "</span>";
  return btn;
}
function makeDockIconButton(id, iconName, title) {
  var btn = document.createElement("button");
  btn.id = id;
  btn.className = "cms-button secondary";
  btn.style.width = "38px";
  btn.style.padding = "0";
  btn.title = title;
  btn.innerHTML = Studio.icon(iconName);
  return btn;
}

/* ---- Layers / tree panel ------------------------------------------------ */

function buildTreePanel() {
  var panel = document.createElement("div");
  panel.id = "cms-tree-panel";
  panel.innerHTML =
    '<div class="cms-tree-header"><strong>Page structure</strong><button class="cms-icon-button" id="cms-tree-close" aria-label="Close">' + Studio.icon("x") + "</button></div>" +
    '<div class="cms-tree-tools"><input id="cms-tree-search" class="cms-input" placeholder="Search elements..."></div>' +
    '<div id="cms-tree-list"></div>';
  Studio.el.editor.appendChild(panel);
  panel.querySelector("#cms-tree-close").addEventListener("click", function () { panel.classList.remove("active"); });
  panel.querySelector("#cms-tree-search").addEventListener("input", Studio.refreshTree);
}

Studio.toggleTree = function () {
  var panel = document.getElementById("cms-tree-panel");
  panel.classList.toggle("active");
  if (panel.classList.contains("active")) Studio.refreshTree();
};

function depthOf(el) {
  var d = 0;
  var p = el.parentElement;
  while (p && p !== Studio.el.contentRoot.parentElement) {
    if (!Studio.isEditorNode(p)) d++;
    p = p.parentElement;
  }
  return d;
}

function treeLabel(el) {
  var name = el.getAttribute("data-cms-name");
  if (name) return name;
  if (el.id) return "#" + el.id;
  var text = el.children.length === 0 ? (el.textContent || "").trim() : "";
  if (text) return text.slice(0, 34);
  return el.tagName.toLowerCase();
}

function escapeHtmlText(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Studio.refreshTree = function () {
  var list = document.getElementById("cms-tree-list");
  if (!list) return;
  var query = (document.getElementById("cms-tree-search").value || "").toLowerCase();
  list.innerHTML = "";

  var nodes = Array.from(Studio.el.contentRoot.querySelectorAll("*")).filter(function (el) { return Studio.isEditableElement(el) && el.tagName !== "BR"; });

  nodes.forEach(function (el) {
    var text = [el.tagName.toLowerCase(), el.id, el.className, el.children.length === 0 ? el.textContent : ""].join(" ").toLowerCase();
    if (query && text.indexOf(query) === -1) return;

    var item = document.createElement("div");
    item.className = "cms-tree-item";
    item.draggable = true;
    item.dataset.cmsId = Studio.ensureId(el);
    var locked = el.getAttribute("data-cms-locked") === "true";
    var hidden = Studio.isHiddenOnBreakpoint(el, "desktop");

    item.innerHTML =
      '<span class="cms-tree-indent">' + "\\u203A".repeat(Math.min(depthOf(el), 6)) + "</span>" +
      '<span class="cms-tree-tag">&lt;' + el.tagName.toLowerCase() + "&gt;</span>" +
      '<span class="cms-tree-name">' + escapeHtmlText(treeLabel(el)) + "</span>" +
      '<button class="cms-tree-icon-btn" data-tree-action="hide" title="Hide/show">' + Studio.icon(hidden ? "eyeOff" : "eye") + "</button>" +
      '<button class="cms-tree-icon-btn" data-tree-action="lock" title="Lock/unlock">' + Studio.icon(locked ? "lock" : "unlock") + "</button>";

    if (el === Studio.state.selected) item.classList.add("active");

    item.addEventListener("click", function (e) {
      if (e.target.closest("[data-tree-action]")) return;
      Studio.select(el);
      Studio.openSidebar();
    });

    item.querySelector('[data-tree-action="hide"]').addEventListener("click", function (e) {
      e.stopPropagation();
      Studio.setHiddenOnBreakpoint(el, "desktop", !hidden);
      Studio.refreshTree();
    });
    item.querySelector('[data-tree-action="lock"]').addEventListener("click", function (e) {
      e.stopPropagation();
      if (locked) el.removeAttribute("data-cms-locked"); else el.setAttribute("data-cms-locked", "true");
      Studio.refreshTree();
    });

    item.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/cms-id", item.dataset.cmsId);
      e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragover", function (e) {
      e.preventDefault();
      item.classList.add("cms-drop-target");
    });
    item.addEventListener("dragleave", function () { item.classList.remove("cms-drop-target"); });
    item.addEventListener("drop", function (e) {
      e.preventDefault();
      item.classList.remove("cms-drop-target");
      var draggedId = e.dataTransfer.getData("text/cms-id");
      if (!draggedId || draggedId === item.dataset.cmsId) return;
      var draggedEl = Studio.el.contentRoot.querySelector('[data-cms-id="' + Studio.cssEscapeId(draggedId) + '"]');
      if (!draggedEl || draggedEl.parentElement !== el.parentElement) {
        Studio.showToast("Drag-reorder currently works within the same parent container.");
        return;
      }
      Studio.pushHistory();
      el.parentElement.insertBefore(draggedEl, el);
      Studio.markDirty();
      Studio.refreshTree();
      Studio.positionContextBar();
    });

    list.appendChild(item);
  });
  Studio.iconRefresh();
};

Studio.setTreeSelection = function (el) {
  var list = document.getElementById("cms-tree-list");
  if (!list) return;
  Array.from(list.children).forEach(function (item) {
    item.classList.toggle("active", el && item.dataset.cmsId === el.getAttribute("data-cms-id"));
  });
};

/* ---- Command palette ------------------------------------------------------ */

function buildCommandPalette() {
  var overlay = document.createElement("div");
  overlay.id = "cms-command-palette";
  overlay.innerHTML =
    '<div class="cms-palette-box">' +
    '<input id="cms-palette-input" class="cms-input" placeholder="Type a command...">' +
    '<div id="cms-palette-list"></div>' +
    "</div>";
  Studio.el.editor.appendChild(overlay);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) Studio.toggleCommandPalette(); });

  var input = overlay.querySelector("#cms-palette-input");
  input.addEventListener("input", function () { renderPaletteResults(input.value); });
  input.addEventListener("keydown", function (e) {
    var list = overlay.querySelector("#cms-palette-list");
    var items = Array.from(list.children);
    var activeIdx = items.findIndex(function (i) { return i.classList.contains("active"); });
    if (e.key === "ArrowDown") { e.preventDefault(); setActivePaletteItem(items, Math.min(items.length - 1, activeIdx + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivePaletteItem(items, Math.max(0, activeIdx - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); var active = items[activeIdx] || items[0]; if (active) active.click(); }
  });
}

function setActivePaletteItem(items, idx) {
  items.forEach(function (i, n) { i.classList.toggle("active", n === idx); });
  if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
}

function paletteCommands() {
  var cmds = [
    { label: "Save draft", icon: "check", run: function () { Studio.saveDraft(); } },
    { label: "Publish", icon: "globe", run: function () { Studio.publishPage(); } },
    { label: "Undo", icon: "undo", run: function () { document.getElementById("undo-btn").click(); } },
    { label: "Redo", icon: "redo", run: function () { document.getElementById("redo-btn").click(); } },
    { label: "Toggle Layers panel", icon: "panelLeft", run: Studio.toggleTree },
    { label: "Toggle Browse mode", icon: "pointer", run: function () { document.getElementById("cms-browse-toggle").click(); } },
    { label: "Open Page settings & SEO", icon: "globe", run: function () { Studio.openPageSettings(); } },
    { label: "Open Components library", icon: "puzzle", run: Studio.openComponentLibrary },
    { label: "Open Media library", icon: "image", run: function () { Studio.openMediaPicker(function (url) { navigator.clipboard && navigator.clipboard.writeText(location.origin + url).catch(function () {}); Studio.showToast("Copied URL: " + url); }); } },
    { label: "View all pages (dashboard)", icon: "layers", run: function () { window.open("/_cms/pages", "_blank"); } },
    { label: "View version history", icon: "clock", run: function () { window.open("/_cms/versions?path=" + encodeURIComponent(Studio.config.relPath), "_blank"); } },
    { label: "Insert heading", icon: "type", run: function () { Studio.addNewElement("h1"); } },
    { label: "Insert paragraph", icon: "type", run: function () { Studio.addNewElement("p"); } },
    { label: "Insert image", icon: "image", run: function () { Studio.addNewElement("img"); } },
    { label: "Insert button/link", icon: "link", run: function () { Studio.addNewElement("a"); } },
    { label: "Insert container", icon: "box", run: function () { Studio.addNewElement("div"); } },
    { label: "Group selected elements", icon: "box", run: Studio.groupSelected },
    { label: "Duplicate selected element", icon: "copy", run: function () { if (Studio.state.selected) Studio.duplicateElement(); } },
    { label: "Delete selected element", icon: "trash", run: function () { if (Studio.state.selected) Studio.deleteElement(); } },
    { label: "Copy element", icon: "copy", run: Studio.copyElement },
    { label: "Paste element", icon: "copy", run: Studio.pasteElement },
    { label: "Save selection as component", icon: "puzzle", run: Studio.saveSelectionAsComponent },
    { label: "Update other instances of this component (this page)", icon: "puzzle", run: Studio.updateComponentInstances },
  ];
  return cmds;
}

function renderPaletteResults(query) {
  var list = document.getElementById("cms-palette-list");
  list.innerHTML = "";
  var q = query.trim().toLowerCase();
  var cmds = paletteCommands().filter(function (c) { return !q || c.label.toLowerCase().indexOf(q) !== -1; });
  cmds.forEach(function (cmd, idx) {
    var item = document.createElement("button");
    item.type = "button";
    item.className = "cms-palette-item" + (idx === 0 ? " active" : "");
    item.innerHTML = Studio.icon(cmd.icon) + "<span>" + escapeHtmlText(cmd.label) + "</span>";
    item.addEventListener("click", function () {
      Studio.toggleCommandPalette();
      cmd.run();
    });
    list.appendChild(item);
  });
  if (!cmds.length) {
    var empty = document.createElement("div");
    empty.className = "cms-palette-empty";
    empty.textContent = "No matching commands.";
    list.appendChild(empty);
  }
}

Studio.commandPaletteOpen = function () {
  var el = document.getElementById("cms-command-palette");
  return el && el.classList.contains("active");
};

Studio.toggleCommandPalette = function () {
  var overlay = document.getElementById("cms-command-palette");
  var opening = !overlay.classList.contains("active");
  overlay.classList.toggle("active", opening);
  if (opening) {
    var input = document.getElementById("cms-palette-input");
    input.value = "";
    renderPaletteResults("");
    setTimeout(function () { input.focus(); }, 10);
  }
};

/* ---- Media picker --------------------------------------------------------- */

Studio.openMediaPicker = async function (onPick) {
  var overlay = document.createElement("div");
  overlay.className = "cms-modal-overlay";
  var modal = document.createElement("div");
  modal.className = "cms-modal cms-modal-wide";
  modal.innerHTML = "<h3>" + Studio.icon("image") + " Media library</h3><div class=\\"cms-media-grid\\">Loading...</div>";
  overlay.appendChild(modal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  Studio.el.editor.appendChild(overlay);

  try {
    var res = await fetch("/_cms/api/media");
    var data = await res.json();
    var grid = modal.querySelector(".cms-media-grid");
    grid.innerHTML = "";
    if (!data.media || !data.media.length) {
      grid.innerHTML = '<p class="cms-help">No uploads yet. Use the upload button in an image field first.</p>';
      return;
    }
    data.media.forEach(function (item) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "cms-media-card";
      var isImage = item.mime && item.mime.indexOf("image/") === 0;
      card.innerHTML = isImage
        ? '<img src="' + item.url + '" alt="">'
        : '<div class="cms-media-file-icon">' + Studio.icon("fileCode") + "</div>";
      card.innerHTML += '<span>' + escapeHtmlText(item.originalName) + "</span>";
      card.addEventListener("click", function () {
        onPick(item.url);
        overlay.remove();
      });
      grid.appendChild(card);
    });
    Studio.iconRefresh();
  } catch (err) {
    modal.querySelector(".cms-media-grid").innerHTML = '<p class="cms-help">Could not load media library.</p>';
  }
};

/* ---- Components ------------------------------------------------------------ */

Studio.saveSelectionAsComponent = async function () {
  var el = Studio.state.selected;
  if (!el) { Studio.showToast("Select an element first"); return; }
  var name = window.prompt("Name this component:", el.tagName.toLowerCase() + " component");
  if (!name) return;

  var ids = [el.getAttribute("data-cms-id")].concat(Array.from(el.querySelectorAll("[data-cms-id]")).map(function (n) { return n.getAttribute("data-cms-id"); }));
  var componentId = "comp" + Math.random().toString(36).slice(2, 9);
  el.setAttribute("data-cms-component-id", componentId);

  var styleEntries = {};
  ids.forEach(function (id) { if (id && Studio.styleData.elements[id]) styleEntries[id] = Studio.styleData.elements[id]; });

  try {
    var res = await fetch("/_cms/api/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, html: el.outerHTML, styleEntries: styleEntries }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save component.");
    Studio.markDirty();
    Studio.showToast('Saved component "' + name + '"', "success");
  } catch (err) {
    Studio.showToast(err.message, "error");
  }
};

Studio.openComponentLibrary = async function () {
  var overlay = document.createElement("div");
  overlay.className = "cms-modal-overlay";
  var modal = document.createElement("div");
  modal.className = "cms-modal cms-modal-wide";
  modal.innerHTML = "<h3>" + Studio.icon("puzzle") + " Components</h3><div class=\\"cms-help\\">Insert a saved section. With a component instance selected, use \\u201cUpdate other instances\\u201d from the command palette to push its current styling to matching instances on THIS page.</div><div class=\\"cms-component-list\\">Loading...</div>";
  overlay.appendChild(modal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  Studio.el.editor.appendChild(overlay);

  try {
    var res = await fetch("/_cms/api/components");
    var data = await res.json();
    var list = modal.querySelector(".cms-component-list");
    list.innerHTML = "";
    if (!data.components || !data.components.length) {
      list.innerHTML = '<p class="cms-help">No components saved yet. Select an element and run "Save selection as component" from the command palette.</p>';
      return;
    }
    data.components.forEach(function (comp) {
      var row = document.createElement("div");
      row.className = "cms-component-row";
      row.innerHTML = "<span>" + escapeHtmlText(comp.name) + "</span>";
      var insertBtn = document.createElement("button");
      insertBtn.className = "cms-button secondary";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", function () {
        insertComponent(comp);
        overlay.remove();
      });
      row.appendChild(insertBtn);
      list.appendChild(row);
    });
  } catch (err) {
    modal.querySelector(".cms-component-list").innerHTML = '<p class="cms-help">Could not load components.</p>';
  }
};

function insertComponent(comp) {
  var wrapper = document.createElement("div");
  wrapper.innerHTML = comp.html;
  var el = wrapper.firstElementChild;
  if (!el) return;
  Studio.pushHistory();
  var oldIds = Object.keys(comp.styleEntries || {});
  Studio.assignFreshIds(el, false);
  var newIds = [el.getAttribute("data-cms-id")].concat(Array.from(el.querySelectorAll("[data-cms-id]")).map(function (n) { return n.getAttribute("data-cms-id"); }));
  oldIds.forEach(function (oldId, idx) {
    if (newIds[idx]) Studio.styleData.elements[newIds[idx]] = JSON.parse(JSON.stringify(comp.styleEntries[oldId]));
  });
  var sel = Studio.state.selected;
  if (sel && sel.parentNode && Studio.el.contentRoot.contains(sel)) sel.after(el);
  else Studio.el.contentRoot.appendChild(el);
  Studio.select(el);
  Studio.refreshStylesheet();
  Studio.markDirty();
  Studio.showToast("Component inserted");
  if (Studio.refreshTree) Studio.refreshTree();
}

Studio.updateComponentInstances = function () {
  var el = Studio.state.selected;
  var componentId = el && el.getAttribute("data-cms-component-id");
  if (!componentId) { Studio.showToast("This element isn't a component instance."); return; }
  var others = Array.from(Studio.el.contentRoot.querySelectorAll('[data-cms-component-id="' + componentId + '"]')).filter(function (n) { return n !== el; });
  if (!others.length) { Studio.showToast("No other instances of this component are on this page."); return; }
  Studio.pushHistory();
  others.forEach(function (other) {
    var clone = el.cloneNode(true);
    clone.classList.remove("cms-selected-element", "cms-multi-selected");
    var oldIds = [other.getAttribute("data-cms-id")].concat(Array.from(other.querySelectorAll("[data-cms-id]")).map(function (n) { return n.getAttribute("data-cms-id"); }));
    oldIds.forEach(function (id) { if (id) delete Studio.styleData.elements[id]; });
    Studio.assignFreshIds(clone, true);
    other.replaceWith(clone);
  });
  Studio.refreshStylesheet();
  Studio.markDirty();
  Studio.showToast("Updated " + others.length + " other instance(s) on this page");
  if (Studio.refreshTree) Studio.refreshTree();
};
`;
