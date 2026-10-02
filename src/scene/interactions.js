// Pointer input: drag/swipe rotate with inertia, click-vs-drag disambiguation, hover + tap picking.
// host = { canvas, isInteractive(), canRotate(), rotate(dx, dy) [radians], pick(clientX, clientY),
//          onTap(pick, e), onHover(pick, e), onInertia(active), reducedMotion() }

const DRAG_PX_MOUSE = 5;
const DRAG_PX_TOUCH = 10;
const ROT_PER_PX = 0.0058;

export class Interactions {
  constructor(host) {
    this.host = host;
    this.canvas = host.canvas;
    this.down = null;
    this.dragging = false;
    this.vx = 0;
    this.vy = 0;
    this.samples = [];
    this.hoverKey = null;
    this._hoverQueued = null;
    this._lastTap = 0;

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onLeave = this.onLeave.bind(this);

    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('pointerleave', this.onLeave);
    // Horizontal swipes rotate; vertical gestures keep scrolling the page
    c.style.touchAction = 'pan-y';
  }

  cancelDrag() {
    this.down = null;
    this.dragging = false;
  }

  onDown(e) {
    if (!this.host.isInteractive()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, type: e.pointerType };
    this.dragging = false;
    this.vx = this.vy = 0;
    this.samples.length = 0;
    this.host.onInertia(false);
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  onMove(e) {
    if (!this.host.isInteractive()) return;
    const d = this.down;
    if (!d || d.id !== e.pointerId) {
      if (e.pointerType === 'mouse') this.queueHover(e);
      return;
    }
    const thresh = d.type === 'touch' ? DRAG_PX_TOUCH : DRAG_PX_MOUSE;
    if (!this.dragging) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < thresh) return;
      this.dragging = true;
      this.host.onHover(null, e);
      this.canvas.style.cursor = 'grabbing';
    }
    const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
    d.lx = e.clientX; d.ly = e.clientY;
    if (!this.host.canRotate()) return;
    const ry = dx * ROT_PER_PX;
    const rx = d.type === 'touch' ? 0 : dy * ROT_PER_PX;
    this.host.rotate(ry, rx);
    const now = performance.now();
    this.samples.push({ t: now, ry, rx });
    while (this.samples.length && now - this.samples[0].t > 90) this.samples.shift();
  }

  onUp(e) {
    const d = this.down;
    if (!d || d.id !== e.pointerId) return;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    this.down = null;
    if (this.dragging) {
      this.dragging = false;
      this.canvas.style.cursor = '';
      if (!this.host.reducedMotion() && this.samples.length > 1) {
        const span = Math.max(16, this.samples[this.samples.length - 1].t - this.samples[0].t);
        let sy = 0, sx = 0;
        for (const s of this.samples) { sy += s.ry; sx += s.rx; }
        this.vx = (sy / span) * 1000; // rad/s about Y
        this.vy = (sx / span) * 1000; // rad/s about X
        if (Math.hypot(this.vx, this.vy) > 0.05) this.host.onInertia(true);
      }
      return;
    }
    // Tap / click. Ignore accidental double-fire within 250ms.
    const now = performance.now();
    if (now - this._lastTap < 250) return;
    this._lastTap = now;
    this.host.onTap(this.host.pick(e.clientX, e.clientY), e);
  }

  onCancel(e) {
    if (this.down && this.down.id === e.pointerId) {
      this.down = null;
      this.dragging = false;
      this.canvas.style.cursor = '';
    }
  }

  onLeave() {
    this.host.onHover(null, null);
    this.hoverKey = null;
    this.canvas.style.cursor = '';
  }

  queueHover(e) {
    // throttle raycasts to one per animation frame
    if (this._hoverQueued) { this._hoverQueued = e; return; }
    this._hoverQueued = e;
    requestAnimationFrame(() => {
      const ev = this._hoverQueued;
      this._hoverQueued = null;
      if (!ev || this.dragging || !this.host.isInteractive()) return;
      const pick = this.host.pick(ev.clientX, ev.clientY);
      this.host.onHover(pick, ev);
    });
  }

  dispose() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('pointerleave', this.onLeave);
    c.style.touchAction = '';
    c.style.cursor = '';
  }
}
