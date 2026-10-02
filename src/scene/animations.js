// Character rig animation, cohort ring layout, celebration pulse. All damped so poses never pop.
import * as THREE from 'three';

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class HeroAnimator {
  constructor(hero) {
    this.h = hero;
    this.mode = 'idle'; // idle | walk | sit | work | celebrate
    this.cur = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, armLx: 0, armLz: -0.1, armRx: 0, armRz: 0.1, pitch: 0, y: 0, yaw: 0 };
    this.phase = 0;
    this.t = 0;
    this.celebT = 0;
    this.targetYaw = 0;
  }

  setMode(mode, { snap = false, reduced = false } = {}) {
    this.mode = mode;
    if (mode === 'celebrate') this.celebT = 0;
    if (snap) this._solve(0, reduced, true);
  }

  _targets(dt, reduced) {
    const o = reduced ? 0 : 1, t = this.t;
    const g = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, armLx: 0, armLz: -0.1, armRx: 0, armRz: 0.1, pitch: 0, y: 0 };
    switch (this.mode) {
      case 'walk': {
        this.phase += dt * 7.5;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        g.hipL = -0.62 * s; g.hipR = 0.62 * s;
        g.kneeL = 0.75 * Math.max(0, c); g.kneeR = 0.75 * Math.max(0, -c);
        g.armLx = 0.55 * s; g.armRx = -0.55 * s;
        g.pitch = 0.08; g.y = 0.025 * Math.abs(c);
        break;
      }
      case 'sit':
        g.hipL = g.hipR = -1.45; g.kneeL = g.kneeR = 1.45;
        g.armLx = g.armRx = -0.9 + 0.05 * Math.sin(t * 0.9) * o;
        g.armLz = -0.08; g.armRz = 0.08;
        g.pitch = 0.05 + 0.05 * Math.sin(t * 1.1) * o; // gentle "nodding along"
        g.y = -0.21;
        break;
      case 'work':
        g.armLx = -0.35; g.armRx = -1.15 + 0.06 * Math.sin(t * 5) * o; g.armRz = 0.05;
        g.pitch = 0.04; g.y = 0.006 * Math.sin(t * 1.6) * o;
        break;
      case 'celebrate': {
        this.celebT += dt;
        const k = Math.min(1, this.celebT / 0.25);
        g.armLx = g.armRx = -Math.PI * 0.94 * k;
        g.armLz = -0.35 * k; g.armRz = 0.35 * k;
        g.y = reduced ? 0 : 0.12 * Math.abs(Math.sin(this.celebT * 6)) * Math.max(0, 1 - this.celebT / 1.2);
        break;
      }
      default: // idle
        g.armLx = 0.05 * Math.sin(t * 1.3) * o; g.armRx = -0.05 * Math.sin(t * 1.3) * o;
        g.y = 0.006 * Math.sin(t * 1.6) * o;
    }
    return g;
  }

  _solve(dt, reduced, snap) {
    const g = this._targets(dt, reduced);
    const a = snap ? 1 : 1 - Math.exp(-dt * 14);
    const c = this.cur;
    for (const k in g) c[k] += (g[k] - c[k]) * a;
    const yawA = snap ? 1 : 1 - Math.exp(-dt * 8);
    c.yaw += wrapPi(this.targetYaw - c.yaw) * yawA;
    const h = this.h;
    h.hipL.rotation.x = c.hipL; h.hipR.rotation.x = c.hipR;
    h.kneeL.rotation.x = c.kneeL; h.kneeR.rotation.x = c.kneeR;
    h.armL.rotation.set(c.armLx, 0, c.armLz);
    h.armR.rotation.set(c.armRx, 0, c.armRz);
    h.body.rotation.x = c.pitch;
    h.body.position.y = c.y;
    h.model.rotation.y = c.yaw;
  }

  update(dt, reduced) {
    this.t += dt;
    this._solve(dt, reduced, false);
  }
}

// Ring of cohort members around the learn site. join=0: ring spaced for N-1 with hero absent; join=1: hero in slot 0.
export function layoutRing(ring, join, time, reduced, hoverId) {
  const { members, radius, N } = ring;
  const M = members.length;
  for (let i = 0; i < M; i++) {
    const m = members[i];
    const after = (Math.PI * 2 * (i + 1)) / N;
    const before = (Math.PI * 2 * (i + 0.5)) / M + 0.3;
    // shortest interpolation
    let d = wrapPi(after - before);
    const th = before + d * join;
    m.group.position.set(Math.sin(th) * radius, 0, Math.cos(th) * radius);
    m.group.rotation.y = th + Math.PI;
    const bob = reduced ? 0 : Math.sin((time / 3) * Math.PI * 2 + i * 0.9) * 0.018;
    m.mesh.position.y = bob;
    const target = m.mentorId && hoverId === m.mentorId ? 1 : 0;
    m.hover += (target - m.hover) * 0.2;
    m.group.scale.setScalar(m.baseScale * (1 + 0.06 * m.hover));
    if (m.mentorId) m.mesh.rotation.y = reduced ? 0 : Math.sin(time * 0.8 + i) * 0.12;
  }
}

// Single restrained facet pulse + soft highlight ring. Reduced motion: static ring only.
export class Celebration {
  constructor(burst) {
    this.b = burst;
    this.t = -1;
    this.staticRing = false;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  get active() { return this.t >= 0 || this.staticRing; }

  play(reduced) {
    const b = this.b;
    b.group.visible = true;
    if (reduced) {
      b.inst.visible = false;
      b.ringMat.opacity = 0.6;
      b.ring.scale.setScalar(1.8);
      this.staticRing = true;
      this.t = -1;
      return;
    }
    b.inst.visible = true;
    this.staticRing = false;
    this.t = 0;
  }

  hide() {
    this.t = -1;
    this.staticRing = false;
    this.b.group.visible = false;
  }

  update(dtMs) {
    if (this.t < 0) return;
    const b = this.b;
    this.t += dtMs;
    const k = Math.min(1, this.t / 1200);
    const e = 1 - Math.pow(1 - k, 3); // ease-out
    for (let i = 0; i < b.n; i++) {
      const d = b.dirs[i];
      this._p.set(d.x * e * 1.0, 0.25 + d.y * e * 0.95 - 0.5 * e * e * 0.35, d.z * e * 1.0);
      this._s.setScalar(Math.max(0.001, 1 - k));
      this._q.identity();
      this._m.compose(this._p, this._q, this._s);
      b.inst.setMatrixAt(i, this._m);
    }
    b.inst.instanceMatrix.needsUpdate = true;
    b.material.opacity = 1 - k * k;
    b.ring.scale.setScalar(0.4 + e * 2.6);
    b.ringMat.opacity = 0.75 * (1 - k);
    if (k >= 1) this.hide();
  }
}
