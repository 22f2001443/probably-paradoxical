# AGENTS.md — Probably Paradoxical Portal

This file is the authoritative guide for any AI coding agent (Claude Code,
Copilot, Cursor, etc.) working on this codebase. Read it completely before
making changes.

---

## Project Purpose

Frontend portal for **Probably Paradoxical**, a team-based statistical paradox
exploration competition run as part of **Paradox'26 at IIT Madras**. The
frontend app lives in `frontend/`; `backend/` is currently a placeholder for
future backend work.

The portal serves:
- Public visitors (event info, guidelines, timeline, judges, teams)
- Registered teams (login, submission dashboard — not yet built)

---

## Tech Stack

| Tool | Role |
|---|---|
| Vue 3 (Composition API, `<script setup>`) | UI framework |
| Vite + `@tailwindcss/vite` | Build tool + CSS pipeline |
| Tailwind CSS v4 | Utility-first styling |
| Vue Router 4 | Client-side routing |
| Pinia | State management |
| `@mdi/js` | SVG icon paths (Material Design Icons) |
| `vue-toastification` | Toast notifications |
| `@headlessui/vue` | Accessible UI primitives |
| `js-yaml` (build-only) | YAML → JS transform via inline Vite plugin |

---

## Content System — `content.yml`

**All site content lives in `frontend/src/data/content.yml`.**

```
frontend/src/data/
  content.yml   ← edit this to update text, stages, links, embeds, copyright
  eventData.js  ← thin adapter that re-exports named constants from content.yml
```

### What lives in `content.yml`

| Key path | What it controls |
|---|---|
| `event.name` | Brand name shown in header and footer |
| `event.edition` | Sub-line ("Paradox'26 · IIT Madras") |
| `event.copyright` | Footer copyright line |
| `nav.links` | Header navigation links (label + route) |
| `hero.*` | Hero section heading, subtitle, description, stat cards |
| `overview.cards` | The four event overview cards |
| `timeline.stages` | Stage 0–4 titles, descriptions, status |
| `guidelines.googleDocUrl` | Paste any Google Doc link — it auto-embeds |
| `social.feeds` | Instagram / YouTube / LinkedIn embed URLs |

### How to embed a Google Doc (guidelines)

1. Open the Google Doc → Share → "Anyone with the link can view".
2. Copy the share URL (any format: `/edit`, `/view`, `/pub`).
3. Paste it into `content.yml` at `guidelines.googleDocUrl`.
4. The Guidelines page converts it to a preview embed URL automatically.

### How to add social media posts

```yaml
social:
  feeds:
    - platform: instagram
      label: "Post caption or description"
      embedUrl: "https://www.instagram.com/p/POST_SHORTCODE/embed/"

    - platform: youtube
      label: "Video title"
      embedUrl: "https://www.youtube.com/embed/VIDEO_ID"

    - platform: linkedin
      label: "LinkedIn post"
      embedUrl: "https://www.linkedin.com/embed/feed/update/urn:li:share:SHARE_ID"
```

- Leave `embedUrl: ""` to show a branded placeholder instead of an error.
- Add as many items as needed — the carousel pages through them 3 at a time.

### Rules for agents modifying content

- **Never hardcode text that belongs in `content.yml` inside a component.**
- To add a new configurable field: add it to `content.yml`, then import
  `config` from `'../../data/content.yml'` (or use `eventData.js` re-exports).
- Do not use `frontend/src/data/eventData.js` for new logic — it is a thin adapter only.

---

## Folder Structure Rules

```
frontend/src/
  assets/           Static assets (images, fonts)
  components/
    layout/         AppHeader, AppFooter, PublicLayout — shared shell components
    common/         BaseButton, BaseCard, StatusBadge, SectionHeader, StatCard — reusable atoms
    home/           Section components for the home page ONLY
  pages/            One file per route. Route-level components only.
  router/           index.js — all route definitions live here
  stores/           Pinia stores — one file per domain (authStore, eventStore)
  data/             eventData.js — static content arrays/objects (no API calls)
  App.vue           Root component — ONLY mounts <RouterView />
  main.js           App bootstrap — plugins registered here, nothing else
  style.css         @import "tailwindcss" and base overrides only
```

### Hard rules
- `frontend/src/components` → **reusable components only**. Do not put page-level code here.
- `frontend/src/pages` → **route-level pages only**. One file per route. Pages compose components; they do not contain repeated markup.
- `frontend/src/components/layout` → `AppHeader`, `AppFooter`, `PublicLayout`. Do not move these elsewhere.
- `frontend/src/components/common` → generic atoms and molecules usable on any page.
- Home page is assembled in `frontend/src/pages/HomePage.vue` using section components from `frontend/src/components/home/`.
- **Do not dump entire page HTML into `App.vue`**. `App.vue` stays minimal.
- Static data (stat values, timeline stages, card text) belongs in `frontend/src/data/eventData.js`, not inside component templates.

---

## Component Naming Rules

