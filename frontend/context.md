# context.md — Probably Paradoxical Portal
> Complete project context for a new Claude agent taking this to production.
> Read this file fully before touching any code.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | Probably Paradoxical |
| **Type** | Event portal frontend; backend placeholder exists at `../backend/` |
| **Event** | Paradox'26 · IIT Madras |
| **Purpose** | Public-facing site for a team-based statistical paradox exploration competition. Teams choose a paradox, survey campus, analyse data, present findings across 5 stages. |
| **Owner** | Probably Paradoxical team |
| **Current branch** | `main` |
| **Node** | ≥ 18 required (project uses ES modules) |

---

## 2. Tech Stack — Exact Versions

```json
{
  "vue":               "^3.5.34",
  "vue-router":        "^5.0.7",
  "pinia":             "^3.0.4",
  "@mdi/js":           "^7.4.47",
  "@headlessui/vue":   "^1.7.23",
  "vue-toastification":"^2.0.0-rc.5",
  "vite":              "^8.0.12",
  "@vitejs/plugin-vue":"^6.0.6",
  "@tailwindcss/vite": "^4.3.0",
  "tailwindcss":       "^4.3.0",
  "js-yaml":           "^4.1.1"
}
```

Key decisions:
- **Tailwind CSS v4** — uses `@tailwindcss/vite` plugin (NOT postcss). Config is done via `@theme` in CSS, not `tailwind.config.js`.
- **vue-toastification `next` tag** — the `@latest` tag is Vue 2 only; `next` is the Vue 3 compatible release.
- **No `@mdi/vue`** — does not exist as a package. Icons are used as raw SVG path strings from `@mdi/js`, rendered inline with `<svg><path :d="mdiIconName" /></svg>`.
- **js-yaml** is a **devDependency** only — used exclusively in the custom Vite YAML plugin at build time; the YAML content is baked into the JS bundle as JSON.

---

## 3. Commands

```bash
cd frontend         # from the repository root
npm install          # install all dependencies
npm run dev          # dev server → http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview the dist/ build locally
```

**There are no test scripts yet.** Adding Vitest is a future task.

---

## 4. Folder Structure (complete)

```
probably-paradoxical/
├── AGENTS.md                      ← Agent rules (duplicate of key sections here)
├── README.md                      ← Repository overview
├── backend/                       ← Placeholder for future backend work
│   └── .gitkeep
│
└── frontend/
    ├── index.html                 ← Entry HTML; loads Inter font from Google Fonts
    ├── vite.config.js             ← Vite config with YAML plugin, Tailwind, Vue
    ├── package.json
    ├── context.md                 ← ← THIS FILE
    │
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    │
    └── src/
        ├── App.vue                ← Root component — ONLY contains <RouterView />
        ├── main.js                ← Bootstrap: Pinia + Router + Toastification
        ├── style.css              ← @import "tailwindcss" + base layer only
        │
        ├── data/
        │   ├── content.yml        ← ★ SINGLE SOURCE OF TRUTH for all content
        │   └── eventData.js       ← Thin adapter: named re-exports from content.yml
        │
        ├── router/
        │   └── index.js           ← All routes, lazy-loaded, with meta.title
        │
        ├── stores/
        │   ├── authStore.js       ← Auth state (placeholder — no real auth yet)
        │   └── eventStore.js      ← Event metadata seeded from eventData.js
        │
        ├── assets/
        │   ├── hero.png
        │   ├── vite.svg
        │   └── vue.svg
        │
        ├── components/
        │   ├── layout/
        │   │   ├── AppHeader.vue  ← Sticky header, desktop nav, mobile hamburger
        │   │   ├── AppFooter.vue  ← Footer with nav links + copyright from content.yml
        │   │   └── PublicLayout.vue
        │   │
        │   ├── common/
        │   │   ├── BaseButton.vue
        │   │   ├── BaseCard.vue
        │   │   ├── SectionHeader.vue
        │   │   ├── StatCard.vue
        │   │   └── StatusBadge.vue
        │   │
        │   └── home/
        │       ├── HeroSection.vue
        │       ├── EventOverviewSection.vue
        │       ├── TimelinePreviewSection.vue
        │       ├── PublicTeamsPreviewSection.vue
        │       ├── SocialFeedSection.vue
        │       └── CTASection.vue
        │
        └── pages/
            ├── HomePage.vue
            ├── GuidelinesPage.vue
            ├── TimelinePage.vue
            ├── TeamsPage.vue
            ├── JudgesPage.vue
            ├── LoginPage.vue
            └── NotFoundPage.vue
```

