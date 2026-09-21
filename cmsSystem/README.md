# Studio CMS

A self-hosted visual website builder and CMS. One Node.js process, **zero
npm dependencies** - `npm install` has nothing to fetch, and it runs fully
offline.

It turns a folder of plain `.html` files into something you can visually
edit in the browser: click anything, change its layout/typography/colors/
spacing/responsive behavior, manage drafts vs. what's actually live, publish
with real version history, and roll back safely.

---

## 1. Quick start

```bash
# from this folder - no install step, there's nothing to install
node scripts/create-admin.js          # interactive: choose a username + password
node server.js                        # or: npm start
```

Then open **http://localhost:3000/_cms/login**, sign in, and click **Edit**
on a page from the Pages list. The public site itself is at
**http://localhost:3000/**.

By default it manages the small demo site in `./site` and stores its own
data in `./.cms-data`. Both are configurable (see §3) - most people will
point it at their *own* existing site rather than the bundled demo.

---

## 2. What's actually in here (architecture)

```
server.js              entry point - wires auth, the API, the admin
                        dashboard, and the live site together
lib/                    framework-free core logic (see below)
http/                   the HTTP layer: router, static-site serving,
                        upload handling, response helpers
api/                    one file per resource, all requests auth-gated
editor/                 the in-browser visual editor, injected into pages
                        only for an authenticated session
admin/                  the dashboard (login, pages, media, versions,
                        design, activity, users) - plain HTML/CSS/JS
site/                   a small demo website, so there's something to
                        try this on immediately
scripts/create-admin.js the only way to create a user (no signup page)
```

### The core idea: Draft vs. Live vs. History are real, not labels

This is the most important architectural property, so it's worth being
precise about it:

- **Live** is whatever `.html` file is actually sitting in your site folder.
  Anonymous visitors only ever see this. It is never modified except by an
  explicit **Publish**.
- **Draft** is a separate copy, stored entirely outside your site folder
  (under `.cms-data/drafts/`, mirroring your site's folder structure). Every
  edit in the visual editor saves to the draft, never to the live file. A
  brand-new page you create only exists as a draft - there is no live file
  for it - until you publish it for the first time.
- **History**: every Publish snapshots the exact HTML that just went live
  into an immutable version record (`id`, version number, page, timestamp,
  author, optional change summary). Restoring a version creates a **new
  draft** from it; it never touches the live file directly. You review it,
  then publish it yourself, which creates yet another new version. Nothing
  is ever silently overwritten.
- Publishing is atomic: the new content is written to a temp file and
  renamed into place, so a crash mid-publish can never leave a half-written
  live file. The version record is only created *after* that write
  succeeds, so a failed publish never produces a phantom version either.

### Who can see what (the security fix vs. a naive version of this idea)

A request for `/about.html`:

| Who's asking | What they get |
|---|---|
| Anonymous visitor | The plain **live** file. No editor, no drafts, ever. |
| Logged in, default | The **draft** (or live, as a starting point, if never edited) with the full visual editor overlaid. |
| Logged in, `?__cms=preview` | The draft, rendered as a real visitor would see it (no editor chrome). |
| Logged in, `?__cms=live` | The live version, chrome-free, so you can compare against the draft. |

Anonymous requests **ignore** the `?__cms=` parameter entirely - there is no
query string that lets a logged-out visitor see draft content or editor UI.
Every mutating endpoint (save draft, publish, upload, delete, manage users,
edit the design system) requires a valid session and, for the
publish/delete/user-management ones, the `admin` role specifically.

### The style engine (why responsive/hover editing is real, not decorative)

Every element you style gets a stable `data-cms-id` attribute the first
time you touch it. All styling - layout, typography, color, backgrounds,
borders, shadows, transforms, hover/focus/active states, and desktop/
tablet/mobile overrides - is stored per-element in a small JSON structure
and rendered into one real `<style>` tag, keyed off that id.

Responsive preview doesn't draw a bordered rectangle around your desktop
layout. `#cms-content-root` is a real CSS containment context
(`container-type: inline-size`), and tablet/mobile overrides are written as
`@container` rules against it. Switching the breakpoint tab in the editor
resizes that container, which makes the page **genuinely reflow** - and
because it's a container query rather than a viewport media query, the
exact same rule also correctly activates for a real visitor on a real small
screen after publishing.

Two honest limitations of that approach, stated plainly:
- Your site's own *pre-existing* `@media` rules (if it had hand-written
  responsive CSS before you started using Studio) key off actual viewport
  width, not this container's width, so they won't react to the in-editor
  breakpoint preview. They still work normally for real visitors on real
  devices.
