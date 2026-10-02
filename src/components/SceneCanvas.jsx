import { useEffect, useRef, useState } from 'react';
import { loadScene } from '../sceneLoader.js';
import { isMobileDevice } from '../utils/text.js';
import SceneLoader from './SceneLoader.jsx';

const ROTATE_STEP = 0.2; // radians per arrow key press

// Owns the <canvas>, creates the scene through sceneLoader, wires INTERFACE.md events, cleans up on unmount.
export default function SceneCanvas({
  content, reducedMotion, paused, drawerOpen, onController, onApply, onStageChange, onAdvance,
  onMentor, onFallback, onBackgroundTap, keyboardRotate
}) {
  // Set by scene events fired while handling the current tap, so the wrapper can tell "tap on empty scene" from
  // "tap on the character / a mentor / the form" without doing its own picking.
  const wrapRef = useRef(null);
  const [ctrl, setCtrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(0);
  const tapConsumed = useRef(false);

  // Latest props for event handlers without re-subscribing
  const h = useRef({});
  const initial = useRef({});
  useEffect(() => {
    h.current = { onApply, onStageChange, onAdvance, onMentor, onFallback, onBackgroundTap, drawerOpen, keyboardRotate, onController };
    initial.current = { content, reducedMotion, paused };
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    // A fresh canvas per effect run so StrictMode remounts never reuse a canvas that already has a context.
    const canvas = document.createElement('canvas');
    canvas.className = 'scene-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('data-scene-canvas', '');
    wrap.appendChild(canvas);

    let cancelled = false;
    let controller = null;
    const unsubs = [];
    let safety = 0;

    // Start on the next task: React StrictMode (dev) mounts, unmounts and re-mounts synchronously, and the
    // discarded first run must not spin up a renderer/WebGL context that is disposed a moment later.
    const startTimer = setTimeout(async () => {
      try {
        const { createScene } = await loadScene();
        const { content: c, reducedMotion: rm, paused: p } = initial.current;
        const params = new URLSearchParams(window.location.search);
        const scene = await createScene({
          canvas, theme: c.theme, content: c, reducedMotion: rm,
          isMobile: isMobileDevice(), debug: import.meta.env.DEV && params.has('debug')
        });
        if (cancelled) { scene.dispose(); return; }
        controller = scene;
        if (import.meta.env.DEV) window.__scene = scene; // dev/QA hook only (stripped from production builds)
        unsubs.push(
          scene.on('stagechange', (e) => h.current.onStageChange?.(e.stage)),
          scene.on('applyrequest', () => { tapConsumed.current = true; h.current.onApply?.(); }),
          scene.on('stageadvancerequest', () => { tapConsumed.current = true; h.current.onAdvance?.(); }),
          scene.on('mentorselect', (e) => { if (e?.mentorId) tapConsumed.current = true; h.current.onMentor?.(e?.mentorId ?? null, e?.screen); }),
          scene.on('ready', () => setReady(true)),
          scene.on('progress', (e) => setRatio(e?.ratio ?? 0)),
          scene.on('contextlost', (e) => h.current.onFallback?.(e?.error || new Error('contextlost'))),
          scene.on('error', (e) => h.current.onFallback?.(e?.error || new Error('scene error')))
        );
        if (p) scene.setPaused(true);
        setCtrl(scene);
        h.current.onController?.(scene);
        safety = setTimeout(() => setReady(true), 800);
      } catch (err) {
        if (!cancelled) h.current.onFallback?.(err);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(safety);
      unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
      try { controller?.dispose(); } catch { /* ignore */ }
      if (import.meta.env.DEV && window.__scene === controller) delete window.__scene;
      h.current.onController?.(null);
      setCtrl(null);
      setReady(false);
      canvas.remove();
    };
  }, []);

  // Live env updates
  useEffect(() => { ctrl?.setTheme(content.theme); }, [ctrl, content.theme]);
  useEffect(() => { ctrl?.setReducedMotion(reducedMotion); }, [ctrl, reducedMotion]);
  useEffect(() => { ctrl?.setPaused(paused); }, [ctrl, paused]);

  // Tap on EMPTY scene while the drawer is open closes it. A drag (rotate) does not, and neither does a tap the scene
  // handled (character, form panel, mentor): the canvas' own pointerup runs first (bubbling) and emits its events
  // synchronously, which set tapConsumed before this wrapper handler looks at it.
  useEffect(() => {
    const wrap = wrapRef.current;
    let start = null;
    const down = (e) => { tapConsumed.current = false; start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; };
    const up = (e) => {
      const s = start;
      start = null;
      if (!s || s.id !== e.pointerId || !h.current.drawerOpen) return;
      const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      const quick = performance.now() - s.t < 500;
      if (moved < 8 && quick && !tapConsumed.current) h.current.onBackgroundTap?.();
    };
    wrap.addEventListener('pointerdown', down);
    wrap.addEventListener('pointerup', up);
    const cancel = () => { start = null; };
    wrap.addEventListener('pointercancel', cancel);
    return () => { wrap.removeEventListener('pointerdown', down); wrap.removeEventListener('pointerup', up); wrap.removeEventListener('pointercancel', cancel); };
  }, []);

  // Keyboard equivalent of dragging: arrow keys rotate the globe when focus is on the page body
  useEffect(() => {
    if (!ctrl) return undefined;
    const onKey = (e) => {
      if (!h.current.keyboardRotate || e.defaultPrevented) return;
      if (e.target !== document.body) return;
      if (e.key === 'ArrowLeft') { ctrl.rotateBy(-ROTATE_STEP); e.preventDefault(); }
      if (e.key === 'ArrowRight') { ctrl.rotateBy(ROTATE_STEP); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctrl]);

  return (
    <div className="scene" ref={wrapRef}>
      <SceneLoader ready={ready} ratio={ratio} logo={content.images.logo} logoAlt={content.images.logoAlt}
        siteName={content.site.name} label={content.ui.loading} />
    </div>
  );
}
