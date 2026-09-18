"use strict";
module.exports = /* js */ `
/* =========================================================================
 * INSPECTOR: breakpoint/state tabs + the property panels themselves
 * =======================================================================*/

Studio.sidebarOpen = function () {
  return Studio.el.sidebar.classList.contains("active");
};

Studio.openSidebar = function () {
  if (!Studio.state.selected) return;
  Studio.el.sidebar.classList.add("active");
  Studio.el.backdrop.classList.add("active");
  Studio.updateInspector();
};

Studio.closeSidebar = function () {
  Studio.el.sidebar.classList.remove("active");
  Studio.el.backdrop.classList.remove("active");
};

/* ---- small field-builder helpers -------------------------------------- */

function group(title, help) {
  var div = document.createElement("div");
  div.className = "cms-group";
  if (title) {
    var lab = document.createElement("label");
    lab.className = "cms-label";
    lab.textContent = title;
    div.appendChild(lab);
  }
  if (help) {
    var p = document.createElement("p");
    p.className = "cms-help";
    p.textContent = help;
    div.appendChild(p);
  }
  return div;
}

function row(children) {
  var div = document.createElement("div");
  div.className = "cms-row";
  children.forEach(function (c) { div.appendChild(c); });
  return div;
}

function labeledInput(labelText, value, onInput, opts) {
  opts = opts || {};
  var wrap = document.createElement("div");
  wrap.className = "cms-field";
  if (labelText) {
    var lab = document.createElement("span");
    lab.className = "cms-field-label";
    lab.textContent = labelText;
    wrap.appendChild(lab);
  }
  var input = document.createElement("input");
  input.className = "cms-input";
  input.type = opts.type || "text";
  if (value !== undefined && value !== null) input.value = value;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.step) input.step = opts.step;
  if (opts.min !== undefined) input.min = opts.min;
  if (opts.max !== undefined) input.max = opts.max;
  input.addEventListener("input", function () { onInput(input.value); });
  wrap.appendChild(input);
  return { wrap: wrap, input: input };
}

function labeledSelect(labelText, value, options, onChange) {
  var wrap = document.createElement("div");
  wrap.className = "cms-field";
  if (labelText) {
    var lab = document.createElement("span");
    lab.className = "cms-field-label";
    lab.textContent = labelText;
    wrap.appendChild(lab);
  }
  var select = document.createElement("select");
  select.className = "cms-select";
  options.forEach(function (opt) {
    var o = document.createElement("option");
    o.value = opt[0];
    o.textContent = opt[1];
    select.appendChild(o);
  });
  select.value = value || options[0][0];
  select.addEventListener("change", function () { onChange(select.value); });
  wrap.appendChild(select);
  return { wrap: wrap, select: select };
}

function styleField(labelText, prop, opts) {
  opts = opts || {};
  var el = Studio.state.selected;
  var current = Studio.getStyleValue(el, prop);
  var inherited = Studio.getInheritedValue(el, prop);
  var built = labeledInput(labelText, current !== undefined ? current : "", function (val) {
    Studio.setStyleValue(el, prop, val);
    if (Studio.state.selected === el) Studio.positionContextBar();
  }, { placeholder: inherited !== undefined ? "inherited: " + inherited : opts.placeholder });
  if (current !== undefined && Studio.state.breakpoint !== "desktop") {
    built.wrap.appendChild(resetButton(function () {
      Studio.resetStyleValue(el, prop);
      Studio.updateInspector();
    }));
  }
  return built.wrap;
}

function resetButton(onClick) {
  var btn = document.createElement("button");
  btn.className = "cms-reset-btn";
  btn.type = "button";
  btn.title = "Reset to inherited value";
  btn.textContent = "\\u21BA";
  btn.addEventListener("click", onClick);
  return btn;
}

function buttonGroup(labelText, value, options, onChange) {
  var wrap = group(labelText);
  var bar = document.createElement("div");
  bar.className = "cms-btn-group";
  options.forEach(function (opt) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt[1];
    btn.className = "cms-seg-btn" + (opt[0] === value ? " active" : "");
    btn.addEventListener("click", function () {
      Array.from(bar.children).forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      onChange(opt[0]);
    });
    bar.appendChild(btn);
  });
  wrap.appendChild(bar);
  return wrap;
}

function colorPickerField(labelText, prop) {
  var el = Studio.state.selected;
  var current = Studio.getStyleValue(el, prop);
  var wrap = group(labelText);
  var row1 = document.createElement("div");
  row1.className = "cms-color-row";

  var swatch = document.createElement("input");
  swatch.type = "color";
  swatch.className = "cms-color-swatch";
  swatch.value = toHexForInput(current) || "#000000";

  var text = document.createElement("input");
  text.className = "cms-input cms-color-text";
  text.value = current || "";
  text.placeholder = "transparent";

  function apply(val) {
    Studio.setStyleValue(el, prop, val);
  }
  swatch.addEventListener("input", function () { text.value = swatch.value; apply(swatch.value); });
  text.addEventListener("input", function () { apply(text.value); if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.value)) swatch.value = text.value; });

  row1.appendChild(swatch);
  row1.appendChild(text);
  wrap.appendChild(row1);

  var tokens = Studio.tokensCache && Studio.tokensCache.colors;
  if (tokens) {
    var swatchRow = document.createElement("div");
    swatchRow.className = "cms-token-swatches";
    Object.keys(tokens).forEach(function (key) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "cms-token-swatch";
      t.title = key;
      t.style.background = tokens[key];
      t.addEventListener("click", function () {
        var varName = "var(--cms-colors-" + key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() + ")";
        text.value = varName;
        apply(varName);
      });
      swatchRow.appendChild(t);
    });
    wrap.appendChild(swatchRow);
  }
  return wrap;
}

function toHexForInput(val) {
  if (!val || val.indexOf("var(") === 0) return null;
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(val)) return val;
  return null;
}

/* ---- box model (margin/padding) with linked sides ---------------------- */

function boxModelEditor(prop) {
  var el = Studio.state.selected;
  var wrap = group(prop === "margin" ? "Margin" : "Padding");
  var sides = ["Top", "Right", "Bottom", "Left"];
  var grid = document.createElement("div");
  grid.className = "cms-box-grid";

  var linked = true;
  var linkBtn = document.createElement("button");
  linkBtn.type = "button";
  linkBtn.className = "cms-link-toggle active";
  linkBtn.title = "Link all sides";
  linkBtn.innerHTML = Studio.icon("link");
  linkBtn.addEventListener("click", function () {
    linked = !linked;
    linkBtn.classList.toggle("active", linked);
  });

  var inputs = sides.map(function (side) {
    var propName = prop + side;
    var current = Studio.getStyleValue(el, propName);
    var input = document.createElement("input");
    input.className = "cms-input cms-box-input";
    input.placeholder = side[0];
    input.value = current !== undefined ? current : "";
    input.title = side;
    input.addEventListener("input", function () {
      if (linked) {
        inputs2.forEach(function (i) { i.value = input.value; });
        sides.forEach(function (s) { Studio.setStyleValue(el, prop + s, input.value); });
      } else {
        Studio.setStyleValue(el, propName, input.value);
      }
      Studio.positionContextBar();
    });
    return input;
  });
  var inputs2 = inputs;

  grid.appendChild(linkBtn);
  inputs.forEach(function (i) { grid.appendChild(i); });
  wrap.appendChild(grid);
  return wrap;
}

/* ---- transform / filter panels ----------------------------------------- */

function transformPanel() {
  var el = Studio.state.selected;
  var wrap = group("Transform");
  var current = Studio.getComposedWhole(el, "transform") || {};
  function field(sub, label, placeholder) {
    return labeledInput(label, current[sub] || "", function (val) {
      Studio.setComposedValue(el, "transform", sub, val);
    }, { placeholder: placeholder }).wrap;
  }
  wrap.appendChild(row([field("translateX", "Move X", "0px"), field("translateY", "Move Y", "0px")]));
  wrap.appendChild(row([field("rotate", "Rotate", "0deg"), field("scaleX", "Scale X", "1")]));
  wrap.appendChild(row([field("scaleY", "Scale Y", "1"), field("skewX", "Skew X", "0deg")]));
  return wrap;
}

function filterPanel() {
  var el = Studio.state.selected;
  var wrap = group("Filters");
  var current = Studio.getComposedWhole(el, "filter") || {};
  function field(sub, label, placeholder) {
    return labeledInput(label, current[sub] || "", function (val) {
      Studio.setComposedValue(el, "filter", sub, val);
    }, { placeholder: placeholder }).wrap;
  }
  wrap.appendChild(row([field("blur", "Blur", "0px"), field("brightness", "Bright.", "1")]));
  wrap.appendChild(row([field("contrast", "Contrast", "1"), field("saturate", "Saturate", "1")]));
  wrap.appendChild(field("grayscale", "Grayscale", "0"));

  var backdrop = Studio.getComposedWhole(el, "backdropFilter") || {};
  wrap.appendChild(labeledInput("Backdrop blur", backdrop.blur || "", function (val) {
    Studio.setComposedValue(el, "backdropFilter", "blur", val);
  }, { placeholder: "0px (glass effect behind element)" }).wrap);
  return wrap;
}

/* ---- box shadow (multi-layer) ------------------------------------------ */

function shadowPanel() {
  var el = Studio.state.selected;
  var wrap = group("Shadow");
  var shadows = Studio.getComposedWhole(el, "boxShadow") || [];
  shadows = shadows.slice();

  function render() {
    var list = wrap.querySelector(".cms-shadow-list");
    if (list) list.remove();
    var listEl = document.createElement("div");
    listEl.className = "cms-shadow-list";
    shadows.forEach(function (s, idx) {
      var item = document.createElement("div");
      item.className = "cms-shadow-item";
      var fields = row([
        labeledInput("X", s.x || "0px", function (v) { s.x = v; commit(); }).wrap,
        labeledInput("Y", s.y || "4px", function (v) { s.y = v; commit(); }).wrap,
      ]);
      var fields2 = row([
        labeledInput("Blur", s.blur || "12px", function (v) { s.blur = v; commit(); }).wrap,
        labeledInput("Spread", s.spread || "0px", function (v) { s.spread = v; commit(); }).wrap,
      ]);
      var colorRow = document.createElement("div");
      colorRow.className = "cms-color-row";
      var swatch = document.createElement("input");
      swatch.type = "color";
      swatch.className = "cms-color-swatch";
      swatch.value = toHexForInput(s.color) || "#000000";
      var text = document.createElement("input");
      text.className = "cms-input";
      text.value = s.color || "rgba(15,16,22,.25)";
      swatch.addEventListener("input", function () { text.value = swatch.value; s.color = swatch.value; commit(); });
      text.addEventListener("input", function () { s.color = text.value; commit(); });
      colorRow.appendChild(swatch);
      colorRow.appendChild(text);

      var insetLabel = document.createElement("label");
      insetLabel.className = "cms-check";
      var insetBox = document.createElement("input");
      insetBox.type = "checkbox";
      insetBox.checked = !!s.inset;
      insetBox.addEventListener("change", function () { s.inset = insetBox.checked; commit(); });
      insetLabel.appendChild(insetBox);
      insetLabel.appendChild(document.createTextNode("Inset"));

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cms-icon-button";
      removeBtn.innerHTML = Studio.icon("trash");
      removeBtn.addEventListener("click", function () {
        shadows.splice(idx, 1);
        commit();
        render();
      });

      var head = document.createElement("div");
      head.className = "cms-shadow-item-head";
      head.appendChild(insetLabel);
      head.appendChild(removeBtn);

      item.appendChild(head);
      item.appendChild(fields);
      item.appendChild(fields2);
      item.appendChild(colorRow);
      listEl.appendChild(item);
    });
    wrap.appendChild(listEl);
  }

  function commit() {
    Studio.setComposedWhole(el, "boxShadow", shadows.length ? shadows : undefined);
  }

  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "cms-button secondary";
  addBtn.textContent = "+ Add shadow layer";
  addBtn.addEventListener("click", function () {
    shadows.push({ x: "0px", y: "4px", blur: "12px", spread: "0px", color: "rgba(15,16,22,.25)" });
    commit();
    render();
  });

  render();
  wrap.appendChild(addBtn);
  return wrap;
}

/* ---- background panel --------------------------------------------------- */

function backgroundPanel() {
  var el = Studio.state.selected;
  var wrap = group("Background");
  var current = Studio.getComposedWhole(el, "backgroundImage") || { kind: "none" };

  wrap.appendChild(colorPickerField("Background color", "backgroundColor"));

  var kindTabs = buttonGroup("Fill type", current.kind || "none", [["none", "None"], ["gradient", "Gradient"], ["image", "Image"]], function (kind) {
    current.kind = kind;
    commitAndRerender();
  });
  wrap.appendChild(kindTabs);

  var sub = document.createElement("div");
  sub.className = "cms-bg-sub";

  function commitAndRerender() {
    Studio.setComposedWhole(el, "backgroundImage", current.kind === "none" ? undefined : current);
    rerenderSub();
  }

  function rerenderSub() {
    sub.innerHTML = "";
    if (current.kind === "gradient") {
      current.stops = current.stops && current.stops.length ? current.stops : [{ color: "#7C5CFF", pos: 0 }, { color: "#22D3EE", pos: 100 }];
      sub.appendChild(buttonGroup("Type", current.gradientType || "linear", [["linear", "Linear"], ["radial", "Radial"]], function (v) { current.gradientType = v; commitAndRerender(); }));
      if (current.gradientType !== "radial") {
        sub.appendChild(labeledInput("Angle", current.angle != null ? current.angle : 180, function (v) { current.angle = Number(v) || 0; commitAndRerender(); }, { type: "number" }).wrap);
      }
      current.stops.forEach(function (stop, idx) {
        var stopRow = document.createElement("div");
        stopRow.className = "cms-color-row";
        var swatch = document.createElement("input");
        swatch.type = "color";
        swatch.className = "cms-color-swatch";
        swatch.value = toHexForInput(stop.color) || "#7c5cff";
        swatch.addEventListener("input", function () { stop.color = swatch.value; commitAndRerender(); });
        var pos = document.createElement("input");
        pos.className = "cms-input";
        pos.type = "number";
        pos.value = stop.pos != null ? stop.pos : 0;
        pos.addEventListener("input", function () { stop.pos = Number(pos.value); commitAndRerender(); });
        stopRow.appendChild(swatch);
        stopRow.appendChild(pos);
        if (current.stops.length > 2) {
          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "cms-icon-button";
          rm.innerHTML = Studio.icon("x");
          rm.addEventListener("click", function () { current.stops.splice(idx, 1); commitAndRerender(); });
          stopRow.appendChild(rm);
        }
        sub.appendChild(stopRow);
      });
      var addStop = document.createElement("button");
      addStop.type = "button";
      addStop.className = "cms-button secondary";
      addStop.textContent = "+ Add color stop";
      addStop.addEventListener("click", function () {
        current.stops.push({ color: "#ffffff", pos: 50 });
        commitAndRerender();
      });
      sub.appendChild(addStop);
    } else if (current.kind === "image") {
      sub.appendChild(labeledInput("Image URL", current.imageUrl || "", function (v) { current.imageUrl = v; commitAndRerender(); }, { placeholder: "https://... or /uploads/..." }).wrap);
      sub.appendChild(mediaPickerButton(function (url) { current.imageUrl = url; commitAndRerender(); }));
      sub.appendChild(buttonGroup("Size", Studio.getStyleValue(el, "backgroundSize") || "cover", [["cover", "Cover"], ["contain", "Contain"], ["auto", "Auto"]], function (v) { Studio.setStyleValue(el, "backgroundSize", v); }));
      sub.appendChild(buttonGroup("Repeat", Studio.getStyleValue(el, "backgroundRepeat") || "no-repeat", [["no-repeat", "No repeat"], ["repeat", "Repeat"]], function (v) { Studio.setStyleValue(el, "backgroundRepeat", v); }));
      sub.appendChild(buttonGroup("Position", Studio.getStyleValue(el, "backgroundPosition") || "center", [["center", "Center"], ["top", "Top"], ["bottom", "Bottom"]], function (v) { Studio.setStyleValue(el, "backgroundPosition", v); }));
      var overlayColorRow = colorPickerFieldForComposed();
      sub.appendChild(overlayColorRow);
    }
  }

  function colorPickerFieldForComposed() {
    var w = group("Overlay tint (optional)");
    var r = document.createElement("div");
    r.className = "cms-color-row";
    var swatch = document.createElement("input");
    swatch.type = "color";
    swatch.className = "cms-color-swatch";
    swatch.value = toHexForInput(current.overlayColor) || "#000000";
    var opacity = document.createElement("input");
    opacity.type = "range";
    opacity.min = 0; opacity.max = 100;
    opacity.value = current.overlayOpacity != null ? current.overlayOpacity : 0;
    swatch.addEventListener("input", function () { current.overlayColor = swatch.value; commitAndRerender(); });
    opacity.addEventListener("input", function () { current.overlayOpacity = Number(opacity.value); current.overlayColor = current.overlayColor || swatch.value; commitAndRerender(); });
    r.appendChild(swatch);
    r.appendChild(opacity);
    w.appendChild(r);
    return w;
  }

  rerenderSub();
  wrap.appendChild(sub);
  return wrap;
}

function mediaPickerButton(onPick) {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cms-button secondary";
  btn.textContent = "Choose from Media Library";
  btn.addEventListener("click", function () {
    if (Studio.openMediaPicker) Studio.openMediaPicker(onPick);
  });
  return btn;
}

/* ---- upload field (img src / a href file) -------------------------------*/

function uploadField(labelText, accept, onUploaded) {
  var wrap = group(labelText);
  var input = document.createElement("input");
  input.type = "file";
  input.className = "cms-input";
  input.accept = accept;
  input.addEventListener("change", async function () {
    var file = input.files && input.files[0];
    if (!file) return;
    input.disabled = true;
    try {
      var res = await fetch("/upload", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onUploaded(data.url);
      Studio.showToast("Upload complete", "success");
      Studio.pushHistory();
      Studio.markDirty();
    } catch (err) {
      Studio.showToast(err.message || "Upload failed", "error");
    } finally {
      input.disabled = false;
      input.value = "";
    }
  });
  wrap.appendChild(input);
  return wrap;
}

/* ---- the main inspector build ------------------------------------------- */

Studio.updateInspector = function () {
  var el = Studio.state.selected;
  var controls = Studio.el.controls;
  controls.innerHTML = "";
  document.getElementById("el-tag-display").textContent = el ? "Editing <" + el.tagName.toLowerCase() + ">" : "Properties";
  document.getElementById("el-selector-display").textContent = el ? describeElement(el) : "No element selected";
  if (!el) return;

  var tag = el.tagName.toLowerCase();

  // Tag-specific content controls first (most relevant to what the user
  // clicked), then the universal style panels, in the order the spec's
  // "smart inspector" describes: content/media first, layout, then
  // everything else, with Advanced always last.
  if (tag === "img") {
    controls.appendChild(labeledInput("Image URL", el.getAttribute("src") || "", function (v) { el.setAttribute("src", v.trim()); Studio.markDirty(); }, { type: "url", placeholder: "https://..." }).wrap);
    controls.appendChild(uploadField("Replace image", "image/png,image/jpeg,image/webp,image/gif,image/svg+xml", function (url) { el.setAttribute("src", url); Studio.updateInspector(); }));
    controls.appendChild(mediaPickerButton(function (url) { el.setAttribute("src", url); Studio.updateInspector(); Studio.markDirty(); Studio.pushHistory(); }));
    controls.appendChild(labeledInput("Alt text", el.getAttribute("alt") || "", function (v) { el.setAttribute("alt", v); Studio.markDirty(); }, { placeholder: "Describe the image for accessibility" }).wrap);
  } else if (tag === "a") {
    controls.appendChild(labeledInput("Link URL", el.getAttribute("href") || "", function (v) { el.setAttribute("href", v.trim()); Studio.markDirty(); }, { placeholder: "https://... or /page.html" }).wrap);
    controls.appendChild(labeledInput("Link text", el.textContent || "", function (v) { el.textContent = v; Studio.markDirty(); }).wrap);
    controls.appendChild(uploadField("Link to a file", ".pdf,.zip,.doc,.docx,.txt", function (url) { el.setAttribute("href", url); Studio.updateInspector(); }));
    controls.appendChild(
      row([
        labeledSelect("Opens in", el.getAttribute("target") || "", [["", "Same tab"], ["_blank", "New tab"]], function (v) {
          if (v) el.setAttribute("target", v); else el.removeAttribute("target");
          Studio.markDirty();
        }).wrap,
        labeledInput("Rel", el.getAttribute("rel") || "", function (v) {
          if (v.trim()) el.setAttribute("rel", v.trim()); else el.removeAttribute("rel");
          Studio.markDirty();
        }, { placeholder: "noopener" }).wrap,
      ])
    );
  } else if (tag === "hr") {
    // no content controls
  } else if (el.children.length === 0) {
    controls.appendChild(group(null, "Double-click the element on the page to edit its text directly, or use this box."));
    var ta = document.createElement("textarea");
    ta.className = "cms-textarea";
    ta.value = el.textContent || "";
    ta.addEventListener("input", function () { el.textContent = ta.value; Studio.markDirty(); Studio.scheduleHistory(); });
    controls.appendChild(ta);
  }

  controls.appendChild(layoutPanel());
  controls.appendChild(boxModelEditor("margin"));
  controls.appendChild(boxModelEditor("padding"));
  controls.appendChild(typographyPanel());
  controls.appendChild(backgroundPanel());
  controls.appendChild(borderPanel());
  controls.appendChild(shadowPanel());
  controls.appendChild(transformPanel());
  controls.appendChild(filterPanel());
  controls.appendChild(advancedPanel());

  Studio.iconRefresh();
};

function describeElement(el) {
  var text = el.tagName.toLowerCase();
  if (el.id) text += "#" + el.id;
  var name = el.getAttribute("data-cms-name");
  if (name) text += " \\u201c" + name + "\\u201d";
  else if (el.classList.length) text += "." + Array.from(el.classList).filter(function (c) { return c.indexOf("cms-") !== 0; }).slice(0, 2).join(".");
  return text;
}

function layoutPanel() {
  var el = Studio.state.selected;
  var wrap = group("Layout");
  var display = Studio.getStyleValue(el, "display") || "";
  wrap.appendChild(buttonGroup("Display", display || "(default)", [["", "Default"], ["block", "Block"], ["flex", "Flex"], ["grid", "Grid"], ["inline-block", "Inline"], ["none", "Hidden"]], function (v) {
    Studio.setStyleValue(el, "display", v);
    Studio.updateInspector();
  }));

  if (display === "flex") {
    wrap.appendChild(buttonGroup("Direction", Studio.getStyleValue(el, "flexDirection") || "row", [["row", "Row"], ["column", "Column"]], function (v) { Studio.setStyleValue(el, "flexDirection", v); }));
    wrap.appendChild(buttonGroup("Wrap", Studio.getStyleValue(el, "flexWrap") || "nowrap", [["nowrap", "No wrap"], ["wrap", "Wrap"]], function (v) { Studio.setStyleValue(el, "flexWrap", v); }));
    wrap.appendChild(
      row([
        labeledSelect("Justify", Studio.getStyleValue(el, "justifyContent") || "flex-start", [["flex-start", "Start"], ["center", "Center"], ["flex-end", "End"], ["space-between", "Space between"], ["space-around", "Space around"]], function (v) { Studio.setStyleValue(el, "justifyContent", v); }).wrap,
        labeledSelect("Align", Studio.getStyleValue(el, "alignItems") || "stretch", [["stretch", "Stretch"], ["flex-start", "Start"], ["center", "Center"], ["flex-end", "End"]], function (v) { Studio.setStyleValue(el, "alignItems", v); }).wrap,
      ])
    );
    wrap.appendChild(styleField("Gap", "gap", { placeholder: "16px" }));
    if (el.parentElement && Studio.el.contentRoot.contains(el.parentElement)) {
      wrap.appendChild(group(null, "This element is a flex container; use \\u201cchild\\u201d controls below only when editing one of its direct children."));
    }
  }

  if (display === "grid") {
    wrap.appendChild(
      row([
        labeledInput("Columns", gridColumnCount(el), function (v) {
          var n = Math.max(1, Number(v) || 1);
          Studio.setStyleValue(el, "gridTemplateColumns", "repeat(" + n + ", 1fr)");
        }, { type: "number", min: 1 }).wrap,
        styleField("Gap", "gap", { placeholder: "24px" }),
      ])
    );
    wrap.appendChild(styleField("Custom columns (advanced)", "gridTemplateColumns", { placeholder: "e.g. 1fr 2fr 1fr" }));
    wrap.appendChild(
      row([
        labeledSelect("Justify items", Studio.getStyleValue(el, "justifyItems") || "stretch", [["stretch", "Stretch"], ["start", "Start"], ["center", "Center"], ["end", "End"]], function (v) { Studio.setStyleValue(el, "justifyItems", v); }).wrap,
        labeledSelect("Align items", Studio.getStyleValue(el, "alignItems") || "stretch", [["stretch", "Stretch"], ["start", "Start"], ["center", "Center"], ["end", "End"]], function (v) { Studio.setStyleValue(el, "alignItems", v); }).wrap,
      ])
    );
  }

  var isFlexChild = el.parentElement && (getComputedStyle(el.parentElement).display === "flex" || getComputedStyle(el.parentElement).display === "inline-flex");
  if (isFlexChild) {
    wrap.appendChild(group("Flex child"));
    wrap.appendChild(
      row([
        styleField("Grow", "flexGrow", { placeholder: "0" }),
        styleField("Shrink", "flexShrink", { placeholder: "1" }),
      ])
    );
    wrap.appendChild(row([styleField("Basis", "flexBasis", { placeholder: "auto" }), styleField("Order", "order", { placeholder: "0" })]));
  }

  wrap.appendChild(buttonGroup("Position", Studio.getStyleValue(el, "position") || "static", [["static", "Static"], ["relative", "Relative"], ["absolute", "Absolute"], ["fixed", "Fixed"], ["sticky", "Sticky"]], function (v) {
    Studio.setStyleValue(el, "position", v);
    Studio.updateInspector();
  }));
  var pos = Studio.getStyleValue(el, "position");
  if (pos && pos !== "static") {
    wrap.appendChild(row([styleField("Top", "top"), styleField("Right", "right")]));
    wrap.appendChild(row([styleField("Bottom", "bottom"), styleField("Left", "left")]));
    wrap.appendChild(styleField("Z-index", "zIndex", { placeholder: "1" }));
  }

  wrap.appendChild(row([styleField("Width", "width", { placeholder: "auto" }), styleField("Height", "height", { placeholder: "auto" })]));
  wrap.appendChild(row([styleField("Min width", "minWidth"), styleField("Max width", "maxWidth")]));
  wrap.appendChild(row([styleField("Min height", "minHeight"), styleField("Max height", "maxHeight")]));

  return wrap;
}

function gridColumnCount(el) {
  var val = Studio.getStyleValue(el, "gridTemplateColumns") || "";
  var m = val.match(/repeat\\((\\d+)/);
  return m ? m[1] : "";
}

function typographyPanel() {
  var el = Studio.state.selected;
  var wrap = group("Typography");
  wrap.appendChild(styleField("Font family", "fontFamily", { placeholder: "inherit" }));
  wrap.appendChild(row([styleField("Font size", "fontSize", { placeholder: "16px" }), labeledSelect("Weight", Studio.getStyleValue(el, "fontWeight") || "", [["", "Default"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"], ["800", "Extrabold"]], function (v) { Studio.setStyleValue(el, "fontWeight", v); }).wrap]));
  wrap.appendChild(row([styleField("Line height", "lineHeight", { placeholder: "1.5" }), styleField("Letter spacing", "letterSpacing", { placeholder: "normal" })]));
  wrap.appendChild(buttonGroup("Align", Studio.getStyleValue(el, "textAlign") || "left", [["left", "Left"], ["center", "Center"], ["right", "Right"], ["justify", "Justify"]], function (v) { Studio.setStyleValue(el, "textAlign", v); }));
  wrap.appendChild(row([
    labeledSelect("Transform", Studio.getStyleValue(el, "textTransform") || "none", [["none", "None"], ["uppercase", "UPPER"], ["lowercase", "lower"], ["capitalize", "Capitalize"]], function (v) { Studio.setStyleValue(el, "textTransform", v); }).wrap,
    labeledSelect("Decoration", Studio.getStyleValue(el, "textDecoration") || "none", [["none", "None"], ["underline", "Underline"], ["line-through", "Strikethrough"]], function (v) { Studio.setStyleValue(el, "textDecoration", v); }).wrap,
  ]));
  wrap.appendChild(styleField("Max width (measure)", "maxWidth", { placeholder: "e.g. 60ch" }));
  wrap.appendChild(colorPickerField("Text color", "color"));
  return wrap;
}

function borderPanel() {
  var el = Studio.state.selected;
  var wrap = group("Border");
  wrap.appendChild(row([styleField("Width", "borderWidth", { placeholder: "0px" }), labeledSelect("Style", Studio.getStyleValue(el, "borderStyle") || "solid", [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["none", "None"]], function (v) { Studio.setStyleValue(el, "borderStyle", v); }).wrap]));
  wrap.appendChild(colorPickerField("Border color", "borderColor"));
  wrap.appendChild(styleField("Corner radius", "borderRadius", { placeholder: "0px" }));
  return wrap;
}

/* ---- advanced: attributes, class, lock/hide, layer name ------------------ */

function advancedPanel() {
  var el = Studio.state.selected;
  var wrap = group("Advanced");

  wrap.appendChild(labeledInput("Layer name", el.getAttribute("data-cms-name") || "", function (v) {
    if (v.trim()) el.setAttribute("data-cms-name", v.trim()); else el.removeAttribute("data-cms-name");
    if (Studio.refreshTree) Studio.refreshTree();
  }, { placeholder: "(auto)" }).wrap);

  wrap.appendChild(labeledInput("CSS class", el.getAttribute("class") ? el.getAttribute("class").split(/\\s+/).filter(function (c) { return c.indexOf("cms-") !== 0; }).join(" ") : "", function (v) {
    var kept = (el.getAttribute("class") || "").split(/\\s+/).filter(function (c) { return c.indexOf("cms-") === 0; });
    var classes = v.split(/\\s+/).map(function (x) { return x.trim(); }).filter(Boolean).concat(kept);
    if (classes.length) el.setAttribute("class", classes.join(" ")); else el.removeAttribute("class");
    Studio.markDirty();
  }).wrap);

  var breakpointLabel = Studio.state.breakpoint === "desktop" ? "Desktop" : Studio.state.breakpoint === "tablet" ? "Tablet" : "Mobile";
  var hideRow = document.createElement("label");
  hideRow.className = "cms-check";
  var hideBox = document.createElement("input");
  hideBox.type = "checkbox";
  hideBox.checked = Studio.isHiddenOnBreakpoint(el, Studio.state.breakpoint);
  hideBox.addEventListener("change", function () {
    Studio.setHiddenOnBreakpoint(el, Studio.state.breakpoint, hideBox.checked);
  });
  hideRow.appendChild(hideBox);
  hideRow.appendChild(document.createTextNode("Hide on " + breakpointLabel));
  wrap.appendChild(hideRow);

  var lockRow = document.createElement("label");
  lockRow.className = "cms-check";
  var lockBox = document.createElement("input");
  lockBox.type = "checkbox";
  lockBox.checked = el.getAttribute("data-cms-locked") === "true";
  lockBox.addEventListener("change", function () {
    if (lockBox.checked) el.setAttribute("data-cms-locked", "true"); else el.removeAttribute("data-cms-locked");
    if (Studio.refreshTree) Studio.refreshTree();
  });
  lockRow.appendChild(lockBox);
  lockRow.appendChild(document.createTextNode("Lock (prevents accidental edits)"));
  wrap.appendChild(lockRow);

  ["id", "title", "role", "aria-label"].forEach(function (attr) {
    wrap.appendChild(labeledInput(attr, el.getAttribute(attr) || "", function (v) {
      if (v) el.setAttribute(attr, v); else el.removeAttribute(attr);
      Studio.markDirty();
    }).wrap);
  });

  var rect = el.getBoundingClientRect();
  var computedBox = document.createElement("div");
  computedBox.className = "cms-computed-box";
  computedBox.innerHTML =
    "<div>Rendered box: <b>" + Math.round(rect.width) + " \\u00D7 " + Math.round(rect.height) + "</b></div>" +
    "<div>Computed display: <b>" + getComputedStyle(el).display + "</b></div>";
  wrap.appendChild(computedBox);

  var removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "cms-button danger";
  removeBtn.textContent = "Remove element";
  removeBtn.addEventListener("click", function () { Studio.deleteElement(); });
  wrap.appendChild(removeBtn);

  return wrap;
}

/* ---- page settings / SEO panel ------------------------------------------ */

function metaTag(name, isProperty) {
  var attr = isProperty ? "property" : "name";
  return document.head.querySelector('meta[' + attr + '="' + name + '"]');
}
function ensureMetaTag(name, isProperty) {
  var tag = metaTag(name, isProperty);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(isProperty ? "property" : "name", name);
    document.head.appendChild(tag);
  }
  return tag;
}

Studio.openPageSettings = function () {
  var overlay = document.createElement("div");
  overlay.className = "cms-modal-overlay";
  var titleTag = document.head.querySelector("title");
  var descTag = metaTag("description");
  var canonicalTag = document.head.querySelector('link[rel="canonical"]');
  var ogTitle = metaTag("og:title", true);
  var ogDesc = metaTag("og:description", true);
  var ogImage = metaTag("og:image", true);
  var robotsTag = metaTag("robots");

  var modal = document.createElement("div");
  modal.className = "cms-modal cms-modal-wide";
  modal.innerHTML = "<h3>" + Studio.icon("globe") + " Page settings &amp; SEO</h3>";

  function field(labelText, value, onInput, placeholder) {
    modal.appendChild(labeledInput(labelText, value || "", onInput, { placeholder: placeholder }).wrap);
  }

  field("Page title", titleTag ? titleTag.textContent : "", function (v) {
    if (!titleTag) { titleTag = document.createElement("title"); document.head.appendChild(titleTag); }
    titleTag.textContent = v;
    Studio.markDirty();
  });
  field("Meta description", descTag ? descTag.getAttribute("content") : "", function (v) {
    ensureMetaTag("description").setAttribute("content", v);
    Studio.markDirty();
  }, "Shown in search results");
  field("Canonical URL", canonicalTag ? canonicalTag.getAttribute("href") : "", function (v) {
    if (!canonicalTag) { canonicalTag = document.createElement("link"); canonicalTag.setAttribute("rel", "canonical"); document.head.appendChild(canonicalTag); }
    canonicalTag.setAttribute("href", v);
    Studio.markDirty();
  }, "https://example.com/about");
  field("Social share title (og:title)", ogTitle ? ogTitle.getAttribute("content") : "", function (v) {
    ensureMetaTag("og:title", true).setAttribute("content", v);
    Studio.markDirty();
  });
  field("Social share description (og:description)", ogDesc ? ogDesc.getAttribute("content") : "", function (v) {
    ensureMetaTag("og:description", true).setAttribute("content", v);
    Studio.markDirty();
  });
  field("Social share image URL (og:image)", ogImage ? ogImage.getAttribute("content") : "", function (v) {
    ensureMetaTag("og:image", true).setAttribute("content", v);
    Studio.markDirty();
  }, "/uploads/...");

  var robotsRow = document.createElement("label");
  robotsRow.className = "cms-check";
  var robotsBox = document.createElement("input");
  robotsBox.type = "checkbox";
  robotsBox.checked = robotsTag ? robotsTag.getAttribute("content") === "noindex" : false;
  robotsBox.addEventListener("change", function () {
    if (robotsBox.checked) ensureMetaTag("robots").setAttribute("content", "noindex");
    else if (robotsTag) robotsTag.setAttribute("content", "index, follow");
    Studio.markDirty();
  });
  robotsRow.appendChild(robotsBox);
  robotsRow.appendChild(document.createTextNode("Hide this page from search engines (noindex)"));
  modal.appendChild(robotsRow);

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "cms-button";
  closeBtn.textContent = "Done";
  closeBtn.style.marginTop = "8px";
  closeBtn.addEventListener("click", function () { overlay.remove(); });
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

/* ---- breakpoint / state tab chrome, injected into the sidebar header ---- */

Studio.initInspectorChrome = function () {
  var header = document.querySelector(".cms-side-header");
  if (!header || document.getElementById("cms-tabs-row")) return;
  var tabsRow = document.createElement("div");
  tabsRow.id = "cms-tabs-row";

  var bpTabs = document.createElement("div");
  bpTabs.className = "cms-tab-group";
  [["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"]].forEach(function (bp) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = bp[1];
    btn.className = "cms-tab" + (bp[0] === "desktop" ? " active" : "");
    btn.addEventListener("click", function () {
      Studio.state.breakpoint = bp[0];
      Array.from(bpTabs.children).forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      Studio.applyPreviewWidth(bp[0]);
      if (Studio.state.selected) Studio.updateInspector();
    });
    bpTabs.appendChild(btn);
  });

  var stateTabs = document.createElement("div");
  stateTabs.className = "cms-tab-group";
  [["base", "Default"], ["hover", "Hover"], ["focus", "Focus"], ["active", "Active"]].forEach(function (st) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = st[1];
    btn.className = "cms-tab cms-tab-sm" + (st[0] === "base" ? " active" : "");
    btn.addEventListener("click", function () {
      Studio.state.styleTab = st[0];
      Array.from(stateTabs.children).forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      if (Studio.state.selected) Studio.updateInspector();
    });
    stateTabs.appendChild(btn);
  });

  tabsRow.appendChild(bpTabs);
  tabsRow.appendChild(stateTabs);
  header.after(tabsRow);
};

Studio.applyPreviewWidth = function (bp) {
  var root = Studio.el.contentRoot;
  if (bp === "desktop") {
    root.style.maxWidth = "";
    root.style.margin = "";
  } else if (bp === "tablet") {
    root.style.maxWidth = (Studio.styleData.breakpoints.tablet || 991) + "px";
    root.style.margin = "0 auto";
  } else {
    root.style.maxWidth = (Studio.styleData.breakpoints.mobile || 640) + "px";
    root.style.margin = "0 auto";
  }
  Studio.positionContextBar();
};
`;