- `position: fixed` elements are always relative to the real browser
  viewport, not the resized preview container, so their preview width may
  not perfectly match a true narrow-device render.

### Design tokens are baked in, not just served dynamically

Global colors/typography/spacing/radius/shadows live in one token document
and render as CSS variables. Changing a token updates anything bound to it
site-wide.

Concretely: the tokens are written into the page as a real `<style
id="cms-tokens">` block **at save/publish time**, so a published page is a
complete, self-contained static HTML file - it renders correctly on *any*
static host, with no runtime dependency on this server. If this server
stays in front of the site (e.g. you keep it running and reverse-proxy to
it), token edits also apply instantly across the whole site without
republishing, because every page load re-freshens that block with the
current tokens. If you only run Studio locally to edit and deploy the plain
files elsewhere, a token change won't retroactively appear on
already-published pages until you republish each one - republishing takes
seconds and keeps the output fully portable. See §4 if that's your setup.

### What's deliberately NOT implemented (rather than faked)

In the interest of not padding a feature list with things that don't
really work: these were left out, on purpose, instead of shipping a
half-working version of them.

- Free-form drag-to-reposition across arbitrary containers with live
  snapping guides. What *is* real: move up/down within siblings, drag-to-
  reorder in the Layers panel (same-parent only), and box-model/position
  controls that set real CSS.
- A drag-to-paint CSS Grid builder. What's real: numeric/form controls
  (column count, custom track sizes, gap, alignment) that set real grid
  CSS - matching how the spec's own mockup for this described it.
- Align/distribute for multi-selected elements. Multi-select, bulk delete/
  duplicate, and "group into a container" are real; alignment math across
  arbitrary layouts was cut for reliability.
- Cross-page component instance syncing. Saving/inserting components and
  updating other instances *on the same page* work for real; propagating a
  change to instances on *other* pages does not.
- Scroll-triggered/entrance animations. Hover/focus/active state
  transitions and timing are real; a full animation timeline is not.
- A semantic DOM diff for comparing versions. The diff is a real,
  reliable line-based (LCS) text diff - accurate, just not
  structure-aware.
- True real-time multi-user collaborative editing. What's real: optimistic-
  concurrency conflict *detection* - if someone else saved the page after
  you loaded it, you're shown a clear choice instead of silently
  overwriting their work.

### A note on testing

The backend - auth, sessions, the draft/live/version engine, RBAC, upload
security (magic-byte checks, extension allowlisting, path-traversal
resistance), conflict detection, the router, and every API route - was
exercised with real HTTP requests against a running server as part of
building this, not just written and hoped about. Bugs that testing
actually found and fixed:

1. The original prototype's undo/redo snapshotted its *own* editor UI along
   with the page content. Restoring a snapshot replaced the editor's DOM
   via `innerHTML`, which doesn't execute `<script>` tags - so every button
   in the toolbar silently stopped responding after the first undo. Fixed
   by scoping history snapshots to the actual page content only.
2. A router-ordering bug where `/api/versions/diff` was being swallowed by
   the `/api/versions/:id` route (which matches any single segment,
   including the literal word "diff"). Fixed the ordering and hardened the
   router itself to prefer literal matches over `:param` matches in
   general, so the same mistake elsewhere can't silently recur.

