import { useLayoutEffect, useRef } from 'react';

// Keeps the scene camera and input in step with UI state. The UI state is the single source of truth:
//  - camera: zoomOut() while the drawer is open, zoomIn() otherwise. Runs in a LAYOUT effect, so it fires in the same
//    commit (same frame, before paint) as the drawer's CSS class change, i.e. the 300ms slide and the 300ms zoom
//    start together. It only fires on a real change (no double calls); the scene cancels an in-flight zoom tween and
//    continues from the current camera value, so open/close/open never sticks halfway.
//  - input: the scene ignores pointer input while any modal is open, and is restored when the last modal closes.
//    Modals do not touch the camera, so a modal opened over the drawer leaves the zoomed-out framing untouched.
export function useSceneSync(ctrl, { drawerOpen, modalOpen }) {
  const applied = useRef(false); // zoom state last sent to the CURRENT controller (false = close-up, the scene default)

  useLayoutEffect(() => {
    applied.current = false; // a new controller always starts at the close-up shot
  }, [ctrl]);

  useLayoutEffect(() => {
    if (!ctrl || applied.current === drawerOpen) return;
    applied.current = drawerOpen;
    try {
      const p = drawerOpen ? ctrl.zoomOut() : ctrl.zoomIn();
      p?.catch?.(() => {});
    } catch { /* scene error: UI keeps working */ }
  }, [ctrl, drawerOpen]);

  useLayoutEffect(() => {
    if (!ctrl) return;
    try { ctrl.setInteractive(!modalOpen); } catch { /* ignore */ }
  }, [ctrl, modalOpen]);
}