> `src/components/HelloWorld.vue` is a leftover from Vite scaffolding. Safe to delete.

---

## 5. Content System — `src/data/content.yml`

**This is the single file an organiser edits to update the site.** No Vue file should be touched for content changes.

### How it works
1. `vite.config.js` registers an inline Vite plugin that intercepts `*.yml` imports.
2. The plugin calls `jsYaml.load(src)` and returns `export default <JSON>`.
3. Any component can `import config from '../../data/content.yml'`.
4. In dev, editing `content.yml` triggers HMR. In production, a rebuild is needed.

### Schema

```yaml
event:
  name: string           # Brand name (header + footer)
  tagline: string
  edition: string        # "Paradox'26 · IIT Madras"
  copyright: string      # Footer: "© 2026 {copyright}"

nav:
  links:
    - label: string
      to: string         # Vue Router path

hero:
  eyebrow: string
  heading: string
  subtitle: string
  description: string
  stats:
    - value: string
      label: string

overview:
  eyebrow: string
  heading: string
  subheading: string
  cards:
    - icon: string       # @mdi/js export name e.g. "mdiMagnify"
      title: string
      description: string

timeline:
  eyebrow: string
  heading: string
  subheading: string
  stages:
    - stage: number      # 0–4
      title: string
      description: string
      status: completed | active | upcoming

guidelines:
  googleDocUrl: string   # Any Google Docs share URL — auto-converted to /preview embed

social:
  heading: string
  subheading: string
  feeds:
    - platform: instagram | youtube | linkedin
      label: string
      embedUrl: string   # Leave "" to show placeholder card
```

### Google Docs embed
`GuidelinesPage.vue` contains a `toGoogleDocsEmbedUrl()` function that strips `/edit`, `/view`, or `/pub` and replaces it with `/preview`. The document must be shared as "Anyone with the link can view".

### Social embeds
- **Instagram**: `https://www.instagram.com/p/{SHORTCODE}/embed/`
- **YouTube**: `https://www.youtube.com/embed/{VIDEO_ID}`
- **LinkedIn**: `https://www.linkedin.com/embed/feed/update/urn:li:share:{SHARE_ID}`

The carousel shows 3 per page. Adding more items extends pages automatically.

---

## 6. Component API Reference

### `BaseButton.vue`
```
props:
  variant: 'primary' | 'outline' | 'ghost'   default: 'primary'
  to:      String | Object                    renders as <RouterLink>
  href:    String                             renders as <a>
  disabled: Boolean

Colour map (black/white only):
  primary → bg-neutral-950 text-white hover:bg-neutral-800
  outline → border-neutral-950 hover:bg-neutral-950 hover:text-white
  ghost   → underline text-neutral-950 hover:text-neutral-600
```

### `BaseCard.vue`
```
props:
  hoverable: Boolean   default: false
  — adds group class, border darkens on hover, card lifts -translate-y-0.5
Slot: default
```

### `SectionHeader.vue`
```
props:
  eyebrow:    String   (optional) — small uppercase label above heading
  heading:    String   (required)
  subheading: String   (optional)
  align:      'left' | 'center'   default: 'left'
```

### `StatCard.vue`
```
props:
  value: String   (required) — large display number or word
  label: String   (required) — small label below
```

### `StatusBadge.vue`
```
props:
  status: 'completed' | 'active' | 'upcoming'   default: 'upcoming'

Visual map:
  completed → bg-neutral-950 text-white
  active    → bg-neutral-200 text-neutral-950 font-bold
  upcoming  → border border-neutral-300 text-neutral-400
```

### `PublicLayout.vue`
```
Wraps AppHeader + <slot> + AppFooter in a min-h-screen flex-col container.
All pages must use this as their root wrapper.
```

---

## 7. Routing Table

| Path | Component | Status |
|---|---|---|
| `/` | `HomePage` | ✅ Built |
| `/guidelines` | `GuidelinesPage` | ✅ Google Doc embed ready |
| `/timeline` | `TimelinePage` | ✅ Built |
| `/teams` | `TeamsPage` | 🔲 Placeholder |
| `/judges` | `JudgesPage` | 🔲 Placeholder |
| `/login` | `LoginPage` | 🔲 Form only — no real auth |
| `/:pathMatch(.*)` | `NotFoundPage` | ✅ Built |