The visual editor's client-side JavaScript (selection, the style engine,
panels) was syntax-validated, checked for dangling/undefined references
across its ~2,500 lines, and the style engine's rendering logic was
unit-tested against a stubbed DOM. It was **not** exercised in an actual
browser - this environment doesn't have one available. That's a real gap
relative to true end-to-end testing, stated plainly rather than glossed
over.

---

## 3. Configuration

All environment variables, all optional:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | What port to listen on |
| `CMS_ROOT` | `./site` | The website's root folder - point this at your own site |
| `CMS_DATA_DIR` | `./.cms-data` | Users, sessions, versions, drafts, media metadata, design tokens. Deliberately a separate tree from `CMS_ROOT` so it can never be served as a public file. |
| `CMS_COOKIE_SECURE` | unset | Set to `1` if served over HTTPS (e.g. behind a reverse proxy), which marks the session cookie `Secure`. **Leave unset for plain local HTTP** - a `Secure` cookie is silently dropped by browsers over plain HTTP, which makes login look broken. |

## 4. Using this on an existing plain HTML/CSS/JS project (as an add-on, not a rewrite)

This is the intended way to use it for a real site, and it doesn't require
restructuring anything.

**Setup:**

```bash
# studio-cms can live anywhere - it does not need to be inside your project
CMS_ROOT=/path/to/your/existing/site node scripts/create-admin.js
CMS_ROOT=/path/to/your/existing/site node server.js
```

(Or export `CMS_ROOT` once instead of prefixing every command.) `CMS_DATA_DIR`
doesn't need to be set - it defaults to a `.cms-data` folder *next to
server.js*, i.e. outside your project, automatically.

**What it needs from your project:** plain `.html` files. Any CSS/JS/image
you already reference with a relative path keeps working exactly as-is -
Studio serves everything that isn't an `.html` file as a normal static
asset, untouched.

**The workflow:**
1. Run Studio locally (or on a machine you control) whenever you want to edit.
2. Log in, open a page, edit it, publish. Publishing writes the change
   directly into your actual `.html` file, in place, as plain valid static
   HTML (plus a `data-cms-id` here and there, and a small `<style>` block -
   nothing that needs a server to interpret).
3. Deploy exactly how you already do today - `git push`, FTP, Netlify,
   GitHub Pages, S3, nginx, whatever. The published files don't need Studio
   running to render correctly (see the design-tokens note in §2 for the
   one nuance: run Studio in front of production too if you want token
   changes to apply without republishing each page; otherwise just
   republish after a token change, which is quick).

**Two things to know before you start:**

- **If your project has a build step** (a static site generator, a
  templating system, a bundler that produces the final HTML) - point
  `CMS_ROOT` at the **built output** folder, not your source templates.
  Studio edits final HTML directly; it has no awareness of whatever
  generated it. That also means an edit made through Studio won't appear in
  your source templates, so the next time you rebuild from source, it will
  overwrite what Studio changed. For a project like that, treat Studio as a
  final-polish layer on already-built output, or stop rebuilding from
  source for the pages you're now managing through Studio.
- **Uploads land inside your project**, at `CMS_ROOT/uploads/`, because
  they need to be part of the deployed site. Add that folder to
  `.gitignore` if you'd rather not version binary uploads, or leave it
  tracked if you want them deployed via your normal git-based flow.

Pages you never open in the editor are left completely untouched -
Studio doesn't touch anything until you choose to edit it.

## 5. Users & permissions

There's no signup page on purpose. Create accounts with:

```bash
node scripts/create-admin.js                                   # interactive
node scripts/create-admin.js --username sam --password "..." --role editor   # scripted
```

Two roles:
- **Admin** - everything, including publish, delete (pages/media/users),
  manage users, and edit the design system/settings.
- **Editor** - edit, save drafts, upload, preview, view version history,
  and restore a version into a draft. Cannot publish, delete anything, or
  touch users/settings - those return `403` from the API, and the
  dashboard's Users link is visibly disabled for them.

A password reset signs that user out of every existing session. The very
last admin account can't be deleted or demoted, so you can't lock yourself
out.

## 6. Data & storage

