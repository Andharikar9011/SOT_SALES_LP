// Tween manager + easing. One manager drives camera, globe and character together.

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-5) break;
      if (e < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

// Tokens from design-system/animations.md
export const EASE = {
  inOut: cubicBezier(0.4, 0, 0.2, 1),
  out: cubicBezier(0, 0, 0.2, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  linear: (t) => t
};

export class TweenManager {
  constructor() {
    this.list = [];
  }

  get active() {
    return this.list.length > 0;
  }

  /**
   * to({duration(ms), delay(ms), ease, onUpdate(e, rawT), onComplete})
   * Returns { promise, cancel(finish=false) }. The promise ALWAYS resolves
   * (true when completed, false when cancelled) so callers never hang.
   */
  to({ duration = 300, delay = 0, ease = EASE.inOut, onUpdate, onComplete } = {}) {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    const tw = { elapsed: -delay, duration, ease, onUpdate, onComplete, done: false, resolve };
    tw.cancel = (finish = false) => {
      if (tw.done) return;
      tw.done = true;
      const i = this.list.indexOf(tw);
      if (i >= 0) this.list.splice(i, 1);
      if (finish && onUpdate) onUpdate(1, 1);
      resolve(!!finish);
    };
    if (duration <= 0 && delay <= 0) {
      tw.done = true;
      if (onUpdate) onUpdate(1, 1);
      if (onComplete) onComplete();
      resolve(true);
      return { promise, cancel() {} };
    }
    this.list.push(tw);
    return { promise, cancel: tw.cancel };
  }

  update(dtMs) {
    if (!this.list.length) return;
    const items = this.list.slice();
    for (const tw of items) {
      if (tw.done) continue;
      tw.elapsed += dtMs;
      if (tw.elapsed < 0) continue;
      const raw = tw.duration <= 0 ? 1 : Math.min(1, tw.elapsed / tw.duration);
      if (tw.onUpdate) tw.onUpdate(tw.ease(raw), raw);
      if (raw >= 1) {
        tw.done = true;
        const i = this.list.indexOf(tw);
        if (i >= 0) this.list.splice(i, 1);
        if (tw.onComplete) tw.onComplete();
        tw.resolve(true);
      }
    }
  }

  cancelAll() {
    for (const tw of this.list.slice()) tw.cancel(false);
    this.list.length = 0;
  }
}