- PascalCase for all `.vue` files: `AppHeader.vue`, `BaseButton.vue`, `HeroSection.vue`.
- Layout wrappers: `App*` prefix — `AppHeader`, `AppFooter`.
- Generic atoms: `Base*` prefix — `BaseButton`, `BaseCard`.
- Page sections: descriptive + `Section` suffix — `HeroSection`, `CTASection`.
- Pages: descriptive + `Page` suffix — `HomePage`, `LoginPage`.
- Stores: camelCase + `Store` suffix — `authStore.js`, `eventStore.js`.

---

## Styling Rules

- Use **Tailwind CSS utility classes** directly. Do not write custom CSS unless
  there is no Tailwind equivalent.
- Colour palette: `bg-white`, `text-neutral-950`, `text-neutral-500`, `border-neutral-200`.
- **One accent colour only: `violet-600` / `violet-700`**. No other brand colours.
- No gradients, glassmorphism, heavy box-shadows, or decorative blobs.
- No dark mode until explicitly requested.
- Typography: Inter (loaded from Google Fonts in `index.html`). Use Tailwind's
  default `font-sans` stack with `font-family: 'Inter', system-ui, sans-serif`.
- Responsive: design mobile-first. All sections must work on screens ≥ 320 px.
- Use semantic HTML elements: `<header>`, `<nav>`, `<main>`, `<section>`,
  `<article>`, `<footer>`, `<ol>`, `<ul>`.

---

## Icon Usage

- Icons come from `@mdi/js` (SVG path strings).
- **Do not** use icon font classes or CDN icon fonts.
- Inline usage pattern:
  ```html
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 text-violet-600">
    <path fill="currentColor" :d="mdiSomeIcon" />
  </svg>
  ```
- Import the path constant at the top of `<script setup>`:
  ```js
  import { mdiMagnify } from '@mdi/js'
  ```

---

## Routing Rules

All routes are defined in `frontend/src/router/index.js`.

| Path | Page | Notes |
|---|---|---|
| `/` | `HomePage` | Public |
| `/guidelines` | `GuidelinesPage` | Public |
| `/timeline` | `TimelinePage` | Public |
| `/teams` | `TeamsPage` | Public |
| `/judges` | `JudgesPage` | Public |
| `/login` | `LoginPage` | Public |
| `/:pathMatch(.*)` | `NotFoundPage` | Catch-all |

- Use `createWebHistory()` (no hash routing).
- Each route must set `meta.title`; the router's `afterEach` hook updates
  `document.title`.
- Lazy-load every page with `() => import(...)`.
- Future protected routes must use a navigation guard in `router/index.js`.

---

## State Management Rules

- Global state lives in Pinia stores under `frontend/src/stores/`.
- Use the **Composition API store pattern** (`defineStore('id', () => { ... })`).
- Do not use Vuex.
- `authStore` — authentication state (user, token, isAuthenticated).
- `eventStore` — event metadata (stages, teams, cards). Seeded from `eventData.js`.
- Do not put API call logic inside components — use stores.
- Do not persist sensitive data to `localStorage` without encryption.

---

## Toast Notification Rules

- Toasts are only for **user-triggered actions**: login attempt, form submission,
  upload, error responses.
- **Do not** show toasts on page load, navigation, or data fetching.
- Import with: `import { useToast } from 'vue-toastification'`
- Configured in `main.js` (bottom-right, 4 s timeout).

---

## What NOT To Do

| ❌ Don't | ✅ Do instead |
|---|---|
| Put page HTML in `App.vue` | Keep `App.vue` as `<RouterView />` only |
| Hardcode repeated arrays in templates | Move data to `frontend/src/data/eventData.js` |
| Add gradient backgrounds, blobs, animations | Keep it flat, minimal, black-and-white + violet |
| Use icon font CDNs (Font Awesome, Material Icons) | Use `@mdi/js` SVG paths |
| Use `<style scoped>` for layout | Use Tailwind utilities |
| Create admin/dashboard pages in this sprint | Placeholder `LoginPage` only for now |
| Add backend/API code | Frontend only; no `fetch`/`axios` calls yet |
| Add authentication guards | Placeholder stores only for now |
| Use CDN Tailwind (`<script src="...cdn.tailwindcss.com">`) | Use the Vite plugin pipeline |

---

## Development Commands

```bash
# Enter the frontend app
cd frontend

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build (outputs to frontend/dist/)
npm run build

# Preview production build locally
npm run preview
```

---

## Adding a New Page

1. Create `frontend/src/pages/MyNewPage.vue` — use `PublicLayout` as wrapper.
2. Add route in `frontend/src/router/index.js` with `meta.title`.
3. Add nav link in `frontend/src/data/content.yml` → `nav.links` if it should appear in the header.
4. Do not add logic to `App.vue` or `main.js`.

## Adding a New Reusable Component

1. Create file under `frontend/src/components/common/` (atom/molecule) or
   `frontend/src/components/layout/` (shell).
2. Accept all configurable values via `defineProps`.
3. Use a slot for arbitrary content.
4. Document the prop types inline with JSDoc comments.