Everything lives in flat JSON files under `CMS_DATA_DIR` - `users.json`,
`sessions.json`, `versions.json`, `pages-meta.json`, `media.json`,
`activity.json`, `components.json`, `design-tokens.json`, `settings.json`.
No database server, nothing to migrate. Every write is atomic (written to a
temp file, then renamed into place) so a crash mid-write can't corrupt a
data file.

(Node 22, which this runs on, ships an experimental `node:sqlite` - it was
considered and passed over specifically because it's still labeled "might
change at any time," and a plain JSON store is easier to inspect, back up,
and reason about correctly in one pass. Every read/write goes through
`lib/store.js`, so swapping in a real database later is a contained
change if you ever need one.)

Passwords are hashed with `scrypt` (Node's built-in, memory-hard KDF) with
a random salt per user - not bcrypt/argon2, because both ship as native
addons and this project has zero dependencies by design; scrypt is a
well-regarded alternative for exactly that situation.

## 7. Security specifics worth knowing about

- Every mutating/admin API route checks the session and role server-side;
  nothing is "hidden by CSS" as its only protection.
- Uploads: extension allowlist (notably, `.html` is never allowed), the
  actual file bytes are checked against known magic numbers for image
  types (so a script renamed to `.png` is rejected, not trusted), filenames
  are rewritten (random prefix, directory components stripped) so a
  crafted filename can't escape the uploads folder, and `/uploads/*`
  responses carry a `sandbox` Content-Security-Policy plus
  `X-Content-Type-Options: nosniff` as a second layer of defense. SVGs
  additionally get their `<script>`/event-handler content stripped before
  being saved.
- Sessions are opaque random tokens looked up server-side - there's no
  signing secret to manage or leak, and a session can be revoked instantly
  by deleting its record (which happens automatically on logout and on
  password change).
- Cookies are `HttpOnly` and `SameSite=Lax`. Combined with the API
  requiring `Content-Type: application/json`, this is real (if not
  bulletproof) CSRF resistance for a same-origin app like this.
- Repeated failed logins are throttled with exponential backoff per
  IP+username (in-memory; resets on restart - it's a speed bump against
  automated guessing, not a distributed rate limiter).
- All path resolution (site files, draft files, uploaded files, admin
  assets) rejects `..` traversal and is tested against both plain and
  URL-encoded traversal attempts.

## 8. Manually re-running the tests described above

There's no test framework wired in (again, zero dependencies), but every
claim in §2's testing note is easy to re-check by hand:

```bash
node scripts/create-admin.js --username you --password "at-least-8-chars" --role admin
node server.js &
curl -i http://localhost:3000/                       # plain, no editor markup
curl -i http://localhost:3000/_cms/api/pages          # 401, not signed in
curl -c c.txt -X POST http://localhost:3000/_cms/api/auth/login \
  -H "Content-Type: application/json" -d '{"username":"you","password":"at-least-8-chars"}'
curl -b c.txt http://localhost:3000/                  # now includes the editor
```

From there, the Pages list, Media library, Versions, Design system, and
Users screens in the dashboard exercise the rest.

## 9. Known limitations, stated once more for clarity

- No true drag-move across containers, no CSS Grid area painter, no
  multi-select align/distribute, no cross-page component sync, no
  scroll-triggered animation, no structural DOM diff, no live
  multi-user collaboration - see §2 for what real, working alternative
  exists for each of these.
- The visual editor was not tested in an actual browser (none available
  in the environment this was built in) - only syntax/reference-checked
  and unit-tested at the logic level. If you hit a rendering or
  interaction bug, that's the most likely place for one to be hiding.
- The in-memory login throttle resets on server restart and is
  per-process, not distributed - fine for a single local instance, not a
  substitute for a real WAF if you're exposing this to the open internet.
- A dedicated navigation-manager UI (Section 38 of a "build me a CMS"
  brief like this usually asks for one) wasn't built as a separate
  feature - general element editing already covers reordering/renaming/
  linking nav items, since a site nav is just links like any other
  element here.