All routes use `createWebHistory()` — **requires server-side wildcard fallback** in production (Nginx / Vercel / Netlify config needed).

Route titles are set via `meta.title` and updated in `router.afterEach()`.

---

## 8. State Management (Pinia)

### `authStore` (`src/stores/authStore.js`)
```js
state:   user (null), token (null)
getters: isAuthenticated (computed from token)
actions: setUser(userData, authToken), logout()
```
**Currently a placeholder.** No real token validation or API calls. The login form shows a toast but does not call `setUser`.

### `eventStore` (`src/stores/eventStore.js`)
```js
state:   stages (from content.yml), cards (from content.yml), teams ([])
actions: setTeams(data)
```
**Currently seeded from static YAML.** Will need to call an API when backend is ready.

---

## 9. Styling Rules — Non-Negotiable

| Rule | Detail |
|---|---|
| **No accent colour** | Pure black/white/neutral palette only |
| **Neutral scale** | `neutral-950` (black), `neutral-500` (muted text), `neutral-200` (borders), `neutral-50`/`neutral-100` (subtle bg) |
| **No gradients** | Flat backgrounds only |
| **No box shadows** | Borders convey depth instead |
| **No dark mode** | Light only until explicitly requested |
| **Typography** | Inter (Google Fonts, loaded in `index.html`) |
| **Icons** | `@mdi/js` SVG paths only — inline `<svg><path :d="mdiX" /></svg>` |
| **Tailwind v4** | No `tailwind.config.js`. Custom tokens go in `style.css` under `@theme {}` |

---

## 10. Icon Usage Pattern

```vue
<script setup>
import { mdiSomeIcon } from '@mdi/js'
</script>

<template>
  <svg viewBox="0 0 24 24" class="w-5 h-5 text-neutral-950" aria-hidden="true">
    <path fill="currentColor" :d="mdiSomeIcon" />
  </svg>
</template>
```

Do not use `<Icon>` components, font icons, or CDN icon scripts.

---

## 11. Toast Notification Rules

```js
import { useToast } from 'vue-toastification'
const toast = useToast()

toast.success('...')   // user action succeeded
toast.error('...')     // validation or API error
toast.info('...')      // neutral info (e.g. "login not active yet")
```

- **Only trigger on user actions**: login submit, form submission, upload, errors.
- **Never** on page load, route change, or background data fetch.
- Configured in `main.js`: bottom-right, 4s timeout, max 3 simultaneous.

---

## 12. Current Build Status

```
✅  npm run dev     — works, HMR on content.yml changes
✅  npm run build   — clean, 0 errors, 0 warnings
✅  npm run preview — works
```

Bundle sizes (gzip):
- `index.js` (Vue + Pinia + Router + Toast): **~45 KB**
- `index.css` (Tailwind): **~6.7 KB**
- `HomePage.js`: **~5 KB**
- All other pages: **< 1 KB** each (lazy loaded)

---

## 13. What Is Complete vs. Placeholder

### ✅ Complete and production-ready
- Home page (all 6 sections)
- App header (desktop + mobile responsive)
- App footer (copyright from content.yml)
- Public layout shell
- All 5 reusable common components
- All 6 home section components
- Timeline page (full, data-driven)
- Guidelines page (Google Doc embed + fallback)
- 404 page
- Router with lazy loading and title updates
- Content system via `content.yml`
- Social feed carousel (embeds + placeholders)
- Toast system configuration

### 🔲 Placeholder — needs production implementation
| Page/Feature | What's there | What's needed |
|---|---|---|
| `TeamsPage` | "Coming soon" div | Real team data from API or YAML |
| `JudgesPage` | "Coming soon" div | Judge cards from API or YAML |
| `LoginPage` | Form with fake delay + toast | Real API call, JWT/session, redirect to dashboard |
| `authStore` | Shell with setUser/logout | Token persistence (localStorage/cookie), refresh logic |
| `eventStore.teams` | Empty array | API fetch or YAML population |
| Dashboard | Does not exist | Authenticated team view — submissions, stage progress |
| Admin panel | Does not exist | Organiser view — manage teams, update stages |
| Backend/API | Does not exist | Auth endpoint, submission endpoints, data endpoints |

---

## 14. Production Deployment Checklist

### Server config required
`createWebHistory()` means the server must return `index.html` for all routes:

**Nginx:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Vercel** (`vercel.json`):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Netlify** (`public/_redirects`):
```
/*  /index.html  200
```

