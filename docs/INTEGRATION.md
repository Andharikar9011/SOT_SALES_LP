# Integration: state flow, event map, limitations

Owner: Agent 4. Scope: how the React UI, the Three.js scene and the modals stay in sync. The original brief described vanilla JS managers; here the same responsibilities map to React like this:

| Brief deliverable | Where it lives |
|---|---|
| state-manager.js | `src/state/appState.js` (reducer) plus a few synchronous refs in `src/App.jsx` |
| modal-manager.js | `Modal.jsx`, `useFocusTrap`, `useMounted` (animation), `FormModal`/`BookingModal` (Agent 5 logic) |
| drawer-manager.js | `Drawer.jsx` (slide, swipe), `App.jsx` (`setDrawerOpen`, `navigate`) |
| event-manager.js | React handlers; one `keydown` listener (Escape) in `App.jsx`; scene events in `SceneCanvas.jsx` |
| animation-controller.js | CSS tokens (`--dur-*`, `--ease-*`) for DOM, scene tween manager for 3D; one commit drives both (see Sync) |
| 3d-bridge.js | `SceneCanvas.jsx` (scene -> UI), `hooks/useSceneSync.js` (UI -> scene camera and input) |
| utils.js | `utils/text.js` |

## State

`useAppState()` holds: `stage` (0 Apply, 1 Learn, 2 Placed), `walkingTo` (target stage while a walk is in flight, else `null`), `drawerOpen`, `formOpen`, `bookingOpen`, `menuOpen`, `mentorId` + `mentorPos`, `applied`.

Rules:
- `stage` follows the scene: it changes on the scene's `stagechange` (walk complete), not on the click.
- `drawerOpen` is the single source for camera zoom; `formOpen || bookingOpen` is the single source for scene input.
- Two synchronous refs guard rapid input, because React state lags by one render: `drawerWanted` (latest requested drawer state) and `walkTarget` (latest requested stage).

## Flow diagram

```
                       ┌────────────── Escape / X / swipe-down handle / tap EMPTY scene / FAB ─────────────┐
                       v                                                                                   │
  HERO (drawer closed) ──FAB / nav link / footer link──> DRAWER OPEN ─────────────────────────────────────┘
   │  scene: close-up, input on          (drawer slides 300ms + scene zoomOut 300ms, same commit)
   │                                          │  mentor chip / scene mentor tap -> MentorCard (drawer stays open)
   │                                          │  character / form tap -> swallowed (drawer stays open)
   │                                          └── CTA (drawer) ──┐
   ├── header CTA / hero CTA / hint / scene applyrequest / fallback CTA ──┤
   v                                                                     v
  FORM MODAL (scene input off; drawer, if open, stays open underneath; camera not touched)
   │ submit ok
   v
  toast + (stage 0 and no walk in flight ? scene.playCohortJoin() : skip) ──> BOOKING MODAL (applied = true)
   │ close
   v
  applied && stage == 0 ? setStage(1) : nothing            (Fees "talk" CTA opens BOOKING directly, applied = false)

  Stage walk:   click stage button / hint / scene stageadvancerequest
                 -> walkingTo = n (latest request wins; same target deduped)
                 -> scene.setStage(n) ... scene 'stagechange' -> stage = n, track stage_progress {from,to}
                 -> promise settles -> walkingTo = null (only if this is still the latest request)
```

## Sync rules (drawer, zoom, modals, walks)

1. Drawer and camera: `useSceneSync` runs `zoomOut()`/`zoomIn()` in a **layout effect** keyed on `drawerOpen`. It runs in the same React commit as the `drawer--open` class change, so the 300ms CSS slide and the 300ms camera tween start together (measured in Chromium: class change and `zoomOut` call 0 to 3 ms apart).
2. Rapid toggling: calls only fire on a real state change (no double calls). Several toggles inside one task batch into the final state. The scene cancels an in-flight zoom tween and continues from the current camera value, so there is no stuck half-zoom.
3. Modals never change the camera. A modal opened over the open drawer leaves the zoomed-out framing; closing it restores `setInteractive(true)`. Opening the drawer while a modal is open is refused.
4. Pending "scroll to section" timers are cleared when the drawer closes.
5. While the drawer is open: hero overlay is `inert` and hidden; scene `applyrequest` and `stageadvancerequest` are ignored; a tap on empty scene closes the drawer.
6. While a walk is in flight: hint hidden, `aria-busy` on the hero, scene advance taps ignored, stage buttons still work (latest wins), the drawer and modals can still open. Cohort join is skipped when a walk is running or stage != 0.

