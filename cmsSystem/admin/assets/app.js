"use strict";
window.App = (function () {
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    pages: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
    media: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    versions: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    design: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 1 0 10 10c0-.9-.6-1.7-1.5-1.9-1-.3-1.7-1.1-1.7-2.1a2 2 0 0 1 2-2c.4 0 .8.1 1.1.3A10 10 0 0 0 12 2Z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
  };
  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + (cls || "") + '">' + (ICONS[name] || "") + "</svg>";
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatRelativeTime(ms) {
    if (!ms) return "\u2014";
    const diff = Date.now() - ms;
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute" : " minutes") + (diff >= 0 ? " ago" : " from now");
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour" : " hours") + (diff >= 0 ? " ago" : " from now");
    const days = Math.round(hours / 24);
    if (days < 30) return days + (days === 1 ? " day" : " days") + (diff >= 0 ? " ago" : " from now");
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateTime(ms) {
    if (!ms) return "\u2014";
    return new Date(ms).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function formatBytes(n) {
    if (n == null) return "\u2014";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function toast(message, type) {
    let host = document.querySelector(".toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers);
    let body = opts.body;
    if (body && typeof body === "object" && !(body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const res = await fetch(path, { method: opts.method || "GET", headers, body });
    if (res.status === 401 && !path.includes("/auth/")) {
      window.location.href = "/_cms/login";
      return new Promise(() => {}); // never resolves; we're navigating away
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.error || "Request failed (" + res.status + ")");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const NAV_ITEMS = [
    { key: "dashboard", href: "/_cms/dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "pages", href: "/_cms/pages", label: "Pages", icon: "pages" },
    { key: "media", href: "/_cms/media", label: "Media", icon: "media" },
    { key: "versions", href: "/_cms/versions", label: "Versions", icon: "versions" },
    { key: "design", href: "/_cms/design", label: "Design system", icon: "design" },
    { key: "activity", href: "/_cms/activity", label: "Activity", icon: "activity" },
    { key: "users", href: "/_cms/users", label: "Users", icon: "users", adminOnly: true },
  ];

  function renderShell(activeKey, user) {
    const navHtml = NAV_ITEMS.map((item) => {
      const disabled = item.adminOnly && user.role !== "admin";
      return (
        '<a href="' + (disabled ? "#" : item.href) + '" class="' + (item.key === activeKey ? "active" : "") + (disabled ? " nav-disabled" : "") + '"' +
        (disabled ? ' title="Admins only"' : "") + ">" + icon(item.icon) + "<span>" + item.label + "</span></a>"
      );
    }).join("");

    const initial = (user.username || "?").slice(0, 1).toUpperCase();
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.innerHTML =
        '<div class="app-brand"><div class="app-brand-mark"></div><div class="app-brand-text">Studio<small>CMS Dashboard</small></div></div>' +
        '<nav class="app-nav">' + navHtml + "</nav>" +
        '<div class="app-sidebar-footer">' +
        '<div class="app-user-row"><div class="app-user-avatar">' + escapeHtml(initial) + '</div><div class="app-user-meta"><div class="app-user-name">' + escapeHtml(user.username) + '</div><div class="app-user-role">' + escapeHtml(user.role) + "</div></div></div>" +
        '<button class="app-logout-btn" id="app-logout-btn">' + icon("logout") + " Sign out</button>" +
        "</div>";
      document.getElementById("app-logout-btn").addEventListener("click", async () => {
        await api("/_cms/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.href = "/_cms/login";
      });
    }
  }

  /** Call at the top of every dashboard page. Redirects to login if not
   *  authenticated, otherwise renders the shared nav and invokes `then(user)`. */
  function boot(activeKey, then) {
    api("/_cms/api/auth/me")
      .then((data) => {
        renderShell(activeKey, data.user);
        then(data.user);
      })
      .catch(() => {
        window.location.href = "/_cms/login";
      });
  }

  function statusBadge(status) {
    if (status === "draft-changes") return '<span class="badge badge-draft">Draft changes</span>';
    if (status === "unpublished-draft") return '<span class="badge badge-unpublished">Unpublished</span>';
    return '<span class="badge badge-live">Published</span>';
  }

  function roleBadge(role) {
    return '<span class="badge ' + (role === "admin" ? "badge-admin" : "badge-editor") + '">' + escapeHtml(role) + "</span>";
  }

  function confirmModal({ title, message, confirmLabel, danger }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML =
        '<div class="modal"><h3>' + escapeHtml(title) + "</h3><p style=\"color:var(--muted);font-size:13px;line-height:1.5;\">" + escapeHtml(message) + '</p>' +
        '<div class="modal-actions"><button class="btn btn-secondary" data-act="cancel">Cancel</button>' +
        '<button class="btn ' + (danger ? "btn-danger" : "btn-primary") + '" data-act="ok">' + escapeHtml(confirmLabel || "Confirm") + "</button></div></div>";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); resolve(false); }
        if (e.target.dataset.act === "ok" || e.target.closest("[data-act='ok']")) { overlay.remove(); resolve(true); }
      });
    });
  }

  return { icon, escapeHtml, formatRelativeTime, formatDateTime, formatBytes, toast, api, boot, statusBadge, roleBadge, confirmModal, NAV_ITEMS };
})();