### Environment variables
None currently required (no API yet). When backend is added:
```
VITE_API_BASE_URL=https://api.example.com
```
Use `import.meta.env.VITE_*` inside Vue files. Never use `process.env` in Vite.

### Content updates before go-live
Edit `src/data/content.yml` then rebuild:
1. Set `timeline.stages[*].status` correctly (completed / active / upcoming)
2. Add `guidelines.googleDocUrl` once the document is ready
3. Add `social.feeds[*].embedUrl` for each platform post

---

## 15. Next Feature Roadmap (priority order)

1. **Teams page** — populate from YAML list or API; show team name, paradox chosen, stage badge
2. **Judges page** — judge cards with name, title, affiliation from YAML
3. **Real authentication** — POST `/auth/login` → JWT stored in `authStore` with Pinia `persist` plugin; guard `/dashboard` route
4. **Team dashboard** — stage-by-stage submission UI (upload files, see status)
5. **Admin panel** — manage team credentials, advance stages, view all submissions
6. **Results page** — post-event; show rankings and summaries

---

## 16. Hard Rules — Do Not Violate

| ❌ Never | ✅ Instead |
|---|---|
| Put page HTML in `App.vue` | `App.vue` is `<RouterView />` only |
| Hardcode content strings in components | All strings belong in `content.yml` |
| Use violet, purple, blue, or any accent colour | Neutral 950/500/200 only |
| Import `@mdi/vue` (doesn't exist) | Use `@mdi/js` path strings inline |
| Use `process.env` | Use `import.meta.env.VITE_*` |
| Use hash routing (`createWebHashHistory`) | Use `createWebHistory` (requires server config) |
| Add CDN Tailwind script tag | Use the Vite plugin pipeline |
| Use `tailwind.config.js` | Use `@theme {}` in `style.css` |
| Use the `<style scoped>` block for layout | Use Tailwind utilities |
| Show toasts on page load | Toasts on user actions only |
| Create new pages in `src/components/` | Pages go in `src/pages/` only |
| Add backend/API logic to Vue files directly | Create a `src/services/` layer, call from stores |

---

## 17. Key Import Paths (reference)

```js
// Content (the most important import)
import config from '../data/content.yml'              // full config object
import { heroStats, navLinks, eventMeta } from '../data/eventData.js'  // named shorthands

// Layout
import PublicLayout from '../components/layout/PublicLayout.vue'

// Common atoms
import BaseButton   from '../components/common/BaseButton.vue'
import BaseCard     from '../components/common/BaseCard.vue'
import SectionHeader from '../components/common/SectionHeader.vue'
import StatCard     from '../components/common/StatCard.vue'
import StatusBadge  from '../components/common/StatusBadge.vue'

// Icons (examples)
import { mdiMagnify, mdiChartBar, mdiChevronLeft } from '@mdi/js'

// State
import { useAuthStore }  from '../stores/authStore.js'
import { useEventStore } from '../stores/eventStore.js'

// Router
import { useRouter, useRoute, RouterLink } from 'vue-router'

// Toast
import { useToast } from 'vue-toastification'
```

---

## 18. Adding New Content to `content.yml`

### Add a new nav link
```yaml
nav:
  links:
    - label: Results      # ← new
      to: /results
```
Then add the route in `src/router/index.js` and create `src/pages/ResultsPage.vue`.

### Update a timeline stage status
```yaml
timeline:
  stages:
    - stage: 2
      status: active      # change from 'upcoming' to 'active'
```
All three places that show timeline data (home preview, full timeline page, event store) update automatically.

### Add a social post
```yaml
social:
  feeds:
    - platform: instagram
      label: "Opening ceremony"
      embedUrl: "https://www.instagram.com/p/ABC123xyz/embed/"
```

### Embed the guidelines document
```yaml
guidelines:
  googleDocUrl: "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit?usp=sharing"
```
The page converts this to a `/preview` URL automatically. The Google Doc must be set to "Anyone with the link can view".

---

## 19. Codebase Health

- Zero TypeScript — pure JS + Vue SFCs
- Zero CSS files except `src/style.css` (3 lines)
- Zero custom CSS classes in components — 100% Tailwind utilities
- No `<style scoped>` blocks anywhere
- No inline `style=""` attributes except one `clamp()` on the guidelines iframe height
- All routes lazy-loaded (`() => import(...)`)
- All pages wrapped in `PublicLayout` — consistent header/footer guaranteed
- `src/components/HelloWorld.vue` is unused scaffolding — safe to delete
