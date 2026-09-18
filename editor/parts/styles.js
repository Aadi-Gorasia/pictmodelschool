"use strict";
module.exports = /* css */ `
:root {
  --cms-accent: #7c5cff;
  --cms-accent-2: #a78bfa;
  --cms-bg: rgba(15, 16, 22, .82);
  --cms-panel: rgba(20, 21, 29, .94);
  --cms-panel-2: rgba(255,255,255,.055);
  --cms-border: rgba(255,255,255,.10);
  --cms-border-strong: rgba(255,255,255,.16);
  --cms-text: #f7f7fb;
  --cms-muted: #9295a5;
  --cms-danger: #ef4444;
  --cms-success: #22c55e;
  --cms-shadow: 0 24px 80px rgba(0,0,0,.38);
}

#cms-editor-wrapper, #cms-editor-wrapper * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
}
#cms-editor-wrapper button, #cms-editor-wrapper input, #cms-editor-wrapper select, #cms-editor-wrapper textarea { font: inherit; }
#cms-editor-wrapper button { -webkit-tap-highlight-color: transparent; cursor: pointer; }
#cms-editor-wrapper svg { width: 16px; height: 16px; flex: none; }
#cms-editor-wrapper :focus-visible { outline: 2px solid var(--cms-accent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  #cms-editor-wrapper * { transition-duration: .001ms !important; animation-duration: .001ms !important; }
}

.cms-selected-element { outline: 1.5px solid #8b72ff !important; outline-offset: 2px !important; box-shadow: 0 0 0 1px rgba(124,92,255,.2), 0 0 0 5px rgba(124,92,255,.08) !important; }
.cms-multi-selected { outline: 1.5px dashed #a78bfa !important; outline-offset: 2px !important; }

#cms-sidebar-backdrop { position: fixed; inset: 0; display: none; background: rgba(0,0,0,.25); z-index: 2147483645; }
#cms-sidebar-backdrop.active { display: block; }

/* ---- topbar ---- */
#cms-topbar {
  position: fixed; top: var(--cms-topbar-offset, 14px); left: 16px; right: 16px; height: 48px;
  display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 10px 0 12px;
  color: var(--cms-text); background: rgba(16,17,23,.72); border: 1px solid var(--cms-border); border-radius: 16px;
  backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%);
  box-shadow: 0 12px 42px rgba(0,0,0,.18); z-index: 2147483647;
}
.cms-topbar-left { display: flex; align-items: center; gap: 9px; min-width: 0; }
.cms-app-mark { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg,#7c5cff,#9b8cff); box-shadow: 0 5px 18px rgba(124,92,255,.34); flex: none; }
.cms-app-mark span { width: 9px; height: 9px; border-radius: 3px; background: #fff; opacity: .92; }
.cms-app-title { font-size: 12px; font-weight: 800; white-space: nowrap; }
.cms-app-title small { margin-left: 5px; color: #858896; font-size: 10px; font-weight: 600; }
.cms-page-pill { min-width: 0; max-width: 40vw; height: 32px; padding: 0 11px; display: flex; align-items: center; gap: 8px; color: #cfd1da; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.07); border-radius: 10px; font: 600 11px/1 ui-monospace, monospace; }
.cms-page-pill span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cms-page-pill svg { color: #9b8cff; }
.cms-mode-pill { height: 30px; padding: 0 10px; display: flex; align-items: center; gap: 7px; border-radius: 999px; background: rgba(124,92,255,.12); border: 1px solid rgba(124,92,255,.25); color: #cfc8ff; font-size: 10px; letter-spacing: .03em; text-transform: uppercase; flex: none; }
.cms-mode-pill span { width: 6px; height: 6px; border-radius: 50%; background: #8b72ff; box-shadow: 0 0 0 4px rgba(124,92,255,.10); }
.cms-mode-pill.browse { background: rgba(52,211,153,.10); border-color: rgba(52,211,153,.24); color: #a7f3d0; }
.cms-mode-pill.browse span { background: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,.09); }
.cms-topbar-icon-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: #cfd1da; background: transparent; border: 1px solid transparent; border-radius: 9px; }
.cms-topbar-icon-btn:hover { background: rgba(255,255,255,.07); border-color: var(--cms-border); }

/* ---- dock ---- */
#cms-master-dock {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); min-height: 52px; max-width: calc(100vw - 24px);
  padding: 6px 7px 6px 12px; display: flex; align-items: center; gap: 6px; color: #fff;
  background: rgba(15,16,22,.85); border: 1px solid rgba(255,255,255,.12); border-radius: 17px;
  backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%);
  box-shadow: var(--cms-shadow); z-index: 2147483647;
}
.cms-brand { padding: 0 8px 0 2px; color: #8f92a1; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.cms-status { padding: 0 6px; color: #a5a7b3; font-size: 11px; white-space: nowrap; }
.cms-divider-v { width: 1px; height: 22px; background: var(--cms-border); margin: 0 2px; }

.cms-button { min-height: 38px; padding: 8px 14px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; color: white; background: linear-gradient(135deg,#7657f4,#8e76ff); border: 0; border-radius: 10px; font-weight: 700; font-size: 13px; box-shadow: 0 8px 22px rgba(124,92,255,.22); }
.cms-button:hover { filter: brightness(1.08); }
.cms-button:disabled { opacity: .45; cursor: not-allowed; }
.cms-button.secondary { background: transparent; color: #dcdde5; border: 1px solid transparent; box-shadow: none; }
.cms-button.secondary:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.08); }
.cms-button.secondary.active { background: rgba(124,92,255,.18); color: #d8d0ff; border-color: rgba(124,92,255,.32); }
.cms-button.danger { background: rgba(239,68,68,.15); color: #fecaca; box-shadow: none; }
#save-btn { min-width: 118px; }

/* ---- context bar ---- */
#cms-context-bar { position: fixed; display: none; align-items: center; gap: 2px; min-height: 42px; max-width: calc(100vw - 24px); padding: 4px; color: #fff; background: rgba(15,16,22,.9); border: 1px solid rgba(124,92,255,.28); border-radius: 12px; backdrop-filter: blur(18px); box-shadow: 0 14px 42px rgba(0,0,0,.32); z-index: 2147483647; }
#cms-context-bar.cms-multi-mode { border-color: rgba(167,139,250,.5); }
.cms-btn { width: 33px; height: 33px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: #e5e7eb; background: transparent; border: 0; border-radius: 9px; }
.cms-btn:hover { background: rgba(255,255,255,.09); }
.cms-btn:disabled { opacity: .3; }
.cms-btn.danger:hover { color: #fecaca; background: rgba(239,68,68,.14); }
.cms-divider { width: 1px; height: 22px; background: var(--cms-border); margin: 0 3px; }

/* ---- sidebar ---- */
#cms-sidebar { position: fixed; top: 72px; right: 12px; height: calc(100dvh - 84px); width: min(390px, calc(100vw - 24px)); display: flex; flex-direction: column; color: var(--cms-text); background: rgba(18,19,26,.93); border: 1px solid rgba(255,255,255,.12); border-radius: 18px; overflow: hidden; box-shadow: var(--cms-shadow); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); transform: translateX(calc(100% + 20px)); opacity: 0; transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .18s; z-index: 2147483646; }
#cms-sidebar.active { transform: translateX(0); opacity: 1; }
.cms-side-header { min-height: 64px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--cms-border); background: rgba(255,255,255,.02); }
.cms-side-title strong { display: block; font-size: 13px; }
.cms-side-title span { display: block; margin-top: 2px; color: #7f8290; font-size: 11px; }
.cms-icon-button { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: #d1d5db; background: transparent; border: 1px solid transparent; border-radius: 9px; }
.cms-icon-button:hover { background: rgba(255,255,255,.07); border-color: var(--cms-border); }
.cms-side-body { flex: 1; overflow: auto; padding: 12px 14px; scrollbar-width: thin; }

#cms-tabs-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--cms-border); background: rgba(255,255,255,.015); }
.cms-tab-group { display: flex; gap: 3px; background: rgba(255,255,255,.04); padding: 3px; border-radius: 9px; }
.cms-tab { flex: 1; padding: 6px 4px; text-align: center; font-size: 11px; font-weight: 700; color: #9a9dab; background: transparent; border: 0; border-radius: 7px; }
.cms-tab.active { background: var(--cms-accent); color: white; }
.cms-tab-sm { font-size: 10px; padding: 5px 4px; }

.cms-group { margin: 0 0 14px; padding: 12px; border: 1px solid rgba(255,255,255,.07); border-radius: 12px; background: rgba(255,255,255,.02); }
.cms-label { display: block; margin: 0 0 8px; color: #9a9dab; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.cms-help { margin: 0 0 8px; color: #7f8490; font-size: 11px; line-height: 1.5; }
.cms-field { margin-bottom: 8px; }
.cms-field-label { display: block; margin-bottom: 4px; color: #85889a; font-size: 10.5px; }
.cms-input, .cms-select, .cms-textarea { width: 100%; padding: 9px 10px; color: var(--cms-text); background: rgba(255,255,255,.045); border: 1px solid var(--cms-border-strong); border-radius: 9px; outline: none; font-size: 12.5px; }
.cms-input::placeholder, .cms-textarea::placeholder { color: #5c5f6b; }
.cms-input:focus, .cms-select:focus, .cms-textarea:focus { border-color: rgba(124,92,255,.65); box-shadow: 0 0 0 3px rgba(124,92,255,.14); }
.cms-textarea { min-height: 84px; resize: vertical; }
.cms-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cms-row > * { min-width: 0; }
.cms-check { display: flex; align-items: center; gap: 8px; margin: 8px 0; color: #ced0da; font-size: 12px; }
.cms-check input { accent-color: var(--cms-accent); }

.cms-btn-group { display: flex; flex-wrap: wrap; gap: 4px; }
.cms-seg-btn { padding: 6px 10px; font-size: 11.5px; font-weight: 600; color: #c7c9d4; background: rgba(255,255,255,.04); border: 1px solid var(--cms-border); border-radius: 7px; }
.cms-seg-btn.active { background: var(--cms-accent); color: white; border-color: transparent; }

.cms-reset-btn { margin-left: 6px; width: 24px; height: 24px; border: 0; background: rgba(255,255,255,.06); color: #b7b9c6; border-radius: 6px; font-size: 12px; }
.cms-reset-btn:hover { background: rgba(124,92,255,.2); color: #fff; }

.cms-color-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.cms-color-swatch { -webkit-appearance: none; appearance: none; width: 34px; height: 34px; padding: 0; border: 1px solid var(--cms-border-strong); border-radius: 8px; background: none; flex: none; }
.cms-color-swatch::-webkit-color-swatch-wrapper { padding: 2px; }
.cms-color-swatch::-webkit-color-swatch { border-radius: 6px; border: none; }
.cms-token-swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.cms-token-swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(255,255,255,.25); }

.cms-box-grid { display: grid; grid-template-columns: 32px repeat(4, 1fr); gap: 6px; align-items: center; }
.cms-box-input { text-align: center; padding: 8px 4px; }
.cms-link-toggle { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.05); border: 1px solid var(--cms-border); border-radius: 8px; color: #9a9dab; }
.cms-link-toggle.active { background: rgba(124,92,255,.22); color: #d8d0ff; border-color: rgba(124,92,255,.4); }

.cms-shadow-item { padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,.03); border: 1px solid var(--cms-border); border-radius: 10px; }
.cms-shadow-item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.cms-bg-sub { margin-top: 4px; }

.cms-computed-box { margin: 8px 0; padding: 9px 10px; color: #a1a1aa; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 9px; font-size: 10.5px; line-height: 1.7; }
.cms-computed-box b { color: #e5e7eb; }

/* ---- tree panel ---- */
#cms-tree-panel { position: fixed; top: 72px; left: 12px; bottom: 84px; width: min(330px, calc(100vw - 24px)); display: flex; flex-direction: column; color: #f5f5f8; background: rgba(18,19,26,.92); border: 1px solid rgba(255,255,255,.12); border-radius: 18px; overflow: hidden; backdrop-filter: blur(28px); box-shadow: var(--cms-shadow); z-index: 2147483646; opacity: 0; transform: translateX(-16px); pointer-events: none; transition: .2s ease; }
#cms-tree-panel.active { opacity: 1; transform: translateX(0); pointer-events: auto; }
.cms-tree-header { height: 54px; padding: 0 12px 0 15px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.07); }
.cms-tree-tools { padding: 10px; border-bottom: 1px solid rgba(255,255,255,.06); }
.cms-tree-tools .cms-input { margin: 0; }
#cms-tree-list { flex: 1; overflow: auto; padding: 6px; }
.cms-tree-item { width: 100%; min-height: 32px; padding: 4px 4px 4px 8px; display: flex; align-items: center; gap: 5px; color: #b9bbc5; background: transparent; border: 0; border-radius: 8px; text-align: left; font-size: 11px; }
.cms-tree-item:hover, .cms-tree-item.cms-drop-target { color: #fff; background: rgba(255,255,255,.07); }
.cms-tree-item.active { background: rgba(124,92,255,.18); color: #fff; }
.cms-tree-indent { color: #52525b; font: 11px ui-monospace, monospace; }
.cms-tree-tag { color: var(--cms-accent-2); font-family: ui-monospace, monospace; }
.cms-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cms-tree-icon-btn { width: 22px; height: 22px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: #83869a; background: transparent; border: 0; border-radius: 5px; }
.cms-tree-icon-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
.cms-tree-icon-btn svg { width: 13px; height: 13px; }

/* ---- command palette ---- */
#cms-command-palette { position: fixed; inset: 0; display: none; align-items: flex-start; justify-content: center; padding-top: 14vh; background: rgba(5,6,10,.55); backdrop-filter: blur(4px); z-index: 2147483647; }
#cms-command-palette.active { display: flex; }
.cms-palette-box { width: min(560px, calc(100vw - 32px)); max-height: 60vh; display: flex; flex-direction: column; background: rgba(20,21,29,.97); border: 1px solid var(--cms-border-strong); border-radius: 16px; overflow: hidden; box-shadow: var(--cms-shadow); }
.cms-palette-box .cms-input { border: 0; border-radius: 0; border-bottom: 1px solid var(--cms-border); padding: 16px 18px; font-size: 14px; }
.cms-palette-box .cms-input:focus { box-shadow: none; }
#cms-palette-list { overflow: auto; padding: 6px; }
.cms-palette-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; color: #d6d7e0; background: transparent; border: 0; border-radius: 9px; text-align: left; font-size: 13px; }
.cms-palette-item.active, .cms-palette-item:hover { background: rgba(124,92,255,.16); color: #fff; }
.cms-palette-empty { padding: 20px; text-align: center; color: #7f8290; font-size: 12px; }

/* ---- modals (conflict dialog, page settings, media, components) ---- */
.cms-modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(5,6,10,.6); backdrop-filter: blur(4px); z-index: 2147483647; }
.cms-modal { width: min(440px, 100%); max-height: 82vh; overflow: auto; padding: 22px; color: var(--cms-text); background: rgba(20,21,29,.98); border: 1px solid var(--cms-border-strong); border-radius: 16px; box-shadow: var(--cms-shadow); font-family: -apple-system, "Segoe UI", sans-serif; }
.cms-modal-wide { width: min(600px, 100%); }
.cms-modal h3 { margin: 0 0 10px; font-size: 15px; display: flex; align-items: center; gap: 8px; }
.cms-modal p { color: #b6b8c4; font-size: 13px; line-height: 1.5; }
.cms-modal-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.cms-modal-actions .cms-button { width: 100%; }

.cms-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; margin-top: 12px; max-height: 50vh; overflow: auto; }
.cms-media-card { display: flex; flex-direction: column; gap: 6px; padding: 6px; background: rgba(255,255,255,.04); border: 1px solid var(--cms-border); border-radius: 10px; color: #c7c9d4; font-size: 10px; overflow: hidden; }
.cms-media-card:hover { border-color: rgba(124,92,255,.5); }
.cms-media-card img { width: 100%; height: 72px; object-fit: cover; border-radius: 6px; background: #111; }
.cms-media-file-icon { width: 100%; height: 72px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.05); border-radius: 6px; color: #9a9dab; }
.cms-media-card span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cms-component-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow: auto; }
.cms-component-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,.04); border: 1px solid var(--cms-border); border-radius: 10px; font-size: 12.5px; }

/* ---- toast ---- */
#cms-toast { position: fixed; left: 50%; bottom: 78px; transform: translate(-50%, 10px); max-width: min(420px, calc(100vw - 32px)); padding: 10px 14px; color: white; background: #171720; border: 1px solid var(--cms-border); border-radius: 10px; box-shadow: var(--cms-shadow); font-size: 12.5px; opacity: 0; pointer-events: none; transition: opacity .18s, transform .18s; z-index: 2147483647; }
#cms-toast.show { opacity: 1; transform: translate(-50%, 0); }
#cms-toast.success { border-color: rgba(34,197,94,.4); }
#cms-toast.error { border-color: rgba(239,68,68,.4); }

/* ---- responsive content-root container (real reflow, not a fake frame) --- */
#cms-content-root { container-type: inline-size; container-name: cms-root; transition: max-width .18s ease; }

@media (max-width: 640px) {
  #cms-topbar { left: 8px; right: 8px; }
  .cms-app-title small, .cms-page-pill { display: none; }
  #cms-master-dock { width: calc(100vw - 16px); bottom: 8px; justify-content: space-between; }
  .cms-brand, .cms-status { display: none; }
  #save-btn { min-width: 96px; padding: 8px 10px; }
  #cms-sidebar { top: auto; bottom: 0; right: 0; left: 0; width: 100%; height: 78vh; border-radius: 18px 18px 0 0; transform: translateY(100%); }
  #cms-sidebar.active { transform: translateY(0); }
  #cms-tree-panel { top: auto; bottom: 0; left: 0; right: 0; width: 100%; height: 60vh; border-radius: 18px 18px 0 0; transform: translateY(100%); }
  #cms-tree-panel.active { transform: translateY(0); }
  .cms-box-grid { grid-template-columns: 28px repeat(2, 1fr); row-gap: 6px; }
}
`;
