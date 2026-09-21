"use strict";
module.exports = /* js */ `
/* =========================================================================
 * CORE: selection, history, save/publish, browse mode, shortcuts
 * =======================================================================*/

Studio.state = {
  mode: "edit",            // "edit" | "browse"
  selected: null,          // primary selected element
  multi: [],               // additional multi-selected elements (shift-click)
  breakpoint: "desktop",   // "desktop" | "tablet" | "mobile" - which tab the inspector edits
  styleTab: "base",        // "base" | "hover" | "focus" | "active"
  dirty: false,
  isRestoring: false,
  history: [],
  historyIndex: -1,
  historyTimer: null,
  stamp: null,             // concurrency stamp from the last successful load/save
  clipboardElement: null,  // {html, styleEntry} for copy/paste element
  clipboardStyles: null,   // style entry for copy/paste styles
};

Studio.isEditorNode = function (node) {
  return !!node && (node === Studio.el.editor || Studio.el.editor.contains(node));
};

Studio.isEditableElement = function (node) {
  if (!node || node.nodeType !== 1) return false;
  if (Studio.isEditorNode(node)) return false;
  if (node !== Studio.el.contentRoot && !Studio.el.contentRoot.contains(node)) return false;
  if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return false;
  return true;
};

Studio.isLocked = function (node) {
  if (!node) return false;
  const lockedAncestor = node.closest && node.closest('[data-cms-locked="true"]');
  return !!(lockedAncestor && Studio.el.contentRoot.contains(lockedAncestor));
};

function cssEscapeId(id) {
  if (window.CSS && CSS.escape) return CSS.escape(id);
  return String(id).replace(/([^\\w-])/g, "\\\\$1");
}
Studio.cssEscapeId = cssEscapeId;

Studio.ensureId = function (el) {
  let id = el.getAttribute("data-cms-id");
  if (!id) {
    id = "el" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
    el.setAttribute("data-cms-id", id);
  }
  return id;
};

/* -------------------------------------------------------------------------
 * Content root: everything that belongs to the WEBSITE (not the editor UI)
 * lives inside #cms-content-root. History snapshots, publishing, and the
 * responsive-preview container-query trick all key off this one element.
 * On a page that's never been edited before, we create it by adopting the
 * page's existing body children; on later loads it already exists because
 * it was saved as part of the draft/live HTML.
 * -----------------------------------------------------------------------*/
function ensureContentRoot() {
  let root = document.getElementById("cms-content-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "cms-content-root";
  const originalChildren = Array.from(document.body.children).filter((el) => el !== Studio.el.editor);
  const anchor = originalChildren[0] || Studio.el.editor;
  document.body.insertBefore(root, anchor);
  for (const child of originalChildren) root.appendChild(child);
  return root;
}

function showToast(message, type) {
  const toast = Studio.el.toast;
  clearTimeout(Studio._toastTimer);
  toast.textContent = message;
  toast.className = "show " + (type || "");
  Studio._toastTimer = setTimeout(() => (toast.className = ""), 3200);
}
Studio.showToast = showToast;

function markDirty() {
  if (Studio.state.isRestoring) return;
  Studio.state.dirty = true;
  Studio.el.saveStatus.textContent = "Unsaved changes";
}
Studio.markDirty = markDirty;

/* -------------------------------------------------------------------------
 * History (undo/redo).
 *
 * BUG FIX vs. the original prototype: the original snapshotted
 * document.body.innerHTML, which INCLUDED the editor's own wrapper div.
 * Restoring a snapshot therefore replaced the editor's own DOM nodes via
 * innerHTML - and scripts inserted via innerHTML never execute, so the
 * editor's own buttons silently stopped responding after the very first
 * undo (cached references like saveBtn/contextBar/toast pointed at
 * detached nodes with no listeners). Snapshots here are scoped to
 * #cms-content-root's children ONLY, so the editor chrome is never
 * touched by undo/redo.
 * -----------------------------------------------------------------------*/
function snapshot() {
  let out = "";
  for (const node of Studio.el.contentRoot.children) out += node.outerHTML;
  return out;
}

function restoreSnapshot(htmlStr) {
  Studio.state.isRestoring = true;
  const selectedId = Studio.state.selected ? Studio.state.selected.getAttribute("data-cms-id") : null;

  Studio.deselectAll();
  Studio.el.contentRoot.innerHTML = htmlStr;

  if (selectedId) {
    const found = Studio.el.contentRoot.querySelector('[data-cms-id="' + cssEscapeId(selectedId) + '"]');
    if (found) Studio.select(found);
  }

  Studio.state.isRestoring = false;
  Studio.refreshStylesheet();
  updateHistoryButtons();
  markDirty();
  if (Studio.refreshTree) Studio.refreshTree();
}

function pushHistory() {
  if (Studio.state.isRestoring) return;
  const current = snapshot();
  if (Studio.state.history[Studio.state.historyIndex] === current) return;
  Studio.state.history = Studio.state.history.slice(0, Studio.state.historyIndex + 1);
  Studio.state.history.push(current);
  if (Studio.state.history.length > 60) Studio.state.history.shift();
  Studio.state.historyIndex = Studio.state.history.length - 1;
  updateHistoryButtons();
  markDirty();
}
Studio.pushHistory = pushHistory;

function scheduleHistory() {
  clearTimeout(Studio.state.historyTimer);
  Studio.state.historyTimer = setTimeout(pushHistory, 350);
}
Studio.scheduleHistory = scheduleHistory;

function updateHistoryButtons() {
  Studio.el.undoBtn.disabled = Studio.state.historyIndex <= 0;
  Studio.el.redoBtn.disabled = Studio.state.historyIndex >= Studio.state.history.length - 1;
}

function undo() {
  if (Studio.state.historyIndex <= 0) return;
  Studio.state.historyIndex--;
  restoreSnapshot(Studio.state.history[Studio.state.historyIndex]);
}
function redo() {
  if (Studio.state.historyIndex >= Studio.state.history.length - 1) return;
  Studio.state.historyIndex++;
  restoreSnapshot(Studio.state.history[Studio.state.historyIndex]);
}

/* -------------------------------------------------------------------------
 * Selection + context bar
 * -----------------------------------------------------------------------*/
function clearOutline(el) {
  el.classList.remove("cms-selected-element", "cms-multi-selected");
}

Studio.deselectAll = function () {
  if (Studio.state.selected) clearOutline(Studio.state.selected);
  Studio.state.multi.forEach(clearOutline);
  Studio.state.selected = null;
  Studio.state.multi = [];
  Studio.el.contextBar.style.display = "none";
  if (Studio.closeSidebar) Studio.closeSidebar();
  if (Studio.setTreeSelection) Studio.setTreeSelection(null);
};

Studio.select = function (el, opts) {
  opts = opts || {};
  if (!Studio.isEditableElement(el)) return;
  if (Studio.isLocked(el)) {
    showToast("That element is locked. Unlock it from the Layers panel to edit it.");
    return;
  }
  if (!opts.additive) {
    Studio.state.multi.forEach(clearOutline);
    Studio.state.multi = [];
  }
  if (Studio.state.selected && Studio.state.selected !== el) clearOutline(Studio.state.selected);

  Studio.ensureId(el);
  Studio.state.selected = el;
  el.classList.add("cms-selected-element");
  positionContextBar();
  updateActionState();
  if (Studio.sidebarOpen && Studio.sidebarOpen()) Studio.updateInspector();
  if (Studio.setTreeSelection) Studio.setTreeSelection(el);
};

Studio.toggleMultiSelect = function (el) {
  if (!Studio.isEditableElement(el) || Studio.isLocked(el)) return;
  if (!Studio.state.selected) {
    Studio.select(el);
    return;
  }
  if (el === Studio.state.selected) return;
  const idx = Studio.state.multi.indexOf(el);
  if (idx >= 0) {
    clearOutline(el);
    Studio.state.multi.splice(idx, 1);
  } else {
    Studio.ensureId(el);
    el.classList.add("cms-multi-selected");
    Studio.state.multi.push(el);
  }
  positionContextBar();
  updateActionState();
};

function allSelected() {
  return Studio.state.selected ? [Studio.state.selected, ...Studio.state.multi] : [];
}
Studio.allSelected = allSelected;

function positionContextBar() {
  const bar = Studio.el.contextBar;
  if (!Studio.state.selected || !document.body.contains(Studio.state.selected)) {
    bar.style.display = "none";
    return;
  }
  bar.classList.toggle("cms-multi-mode", Studio.state.multi.length > 0);
  const rect = Studio.state.selected.getBoundingClientRect();
  const barWidth = Math.min(bar.offsetWidth || 260, window.innerWidth - 16);
  let left = rect.left;
  let top = rect.top - 53;
  left = Math.max(8, Math.min(left, window.innerWidth - barWidth - 8));
  if (top < 8) top = Math.min(window.innerHeight - 54, rect.bottom + 10);
  bar.style.left = left + "px";
  bar.style.top = top + "px";
  bar.style.display = "flex";
}
Studio.positionContextBar = positionContextBar;

function updateActionState() {
  const bar = Studio.el.contextBar;
  const up = bar.querySelector('[data-action="up"]');
  const down = bar.querySelector('[data-action="down"]');
  const sel = Studio.state.selected;
  const inMulti = Studio.state.multi.length > 0;
  up.disabled = inMulti || !sel || !sel.previousElementSibling;
  down.disabled = inMulti || !sel || !sel.nextElementSibling;
  const editBtn = bar.querySelector('[data-action="edit"]');
  if (editBtn) editBtn.style.display = inMulti ? "none" : "";
}

/* -------------------------------------------------------------------------
 * Element operations
 * -----------------------------------------------------------------------*/
function moveElement(direction) {
  const sel = Studio.state.selected;
  if (!sel || !sel.parentElement) return;
  const sibling = direction === "up" ? sel.previousElementSibling : sel.nextElementSibling;
  if (!sibling) return;
  pushHistory();
  if (direction === "up") sel.parentElement.insertBefore(sel, sibling);
  else sel.parentElement.insertBefore(sibling, sel);
  positionContextBar();
  markDirty();
}
Studio.moveElement = moveElement;

function duplicateElement() {
  const sel = Studio.state.selected;
  if (!sel || !sel.parentNode) return;
  pushHistory();
  const clone = sel.cloneNode(true);
  clone.classList.remove("cms-selected-element", "cms-multi-selected");
  assignFreshIds(clone, /*copyStylesFromOriginalTree*/ true);
  sel.after(clone);
  Studio.select(clone);
  Studio.refreshStylesheet();
  markDirty();
  showToast("Duplicated");
  if (Studio.refreshTree) Studio.refreshTree();
}
Studio.duplicateElement = duplicateElement;

// Re-key data-cms-id on a cloned subtree so the copy has independent style
// entries instead of visually fighting over the same selector as the original.
function assignFreshIds(root, copyStyles) {
  const nodes = [root, ...root.querySelectorAll("[data-cms-id]")];
  for (const node of nodes) {
    const oldId = node.getAttribute("data-cms-id");
    if (!oldId) continue;
    const newId = "el" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 99);
    node.setAttribute("data-cms-id", newId);
    if (copyStyles && Studio.styleData.elements[oldId]) {
      Studio.styleData.elements[newId] = JSON.parse(JSON.stringify(Studio.styleData.elements[oldId]));
    }
  }
}
Studio.assignFreshIds = assignFreshIds;

function deleteOne(el) {
  const parent = el.parentNode;
  const next = el.nextElementSibling;
  const id = el.getAttribute("data-cms-id");
  if (id) delete Studio.styleData.elements[id];
  el.remove();
  return { parent, next };
}

function deleteElement() {
  const targets = allSelected();
  if (!targets.length) return;
  if (!window.confirm(targets.length > 1 ? "Delete " + targets.length + " elements? This can be undone with Undo." : "Delete this element? This can be undone with Undo.")) return;
  pushHistory();
  let fallback = null;
  for (const el of targets) {
    if (!el.parentNode) continue;
    fallback = deleteOne(el).next || fallback;
  }
  Studio.deselectAll();
  Studio.refreshStylesheet();
  markDirty();
  showToast(targets.length > 1 ? "Deleted " + targets.length + " elements" : "Element deleted");
  if (Studio.refreshTree) Studio.refreshTree();
}
Studio.deleteElement = deleteElement;

function groupSelected() {
  const targets = allSelected();
  if (targets.length < 2) {
    showToast("Shift-click more than one element first to group them.");
    return;
  }
  const parent = targets[0].parentElement;
  if (!targets.every((el) => el.parentElement === parent)) {
    showToast("Can only group elements that share the same parent right now.");
    return;
  }
  pushHistory();
  const group = document.createElement("div");
  Studio.ensureId(group);
  parent.insertBefore(group, targets[0]);
  targets
    .slice()
    .sort((a, b) => Array.from(parent.children).indexOf(a) - Array.from(parent.children).indexOf(b))
    .forEach((el) => group.appendChild(el));
  Studio.deselectAll();
  Studio.select(group);
  markDirty();
  showToast("Grouped into a container");
  if (Studio.refreshTree) Studio.refreshTree();
}
Studio.groupSelected = groupSelected;

function addNewElement(type) {
  const el = document.createElement(type);
  switch (type) {
    case "h1": el.textContent = "New heading"; break;
    case "h2": el.textContent = "New subheading"; break;
    case "p": el.textContent = "New paragraph text goes here."; break;
    case "img":
      el.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="24">New image</text></svg>');
      el.alt = "New image";
      el.style.maxWidth = "100%";
      break;
    case "a": el.href = "#"; el.textContent = "New link"; break;
    case "button": el.textContent = "Button"; el.setAttribute("type", "button"); break;
    case "hr": break;
    case "div":
      el.style.minHeight = "80px";
      el.style.border = "1px dashed rgba(124,92,255,.4)";
      break;
    case "ul":
      el.innerHTML = "<li>List item one</li><li>List item two</li>";
      break;
  }
  pushHistory();
  Studio.ensureId(el);
  const sel = Studio.state.selected;
  if (sel && sel.parentNode && Studio.el.contentRoot.contains(sel)) sel.after(el);
  else Studio.el.contentRoot.appendChild(el);
  Studio.select(el);
  markDirty();
  showToast("Element inserted");
  if (Studio.refreshTree) Studio.refreshTree();
  if (Studio.updateInspector) Studio.updateInspector();
}
Studio.addNewElement = addNewElement;

/* -------------------------------------------------------------------------
 * Copy / paste (element + styles)
 * -----------------------------------------------------------------------*/
Studio.copyElement = function () {
  const sel = Studio.state.selected;
  if (!sel) return;
  const id = sel.getAttribute("data-cms-id");
  Studio.state.clipboardElement = { html: sel.outerHTML, styleEntry: id ? Studio.styleData.elements[id] : null };
  try { navigator.clipboard && navigator.clipboard.writeText(sel.outerHTML).catch(() => {}); } catch (e) {}
  showToast("Element copied");
};

Studio.pasteElement = function () {
  const clip = Studio.state.clipboardElement;
  if (!clip) { showToast("Nothing copied yet"); return; }
  const wrapper = document.createElement("div");
  wrapper.innerHTML = clip.html;
  const el = wrapper.firstElementChild;
  if (!el) return;
  pushHistory();
  el.removeAttribute("data-cms-id");
  assignFreshIds(el, false);
  const newId = Studio.ensureId(el);
  if (clip.styleEntry) Studio.styleData.elements[newId] = JSON.parse(JSON.stringify(clip.styleEntry));
  const sel = Studio.state.selected;
  if (sel && sel.parentNode && Studio.el.contentRoot.contains(sel)) sel.after(el);
  else Studio.el.contentRoot.appendChild(el);
  Studio.select(el);
  Studio.refreshStylesheet();
  markDirty();
  showToast("Element pasted");
  if (Studio.refreshTree) Studio.refreshTree();
};

Studio.copyStyles = function () {
  const sel = Studio.state.selected;
  if (!sel) return;
  const id = sel.getAttribute("data-cms-id");
  Studio.state.clipboardStyles = id && Studio.styleData.elements[id] ? JSON.parse(JSON.stringify(Studio.styleData.elements[id])) : {};
  showToast("Styles copied");
};

Studio.pasteStyles = function () {
  const sel = Studio.state.selected;
  if (!sel || !Studio.state.clipboardStyles) { showToast("Copy styles from an element first"); return; }
  pushHistory();
  const id = Studio.ensureId(sel);
  const clip = JSON.parse(JSON.stringify(Studio.state.clipboardStyles));
  delete clip.name;
  delete clip.componentId;
  Studio.styleData.elements[id] = { ...(Studio.styleData.elements[id] || {}), ...clip };
  Studio.refreshStylesheet();
  markDirty();
  if (Studio.updateInspector) Studio.updateInspector();
  showToast("Styles pasted");
};

/* -------------------------------------------------------------------------
 * Save / Publish / Preview
 * -----------------------------------------------------------------------*/
function serializeForSave() {
  Studio.syncStyleDataScript();
  const clone = document.documentElement.cloneNode(true);
  const cloneEditor = clone.querySelector("#cms-editor-wrapper");
  if (cloneEditor) cloneEditor.remove();
  clone.querySelectorAll(".cms-selected-element, .cms-multi-selected").forEach((el) => {
    el.classList.remove("cms-selected-element", "cms-multi-selected");
  });
  return "<!DOCTYPE html>\\n" + clone.outerHTML;
}

async function saveDraft(opts) {
  opts = opts || {};
  if (!Studio.state.dirty && !opts.force) {
    if (!opts.silent) showToast("There are no changes to save.");
    return { ok: true, skipped: true };
  }
  const htmlStr = serializeForSave();
  const url = "/_cms/api/drafts?path=" + encodeURIComponent(Studio.config.relPath);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlStr, ifStamp: opts.forceOverwrite ? null : Studio.state.stamp }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 409 && data.conflict) {
      return { ok: false, conflict: true, data };
    }
    if (!resp.ok) throw new Error(data.error || "Save failed.");
    Studio.state.stamp = data.stamp;
    Studio.state.dirty = false;
    Studio.el.saveStatus.textContent = "Saved just now";
    return { ok: true };
  } catch (err) {
    Studio.el.saveStatus.textContent = "Save failed";
    if (!opts.silent) showToast(err.message || "Save failed.", "error");
    return { ok: false, reason: err.message };
  }
}
Studio.saveDraft = saveDraft;

function showConflictDialog(data) {
  const overlay = document.createElement("div");
  overlay.className = "cms-modal-overlay";
  overlay.innerHTML =
    '<div class="cms-modal">' +
    '<h3>' + Studio.icon("alertTriangle") + " Someone else changed this page</h3>" +
    "<p>This page was saved from somewhere else (another tab, or another editor) after you loaded it. Choose how to proceed:</p>" +
    '<div class="cms-modal-actions">' +
    '<button class="cms-button secondary" data-act="reload">Discard my changes &amp; reload theirs</button>' +
    '<button class="cms-button danger" data-act="overwrite">Keep my changes (overwrite theirs)</button>' +
    '<button class="cms-button secondary" data-act="cancel">Cancel</button>' +
    "</div></div>";
  Studio.el.editor.appendChild(overlay);
  overlay.addEventListener("click", async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    if (act === "cancel") { overlay.remove(); return; }
    if (act === "reload") {
      Studio.state.isRestoring = true;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = data.serverHtml;
      const newRoot = wrapper.querySelector("#cms-content-root");
      if (newRoot) Studio.el.contentRoot.replaceWith(newRoot), (Studio.el.contentRoot = newRoot);
      Studio.state.stamp = data.serverStamp;
      Studio.state.isRestoring = false;
      Studio.loadStyleDataFromDom();
      Studio.refreshStylesheet();
      Studio.state.dirty = false;
      Studio.el.saveStatus.textContent = "Reloaded";
      pushHistory();
      showToast("Reloaded the other version");
    }
    if (act === "overwrite") {
      const res = await saveDraft({ forceOverwrite: true });
      if (res.ok) showToast("Your version was saved", "success");
    }
    overlay.remove();
  });
}

async function publishPage() {
  const saveBtn = Studio.el.saveBtn;
  const original = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "Publishing...";
  Studio.el.saveStatus.textContent = "Publishing...";
  try {
    const saveResult = await saveDraft({ force: true, silent: true });
    if (saveResult.conflict) {
      showConflictDialog(saveResult.data);
      return;
    }
    if (!saveResult.ok) throw new Error(saveResult.reason || "Could not save before publishing.");

    const resp = await fetch("/_cms/api/publish?path=" + encodeURIComponent(Studio.config.relPath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Publishing failed.");
    Studio.el.saveStatus.textContent = "Published just now";
    saveBtn.textContent = "Published \u2713";
    showToast("Published as version " + data.version.number, "success");
    setTimeout(() => (saveBtn.textContent = original), 2000);
  } catch (err) {
    Studio.el.saveStatus.textContent = "Publish failed";
    saveBtn.textContent = original;
    showToast(err.message || "Publishing failed.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}
Studio.publishPage = publishPage;

/* -------------------------------------------------------------------------
 * Browse mode
 * -----------------------------------------------------------------------*/
function setMode(mode) {
  Studio.state.mode = mode;
  const btn = document.getElementById("cms-browse-toggle");
  const modePill = document.getElementById("cms-mode-pill");
  if (btn) {
    btn.classList.toggle("active", mode === "browse");
    btn.innerHTML = mode === "browse" ? Studio.icon("pencil") + "<span>Edit</span>" : Studio.icon("pointer") + "<span>Browse</span>";
  }
  if (modePill) {
    modePill.classList.toggle("browse", mode === "browse");
    modePill.querySelector("b").textContent = mode === "browse" ? "Browse" : "Edit";
  }
  if (mode === "browse") Studio.deselectAll();
  showToast(mode === "browse" ? "Browse mode: links and navigation are live" : "Edit mode: select anything on the page");
}
Studio.setMode = setMode;

/* -------------------------------------------------------------------------
 * Topbar positioning: keep the Studio chrome below the site's own header
 * -----------------------------------------------------------------------*/
function positionTopbar() {
  const topbar = Studio.el.topbar;
  if (!topbar) return;
  const candidates = Array.from(document.querySelectorAll("header, nav, [role='banner'], [role='navigation']")).filter(
    (el) => !Studio.isEditorNode(el)
  );
  let offset = window.innerWidth <= 640 ? 8 : 14;
  const visible = candidates
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom > 0 && rect.top < 90 && rect.height > 0)
    .sort((a, b) => b.rect.bottom - a.rect.bottom);
  if (visible.length) offset = Math.max(offset, Math.ceil(visible[0].rect.bottom) + 10);
  topbar.style.setProperty("--cms-topbar-offset", offset + "px");
}
Studio.positionTopbar = positionTopbar;

/* -------------------------------------------------------------------------
 * Keyboard shortcuts. Structural shortcuts (undo/redo/duplicate/delete) are
 * suppressed while focus is inside a real text field so native editing
 * behavior (e.g. the browser's own text-undo) isn't hijacked; Ctrl/Cmd+S
 * always saves the page regardless of focus, matching common app behavior.
 * -----------------------------------------------------------------------*/
function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function bindShortcuts() {
  document.addEventListener("keydown", (event) => {
    const mod = event.ctrlKey || event.metaKey;
    const typing = isTypingContext(document.activeElement);

    if (mod && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (Studio.toggleCommandPalette) Studio.toggleCommandPalette();
      return;
    }
    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveDraft();
      return;
    }
    if (!typing && mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if (!typing && mod && ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y")) {
      event.preventDefault();
      redo();
      return;
    }
    if (!typing && mod && event.key.toLowerCase() === "d" && Studio.state.selected) {
      event.preventDefault();
      duplicateElement();
      return;
    }
    if (!typing && mod && event.key.toLowerCase() === "c" && Studio.state.selected && Studio.state.mode === "edit") {
      Studio.copyElement();
      return;
    }
    if (!typing && mod && event.key.toLowerCase() === "v" && Studio.state.clipboardElement && Studio.state.mode === "edit") {
      Studio.pasteElement();
      return;
    }
    if (!typing && mod && event.key.toLowerCase() === "b") {
      event.preventDefault();
      const btn = document.getElementById("cms-browse-toggle");
      if (btn) btn.click();
      return;
    }
    if (event.key === "Escape") {
      if (Studio.commandPaletteOpen && Studio.commandPaletteOpen()) { Studio.toggleCommandPalette(); return; }
      Studio.closeSidebar && Studio.closeSidebar();
      Studio.deselectAll();
      return;
    }
    if (!typing && event.key === "Delete" && Studio.state.selected) {
      deleteElement();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!Studio.state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

/* -------------------------------------------------------------------------
 * Click / selection binding
 * -----------------------------------------------------------------------*/
function bindSelection() {
  document.addEventListener(
    "click",
    (event) => {
      if (Studio.isEditorNode(event.target)) return;
      if (Studio.state.mode === "browse") return; // hand control back to the real site
      const target = event.target.closest && event.target.closest("*");
      let candidate = target;
      while (candidate && !Studio.isEditableElement(candidate)) candidate = candidate.parentElement;
      if (!candidate) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) Studio.toggleMultiSelect(candidate);
      else Studio.select(candidate);
    },
    true
  );

  document.addEventListener(
    "dblclick",
    (event) => {
      if (Studio.isEditorNode(event.target) || Studio.state.mode === "browse") return;
      const el = Studio.isEditableElement(event.target) ? event.target : event.target.closest && event.target.closest("*");
      if (!el || !Studio.isEditableElement(el) || Studio.isLocked(el)) return;
      if (el.children.length === 0 && el.tagName !== "IMG" && el.tagName !== "HR") {
        const previous = el.getAttribute("contenteditable");
        el.setAttribute("contenteditable", "plaintext-only");
        el.focus();
        const finish = () => {
          if (previous === null) el.removeAttribute("contenteditable");
          else el.setAttribute("contenteditable", previous);
          pushHistory();
          markDirty();
          el.removeEventListener("blur", finish);
        };
        el.addEventListener("blur", finish, { once: true });
      } else if (Studio.openSidebar) {
        Studio.select(el);
        Studio.openSidebar();
      }
    },
    true
  );

  window.addEventListener("scroll", positionContextBar, { passive: true });
  window.addEventListener("resize", () => {
    positionContextBar();
    positionTopbar();
  });

  document.addEventListener(
    "input",
    (event) => {
      if (Studio.isEditorNode(event.target)) return;
      markDirty();
      scheduleHistory();
    },
    true
  );
}

/* -------------------------------------------------------------------------
 * Init
 * -----------------------------------------------------------------------*/
Studio.init = function () {
  Studio.el.editor = document.getElementById("cms-editor-wrapper");
  Studio.el.contentRoot = ensureContentRoot();
  Studio.el.contextBar = document.getElementById("cms-context-bar");
  Studio.el.sidebar = document.getElementById("cms-sidebar");
  Studio.el.backdrop = document.getElementById("cms-sidebar-backdrop");
  Studio.el.controls = document.getElementById("dynamic-controls");
  Studio.el.saveBtn = document.getElementById("save-btn");
  Studio.el.saveStatus = document.getElementById("cms-save-status");
  Studio.el.toast = document.getElementById("cms-toast");
  Studio.el.undoBtn = document.getElementById("undo-btn");
  Studio.el.redoBtn = document.getElementById("redo-btn");
  Studio.el.topbar = document.getElementById("cms-topbar");

  const pageLabel = document.getElementById("cms-current-page");
  if (pageLabel) pageLabel.textContent = "/" + Studio.config.relPath;

  Studio.loadStyleDataFromDom();
  Studio.refreshStylesheet();

  Studio.state.history = [snapshot()];
  Studio.state.historyIndex = 0;
  updateHistoryButtons();

  bindSelection();
  bindShortcuts();

  document.getElementById("close-sidebar").addEventListener("click", () => Studio.closeSidebar());
  Studio.el.backdrop.addEventListener("click", () => Studio.closeSidebar());
  document.getElementById("add-element").addEventListener("click", () => addNewElement(document.getElementById("new-el-type").value));
  Studio.el.saveBtn.addEventListener("click", publishPage);
  Studio.el.undoBtn.addEventListener("click", undo);
  Studio.el.redoBtn.addEventListener("click", redo);

  Studio.el.contextBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case "up": moveElement("up"); break;
      case "down": moveElement("down"); break;
      case "edit": Studio.openSidebar(); break;
      case "duplicate": Studio.state.multi.length ? showToast("Duplicate one element at a time for now") : duplicateElement(); break;
      case "group": groupSelected(); break;
      case "delete": deleteElement(); break;
    }
  });

  requestAnimationFrame(positionTopbar);
  window.addEventListener("load", positionTopbar, { once: true });

  if (Studio.initPanels) Studio.initPanels();
  if (Studio.initInspectorChrome) Studio.initInspectorChrome();

  iconRefresh();
};

function iconRefresh() {
  document.querySelectorAll("#cms-editor-wrapper [data-icon]").forEach((el) => {
    if (!el.dataset.iconDone) {
      el.innerHTML = Studio.icon(el.dataset.icon) + (el.dataset.iconLabel ? "<span>" + el.dataset.iconLabel + "</span>" : "");
      el.dataset.iconDone = "1";
    }
  });
}
Studio.iconRefresh = iconRefresh;
`;
