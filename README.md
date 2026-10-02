# The Circle · Sales School: landing page app

React 19 + Vite + Three.js. All copy, colors, images, links and URLs come from `public/data/content.json`, fetched at runtime.

## Run

```bash
cd app
npm install
npm run dev        # http://localhost:5173  (add ?debug for the scene FPS meter, dev only)
npm run build      # production build to dist/
npm run preview    # serve dist/ at http://localhost:4173
npm run check:theme  # WCAG contrast check of content.json > theme
npm run todo       # regenerate ../CONTENT_TODO.md (every [PLACEHOLDER] value)
```

## Edit content
Edit `public/data/content.json` and reload. No code changes are needed for:
- copy, numbers, FAQ, timeline, mentors, fee, footer links (`hero`, `valueProps`, `timeline`, `fees`, `faq`, `mentors`, `footer`)
- interface strings, aria-labels and validation messages (`ui`)
- images (`images.logo`, `images.companies[*].src`, `mentors[*].image`): URL or path under `public/`
- Calendly (`booking.calendlyUrl`, while it still contains `[PLACEHOLDER]` the booking modal shows "Calendly URL not configured" and an email fallback)
- form endpoint (`form.submitEndpoint`): empty = demo mode (nothing sent or stored); a URL = the form is POSTed there as JSON

Values containing `[PLACEHOLDER]` render as-is in production. In dev (`npm run dev`) they get a dotted underline (`data-placeholder`).

## Edit the theme
`content.json > theme.colors` (UI) and `theme.scene` (3D). `applyTheme()` in `src/theme.js` writes them to CSS variables (`--color-*`) and the scene reads `theme.scene`. After changing colors run `npm run check:theme`. In dev, a failing pair also logs a console warning.

## Structure
```
index.html
src/main.jsx, App.jsx        entry, wiring of all flows
src/state/                   appState.js (reducer: stage, drawer, form, booking, menu, mentor), ContentContext.js
src/hooks/                   useContent, useReducedMotion, useFocusTrap, useMounted, useInView
src/components/              one file per component (Header, HeroOverlay, StageIndicator, Fab, Drawer, sections, FormModal, BookingModal, Modal, MentorCard, SceneCanvas, SceneLoader, NoWebGLFallback, SkipLink, Toast, ...)
src/styles/                  tokens.css (design tokens + default theme), global, animations, components, header, hero, drawer, modals, forms, responsive
src/sceneLoader.js           lazy import of ./scene/index.js (own chunk); a rejection shows NoWebGLFallback
src/hooks/useSceneSync.js    drawer <-> camera zoom and modal <-> scene input sync
src/scene/                   owned by Agent 2 (Three.js); UI only talks to it through app/INTERFACE.md
scripts/list-placeholders.mjs
public/images/               logo, mentors, companies, icons (neutral placeholders)
```
Only CSS variables are used in component CSS. Fonts (Outfit, Inter) are self-hosted through `@fontsource-variable/*` (woff2 emitted into `dist/assets`, `font-display: swap`).

## Flows
- Apply (header CTA, hero button, scene `applyrequest`, hint, fallback button) opens the form. Success: toast, `playCohortJoin()`, booking modal. Closing the booking modal after that flow calls `setStage(1)`.
- Know More toggles the drawer plus `zoomOut()` / `zoomIn()`. Drawer closes via X, Escape, swipe down on the handle bar (over 80px), or a tap on EMPTY scene (a tap on the character or a mentor keeps it open).
- Nav links open the drawer and scroll to the section id (`program`, `curriculum`, `outcomes`, `fees`, `faq`).
- Modals call `setInteractive(false)` while open and make the rest of the page `inert`.
- If `createScene` rejects (no WebGL) or the scene emits `contextlost` / `error`, the static hero replaces the scene.

## Testing hooks
In dev, the live scene controller is exposed as `window.__scene` (use `.on(event, fn)`, `.getStage()`, etc.). Use `?debug` to enable scene debug output. See `docs/INTEGRATION.md` for the state flow and event map.