## Event map: scene -> UI

| Scene event | UI action |
|---|---|
| `applyrequest` | open form (`cta_click {where:'hero'}`); ignored if the drawer or a modal is open |
| `stageadvancerequest` | `setStage(stage+1)`; ignored if drawer/modal open or a walk is in flight |
| `stagechange {stage}` | `stage = n`; `track('stage_progress', {from,to})` when it changed; announced via `aria-live` caption |
| `mentorselect {mentorId, screen}` | show `MentorCard` at `screen`; `null` hides it. A non-null id also marks the tap as handled |
| `ready` / `progress` | hide / fill the loader |
| `contextlost` / `error` | replace the scene with `NoWebGLFallback` |
| `createScene` rejects | same fallback (WebGL unavailable) |

Tap rule (user decision): the canvas wrapper sees the same pointer-up after the canvas. The scene emits its events synchronously in that pointer-up, which set a `tapConsumed` flag; if the drawer is open and the tap was a short, non-moving tap with no scene event, the drawer closes. Drags (rotate) never close it.

UI -> scene: `zoomOut/zoomIn` (drawer), `setStage`, `playCohortJoin` (after form submit), `rotateBy` (buttons, arrow keys), `setInteractive` (modals), `setTheme`, `setReducedMotion`, `setPaused`.

## Analytics (through `integrations/analytics.js`)

`initAnalytics(content.analytics)` runs once after content loads, then `page_load`. Fired here: `know_more_click {open}`, `stage_progress {from,to}`, `cta_click {where: header|hero|drawer|fallback}`, `faq_toggle {index,open}`, `nav_click {target}`. Form and booking events belong to the modals.

## Lifecycle and cleanup

- `SceneCanvas` creates its canvas and scene in a `setTimeout(0)`: React StrictMode's synchronous mount/unmount/mount never builds a throw-away renderer. Verified in dev: 1 canvas, 1 WebGL context.
- Cleanup unsubscribes all scene events, calls `dispose()` (idempotent in the scene) and removes the canvas. A `createScene` that resolves after unmount is disposed immediately.
- Scene render loop pauses on `document.hidden` (scene-side). Verified with a simulated hidden state (see limitations).
- Dev only: `window.__scene` is the live controller (removed from production builds).

## Known limitations

- Scene taps: the scene does not report "a tap hit nothing". A tap on the hero/form panel that the scene does not turn into an event (for example the character at stage 0 after cohort join, or the form panel at stage 1 or 2) is treated as empty scene and closes the drawer when it is open. A `tap {hit}` event from the scene would make this exact.
- With the drawer open, tapping the character does nothing (apply/advance are swallowed on purpose).
- `contextlost` goes straight to the static fallback; there is no attempt to restore the scene.
- Hidden-tab pause was verified by overriding `document.hidden` (rAF calls/s 60 -> 0 -> 60), not with a truly backgrounded tab.
- No real-device FPS, touch-gesture or battery testing has been done; headless Chromium with software GL only.
- In dev (StrictMode) `form_open` and `booking_open` fire twice because the modals track in a mount effect; production fires once. (Modal files belong to Agent 5.)
- OG image is a placeholder and `og:image` should be an absolute URL at deploy time; legal pages are placeholders (`[PLACEHOLDER] legal text to be supplied`).
- Footer legal links point to `/privacy.html`, `/terms.html`, `/refund.html` (static files in `public/`), because a dev server would route extensionless paths to the SPA.
