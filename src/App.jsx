import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ContentContext } from './state/ContentContext.js';
import { useAppState } from './state/appState.js';
import { useContent } from './hooks/useContent.js';
import { useReducedMotion } from './hooks/useReducedMotion.js';
import { useSceneSync } from './hooks/useSceneSync.js';
import { DEFAULT_UI } from './defaults.js';
import { initAnalytics, track } from './integrations/analytics.js';
import { applyMeta, applyTheme } from './theme.js';
import SkipLink from './components/SkipLink.jsx';
import Header from './components/Header.jsx';
import SceneCanvas from './components/SceneCanvas.jsx';
import HeroOverlay from './components/HeroOverlay.jsx';
import NoWebGLFallback from './components/NoWebGLFallback.jsx';
import Fab from './components/Fab.jsx';
import Drawer from './components/Drawer.jsx';
import FormModal from './components/FormModal.jsx';
import BookingModal from './components/BookingModal.jsx';
import MentorCard from './components/MentorCard.jsx';
import Toast from './components/Toast.jsx';

const DRAWER_ANIM_MS = 350;
let pageLoadTracked = false;

export default function App() {
  const { content, error } = useContent();
  const [state, a] = useAppState();
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [ctrl, setCtrl] = useState(null);
  const [toast, setToast] = useState(null);
  const scrollTimer = useRef(0);

  // Theme + head metadata (re-applied whenever content loads or changes)
  useEffect(() => {
    if (!content) return;
    applyTheme(content.theme);
    applyMeta(content);
  }, [content]);

  useEffect(() => {
    if (!content || pageLoadTracked) return;
    pageLoadTracked = true; // once per page view (StrictMode runs effects twice in dev)
    initAnalytics(content.analytics); // exactly once, before the first event; without it events only queue
    track('page_load', {});
  }, [content]);

  // Latest state for callbacks fired outside React (scene events, timers). Updated in a layout effect so it is
  // current before any later event can run.
  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; });
  // The drawer's *requested* state, updated synchronously, so rapid toggles (open/close/open within one frame)
  // compare against the latest request instead of a not-yet-rendered state.
  const drawerWanted = useRef(false);

  const modalOpen = state.formOpen || state.bookingOpen;
  // Camera zoom follows drawerOpen in the same commit as the drawer slide; scene input follows modalOpen.
  useSceneSync(ctrl, { drawerOpen: state.drawerOpen, modalOpen });

  const withScene = useCallback((fn) => {
    if (!ctrl) return undefined;
    try { return fn(ctrl); } catch { return undefined; }
  }, [ctrl]);

  // ---- flows -------------------------------------------------------------
  const openForm = useCallback((where) => {
    if (where) track('cta_click', { where });
    a.setMenu(false);
    a.setForm(true);
  }, [a]);

  const setDrawerOpen = useCallback((open) => {
    if (drawerWanted.current === open) return;
    const s = stateRef.current;
    if (open && (s.formOpen || s.bookingOpen)) return; // modals sit on top; the drawer cannot be opened underneath them
    drawerWanted.current = open;
    if (!open) {
      clearTimeout(scrollTimer.current); // a pending "scroll to section" must not run against a closing drawer
      const drawer = document.getElementById('drawer');
      if (drawer?.contains(document.activeElement)) document.querySelector('[data-fab]')?.focus({ preventScroll: true });
    }
    a.setDrawer(open);
  }, [a]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);
  const openDrawer = useCallback(() => setDrawerOpen(true), [setDrawerOpen]);
  const toggleDrawer = useCallback(() => {
    const open = !drawerWanted.current;
    if (open) track('know_more_click', {});
    setDrawerOpen(open);
  }, [setDrawerOpen]);

  // Stage walk: latest request wins (the scene cancels the previous walk). `walkingTo` is set while a walk is in
  // flight; `stage` itself only changes on the scene's 'stagechange' (walk complete).
  const stageReq = useRef(0);
  const walkTarget = useRef(null); // synchronous mirror of state.walkingTo (state lags by a render)
  const setStage = useCallback((n) => {
    const target = Math.max(0, Math.min(2, n));
    if (!ctrl) { a.setStage(target); return; }
    if (walkTarget.current === target) return; // same request already in flight
    const id = ++stageReq.current;
    walkTarget.current = target;
    a.setWalking(target);
    const done = () => {
      if (id !== stageReq.current) return; // superseded by a newer request
      walkTarget.current = null;
      a.setWalking(null);
      a.setStage(ctrl.getStage());
    };
    Promise.resolve(withScene((c) => c.setStage(target))).then(done, done);
  }, [a, ctrl, withScene]);

  const navigate = useCallback((target) => {
    track('nav_click', { target });
    a.setMenu(false);
    const wasOpen = drawerWanted.current;
    if (!wasOpen) openDrawer();
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!drawerWanted.current) return;
      document.getElementById(target)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }, wasOpen ? 0 : (reducedMotion ? 120 : DRAWER_ANIM_MS));
  }, [a, openDrawer, reducedMotion]);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);

  const onFormSuccess = useCallback(async () => {
    a.setForm(false);
    if (content) setToast({ id: Date.now(), message: content.ui.form.successToast });
    const s = stateRef.current;
    // Only play the cohort-join walk from the Apply stage and when no other walk is running; otherwise the
    // character has already moved on and a join would drag it back to the ring.
    if (ctrl && s.stage === 0 && s.walkingTo === null) {
      try { await ctrl.playCohortJoin(); } catch { /* scene error: continue to booking */ }
    }
    a.setBooking(true, true);
  }, [a, ctrl, content]);

  const closeBooking = useCallback(() => {
    const fromApply = stateRef.current.applied;
    a.setBooking(false);
    if (fromApply && stateRef.current.stage === 0) setStage(1);
  }, [a, setStage]);

  // ---- scene events -> UI ------------------------------------------------
  // While the drawer is open the scene is in world view and the character is not an apply/advance target: those
  // taps are swallowed (they must not close the drawer either, see SceneCanvas). A walk in flight also ignores taps.
  const onSceneApply = useCallback(() => {
    const s = stateRef.current;
    if (s.drawerOpen || s.formOpen || s.bookingOpen) return;
    openForm('hero');
  }, [openForm]);

  const onAdvance = useCallback(() => {
    const s = stateRef.current;
    if (s.drawerOpen || s.formOpen || s.bookingOpen || s.walkingTo !== null) return;
    if (s.stage < 2) setStage(s.stage + 1);
  }, [setStage]);

  const onSceneStageChange = useCallback((n) => {
    const from = stateRef.current.stage;
    if (from !== n) track('stage_progress', { from, to: n });
    a.setStage(n);
  }, [a]);

  const onMentor = useCallback((id, screen) => a.setMentor(id, screen), [a]);

  // Escape: mentor card, then drawer (dialogs and the menu handle their own Escape)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const s = stateRef.current;
      if (s.formOpen || s.bookingOpen || s.menuOpen) return;
      if (s.mentorId) { a.setMentor(null); return; }
      if (s.drawerOpen) closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [a, closeDrawer]);

  if (error) return <div className="boot"><p role="alert">{DEFAULT_UI.contentError}</p></div>;
  if (!content) return <div className="boot" role="status" aria-label={DEFAULT_UI.loading}><div className="boot__spinner" aria-hidden="true" /></div>;

  const { ui } = content;
  const mentor = state.mentorId ? content.mentors.find((m) => m.id === state.mentorId) : null;
  const dismissToast = () => setToast(null);

  return (
    <ContentContext.Provider value={content}>
      <SkipLink label={ui.skipLink} />
      <div className={`app${state.drawerOpen ? ' app--drawer' : ''}${state.menuOpen ? ' app--menu' : ''}`} inert={modalOpen || undefined}>
        <Header content={content} menuOpen={state.menuOpen} onMenu={a.setMenu} onApply={() => openForm('header')} onNavigate={navigate} />
        <main id="main" tabIndex={-1}>
          {sceneFailed ? (
            <NoWebGLFallback content={content} onApply={() => openForm('fallback')} />
          ) : (
            <>
              <SceneCanvas
                content={content} reducedMotion={reducedMotion} paused={paused} drawerOpen={state.drawerOpen}
                keyboardRotate={!modalOpen && !state.menuOpen && !state.drawerOpen}
                onController={setCtrl} onApply={onSceneApply} onStageChange={onSceneStageChange} onAdvance={onAdvance}
                onMentor={onMentor} onFallback={() => setSceneFailed(true)} onBackgroundTap={closeDrawer} />
              <HeroOverlay content={content} stage={state.stage} drawerOpen={state.drawerOpen} hasScene={!!ctrl} paused={paused} walking={state.walkingTo !== null}
                onApply={() => openForm('hero')} onSelectStage={setStage} onRotate={(r) => withScene((c) => c.rotateBy(r))}
                onTogglePause={() => setPaused((p) => !p)} />
            </>
          )}
          <Fab label={content.hero.fabLabel} open={state.drawerOpen} onToggle={toggleDrawer} openLabel={ui.fabOpenLabel} closeLabel={ui.fabCloseLabel} />
        </main>
        <Drawer content={content} open={state.drawerOpen} onClose={closeDrawer} onApply={() => openForm('drawer')}
          onBook={() => { track('cta_click', { where: 'drawer' }); a.setBooking(true, false); }} onNavigate={navigate}
          onSelectMentor={a.setMentor} activeMentorId={state.mentorId} reducedMotion={reducedMotion} />
        <MentorCard mentor={mentor} pos={state.mentorPos} ui={ui} onClose={() => a.setMentor(null)} />
      </div>
      <FormModal open={state.formOpen} onClose={() => a.setForm(false)} onSuccess={onFormSuccess} content={content} />
      <BookingModal open={state.bookingOpen} onClose={closeBooking} content={content} />
      <Toast toast={toast} onDismiss={dismissToast} dismissLabel={ui.toastDismiss} />
    </ContentContext.Provider>
  );
}
