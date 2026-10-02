// FPS monitor + adaptive quality trigger + optional debug meter.

export class PerfMonitor {
  constructor({ targetFps = 60, onDowngrade, onFps, debug = false, parent = null } = {}) {
    this.targetFps = targetFps;
    this.onDowngrade = onDowngrade;
    this.onFps = onFps;
    this.level = 0;
    this.maxLevel = 2;
    this.frames = 0;
    this.time = 0;
    this.lowTime = 0;
    this.last = 0;
    this.fps = 0;
    this.el = null;
    if (debug && parent && typeof document !== 'undefined') {
      this.el = document.createElement('div');
      this.el.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9999;padding:2px 6px;font:12px monospace;background:rgba(0,0,0,.6);color:#0f0;pointer-events:none';
      parent.appendChild(this.el);
    }
  }

  // Call when the render loop (re)starts so idle gaps are not measured.
  reset() {
    this.last = 0;
    this.frames = 0;
    this.time = 0;
    this.lowTime = 0;
  }

  frame(nowMs) {
    if (this.last) {
      const dt = nowMs - this.last;
      if (dt < 250) { this.frames++; this.time += dt; }
      if (this.time >= 500) {
        this.fps = (this.frames * 1000) / this.time;
        this.frames = 0;
        this.time = 0;
        if (this.el) this.el.textContent = this.fps.toFixed(0) + ' fps  L' + this.level;
        if (this.onFps) this.onFps(this.fps);
        if (this.fps < this.targetFps * 0.8) this.lowTime += 500; else this.lowTime = 0;
        if (this.lowTime >= 2000 && this.level < this.maxLevel) {
          this.level++;
          this.lowTime = 0;
          if (this.onDowngrade) this.onDowngrade(this.level);
        }
      }
    }
    this.last = nowMs;
  }

  dispose() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  }
}
