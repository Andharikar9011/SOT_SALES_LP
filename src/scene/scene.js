// SceneController: assembles renderer, globe, sites, hero, cohort, camera, input and the render loop.
import * as THREE from 'three';
import { TweenManager, EASE } from './tween.js';
import { normalizeTheme } from './colors.js';
import { getConfig, detectMobile } from './mobile-config.js';
import { PerfMonitor } from './performance.js';
import { CameraRig } from './camera.js';
import { Interactions } from './interactions.js';
import { HeroAnimator, layoutRing, Celebration } from './animations.js';
import {
  R, SITE_SCALE, STAGE_DIRS, STAGE_YAW, frameQuat, focusQuat, siteForward
} from './constants.js';
import {
  createMaterials, applyThemeToMaterials, buildGlobe, buildStars, buildHero,
  buildApplySite, buildLearnSite, buildPlacedSite, buildBurst
} from './models.js';

const REST_MODE = ['idle', 'sit', 'work'];
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

export class SceneController {
  constructor(options) {
    const { canvas } = options;
    if (!canvas) throw new Error('createScene: options.canvas is required');
    this.opts = options;
    this.canvas = canvas;
    this.content = options.content || {};
    this.cfg = getConfig(detectMobile(options.isMobile));
    this.th = normalizeTheme(options.theme || (options.content && options.content.theme));
    this.reduced = !!options.reducedMotion;
    this.paused = false;
    this.interactive = true;
    this.disposed = false;
    this.handlers = new Map();
    this.readyFired = false;

    this.stage = 0;
    this.heroSite = 0;      // 0..2 when resting at a site, -1 while walking
    this.moveToken = 0;
    this.ringJoin = 0;
    this.selectedMentor = null;
    this.hoverMentor = null;
    this.formHover = 0;
    this.formHoverTarget = 0;
    this.driftGain = 0;
    this.driftPhase = 0;
    this.inertia = false;
    this.settle = 0;
    this.zoomed = false;
    this.loopOn = false;
    this.raf = 0;
    this.lastT = 0;
    this.dirty = true;
    this.quality = 0;
    this.stats = { vertices: {} };

    this.tweens = new TweenManager();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._onVis = () => { if (!document.hidden) this._wake(); };
    this._tick = this._tick.bind(this);

    this._progress(0.05);
    this._initRenderer();
    this._progress(0.2);
    this._buildWorld();
    this._progress(0.85);
    this._initInput();
    this.resize();
    this._progress(1);
  }

  // ------------------------------------------------------------ setup

  _progress(ratio) {
    this.emit('progress', { ratio });
    if (typeof this.opts.onProgress === 'function') this.opts.onProgress({ ratio });
  }

  _initRenderer() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas, antialias: this.cfg.antialias, alpha: false, powerPreference: 'high-performance'
      });
    } catch (e) {
      throw new Error('WebGL unavailable: ' + (e && e.message ? e.message : e));
    }
    if (!renderer.getContext()) throw new Error('WebGL unavailable');
    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = this.cfg.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(new THREE.Color(this.th.scene.sceneBackground), 1);

    this._onLost = (e) => { e.preventDefault(); this.emit('contextlost', { error: new Error('WebGL context lost') }); };
    this._onRestored = () => { this._wake(); };
    this.canvas.addEventListener('webglcontextlost', this._onLost);
    this.canvas.addEventListener('webglcontextrestored', this._onRestored);
    document.addEventListener('visibilitychange', this._onVis);

    this.perf = new PerfMonitor({
      targetFps: this.cfg.targetFps,
      debug: !!this.opts.debug,
      parent: document.body,
      onFps: (fps) => { if (this.opts.debug) this.emit('fps', { fps }); },
      onDowngrade: (lvl) => this._downgrade(lvl)
    });
  }

  _buildWorld() {
    const th = this.th, cfg = this.cfg;
    this.recolors = [];
    this.geos = [];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(th.scene.sceneBackground);
    this.mats = createMaterials(th);
    this.rig = new CameraRig();
    this.camera = this.rig.camera;

    // lights: one warm key from the side + soft hemisphere fill
    this.key = new THREE.DirectionalLight(th.scene.globeLight, 2.8);
    this.key.position.set(5, 6, 4);
    if (cfg.shadows) {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(1024, 1024);
      const sc = this.key.shadow.camera;
      sc.left = -4.2; sc.right = 4.2; sc.top = 4.2; sc.bottom = -4.2; sc.near = 0.5; sc.far = 20;
      this.key.shadow.bias = -0.0006;
      this.key.shadow.normalBias = 0.03;
    }
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
    this.scene.add(this.key, this.hemi);
    this._applyLightColors();

    this.stars = buildStars(cfg.stars, th);
    this.scene.add(this.stars.points);
    this.geos.push(this.stars.geometry);

    this.drift = new THREE.Group();
    this.globe = new THREE.Group();
    this.scene.add(this.drift);
    this.drift.add(this.globe);

    const g = buildGlobe(th, cfg.globeDetail);
    this.globeMesh = new THREE.Mesh(g.geometry, this.mats.lit);
    this.globeMesh.receiveShadow = cfg.shadows;
    this.globe.add(this.globeMesh);
    this.recolors.push(g.recolor);
    this.geos.push(g.geometry);
    this.stats.vertices.globe = g.vertexCount;

    // site frames (surface-tangent, oriented so they face the camera when focused)
    this.siteFwd = STAGE_DIRS.map((d) => siteForward(d));
    this.focusQ = STAGE_DIRS.map((d) => focusQuat(d));
    this.frames = STAGE_DIRS.map((dir, i) => {
      const f = new THREE.Group();
      f.position.copy(dir).multiplyScalar(R);
      f.quaternion.copy(frameQuat(dir, this.siteFwd[i]));
      f.scale.setScalar(SITE_SCALE);
      this.globe.add(f);
      return f;
    });

    const mentorIds = ((this.content && this.content.mentors) || []).map((m) => m.id);
    const s0 = buildApplySite(th, cfg, this.mats, this.frames[0]);
    const s1 = buildLearnSite(th, cfg, this.mats, this.frames[1], mentorIds);
    const s2 = buildPlacedSite(th, cfg, this.mats, this.frames[2]);
    this.apply = s0;
    this.learn = s1;
    for (const s of [s0, s1, s2]) { this.recolors.push(...s.recolors); this.geos.push(...s.geos); }
    this.stats.vertices.cohortRing = s1.vertexCount;

    // hero
    this.hero = buildHero(th, cfg, this.mats);
    this.hero.dir = STAGE_DIRS[0].clone();
    this.hero.fwd = this.siteFwd[0].clone();
    this.globe.add(this.hero.root);
    this.recolors.push(...this.hero.recolors);
    this.geos.push(...this.hero.geos);
    this.stats.vertices.hero = this.hero.vertexCount;
    this.anim = new HeroAnimator(this.hero);

    // celebration
    this.burst = buildBurst(th, cfg);
    this.globe.add(this.burst.group);
    this.recolors.push(this.burst.recolor);
    this.geos.push(...this.burst.geos);
    this.celebration = new Celebration(this.burst);

    // picking targets: globe (occluder) + proxies
    this.pickTargets = [this.globeMesh, this.hero.proxy, s0.proxy];
    for (const m of s1.members) if (m.proxy) this.pickTargets.push(m.proxy, m.mesh);

    // initial state
    this._snapToStage(0);
    if (!this.reduced) {
      this.rig.setFar(1);
      this.tweens.to({ duration: 1200, ease: EASE.inOut, onUpdate: (e) => { this.rig.setFar(1 - e); } });
    }
  }

  _initInput() {
    this.input = new Interactions({
      canvas: this.canvas,
      isInteractive: () => this.interactive && !this.disposed,
      canRotate: () => this.heroSite !== -1 || !this._moveActive,
      rotate: (ry, rx) => { this._rotateGlobe(ry, rx); this._wake(); },
      pick: (x, y) => this._pick(x, y),
      onTap: (pick) => this._onTap(pick),
      onHover: (pick) => this._onHover(pick),
      onInertia: (on) => { this.inertia = on; if (on) this._wake(); },
      reducedMotion: () => this.reduced
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.canvas.parentElement || this.canvas);
    }
    this._onWinResize = () => this.resize();
    window.addEventListener('resize', this._onWinResize);
  }

  _applyLightColors() {
    const s = this.th.scene;
    this.key.color.set(s.globeLight);
    this.hemi.color.set(s.globeAccent).lerp(new THREE.Color(1, 1, 1), 0.3);
    this.hemi.groundColor.set(s.sceneBackground).lerp(new THREE.Color(s.globeBase), 0.35);
  }

  // ------------------------------------------------------------ events

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    if (event === 'ready' && this.readyFired) queueMicrotask(() => { if (this.handlers.get('ready')?.has(handler)) handler({}); });
    return () => { const s = this.handlers.get(event); if (s) s.delete(handler); };
  }

  emit(event, payload) {
    const s = this.handlers && this.handlers.get(event);
    if (!s) return;
    for (const h of Array.from(s)) {
      try { h(payload); } catch (e) { console.error('[scene] handler error for', event, e); }
    }
  }

  // ------------------------------------------------------------ render loop

  _wake() {
    if (this.disposed) return;
    this.dirty = true;
    if (!this.loopOn && !document.hidden) {
      this.loopOn = true;
      this.lastT = 0;
      this.perf.reset();
      this.raf = requestAnimationFrame(this._tick);
    }
  }

  get _idleOn() { return !this.paused && !this.reduced; }

  _tick(now) {
    this.raf = 0;
    if (this.disposed) return;
    if (document.hidden) { this.loopOn = false; return; }
    try {
      const dtMs = this.lastT ? Math.min(100, now - this.lastT) : 16.7;
      this.lastT = now;
      const busy = this._update(dtMs / 1000, now / 1000);
      this.perf.frame(now);
      if (busy || this.dirty) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
        if (!this.readyFired) { this.readyFired = true; this.emit('ready', {}); }
      }
      if (busy) this.raf = requestAnimationFrame(this._tick);
      else { this.loopOn = false; this.lastT = 0; }
    } catch (e) {
      console.error('[scene] render error', e);
      this.loopOn = false;
      this.emit('error', { error: e });
    }
  }

  // returns true while anything is still animating
  _update(dt, t) {
    this.tweens.update(dt * 1000);
    let busy = this.tweens.active;
    const idle = this._idleOn;

    // idle globe sway (peak ~0.05 rad/s); eases to a stop while dragging / zoomed out (drawer open)
    const driftTarget = idle && !this.input.dragging && this.rig.w < 0.5 && !this.inertia ? 1 : 0;
    this.driftGain += (driftTarget - this.driftGain) * (1 - Math.exp(-dt * 4));
    if (this.driftGain < 0.002 && driftTarget === 0) this.driftGain = 0;
    else busy = true;
    this.driftPhase += dt * 0.31 * this.driftGain;
    this.drift.rotation.y = 0.16 * Math.sin(this.driftPhase);

    // drag inertia (decays ~800ms)
    if (this.inertia) {
      const k = Math.exp(-dt / 0.27);
      this.input.vx *= k; this.input.vy *= k;
      this._rotateGlobe(this.input.vx * dt, this.input.vy * dt);
      if (Math.hypot(this.input.vx, this.input.vy) < 0.02) this.inertia = false;
      busy = true;
    }

    this.anim.update(dt, !idle);
    if (this.anim.mode === 'walk' || this.anim.mode === 'celebrate') busy = true;
    if (idle) busy = true;

    // ring layout + hover easing
    layoutRing(this.learn, this.ringJoin, idle ? t : 0, !idle, this.hoverMentor);
    if (this.settle > 0) { this.settle--; busy = true; }

    // small ambient animations
    if (idle) {
      this.learn.crystal.rotation.y += dt * 0.8;
      this.learn.crystal.position.y = 0.5 + Math.sin(t * 1.4) * 0.03;
    }
    this.formHover += (this.formHoverTarget - this.formHover) * (1 - Math.exp(-dt * 12));
    if (Math.abs(this.formHover - this.formHoverTarget) > 0.01) busy = true;
    const pulse = idle ? 0.9 + 0.1 * Math.sin(t * 2.2) : 1;
    const white = this._white || (this._white = new THREE.Color(1, 1, 1));
    const bs = this.mats.glowScreen, ba = this.mats.glowAccent;
    bs.color.copy(bs.userData.base).multiplyScalar(pulse).lerp(white, 0.45 * this.formHover);
    ba.color.copy(ba.userData.base).multiplyScalar(pulse).lerp(white, 0.25 * this.formHover);
    this.apply.panel.scale.setScalar(1 + 0.03 * this.formHover);

    if (this.celebration.t >= 0) { this.celebration.update(dt * 1000); busy = true; }
    this.rig.update();
    return busy;
  }

  // ------------------------------------------------------------ helpers

  _rotateGlobe(ry, rx) {
    this.globe.quaternion.premultiply(this._q.setFromAxisAngle(AXIS_X, rx));
    this.globe.quaternion.premultiply(this._q.setFromAxisAngle(AXIS_Y, ry));
  }

  _applyHero() {
    const H = this.hero;
    H.root.position.copy(H.dir).multiplyScalar(R);
    frameQuat(H.dir, H.fwd, H.root.quaternion);
  }

  _setRing(v) { this.ringJoin = v; }

  _animRing(target, delay, dur) {
    if (this._ringTween) this._ringTween.cancel(false);
    if (this.reduced) { this._setRing(target); return; }
    const from = this.ringJoin;
    this._ringTween = this.tweens.to({
      duration: dur, delay, ease: EASE.inOut,
      onUpdate: (e) => this._setRing(from + (target - from) * e)
    });
  }

  _snapToStage(n) {
    this.moveToken++;
    this._cancelMoves();
    const H = this.hero;
    H.dir.copy(STAGE_DIRS[n]);
    H.fwd.copy(this.siteFwd[n]);
    this._applyHero();
    this.globe.quaternion.copy(this.focusQ[n]);
    this.heroSite = n;
    this._setRing(n === 1 ? 1 : 0);
    this.anim.targetYaw = STAGE_YAW[n];
    this.anim.setMode(REST_MODE[n], { snap: true, reduced: this.reduced });
    if (n === 2) { this._placeBurst(); this.celebration.play(true); } else this.celebration.hide();
  }

  _cancelMoves() {
    this._moveActive = false;
    if (this._moveTween) { this._moveTween.cancel(false); this._moveTween = null; }
    if (this._ringTween) { this._ringTween.cancel(false); this._ringTween = null; }
    if (this._celebTween) { this._celebTween.cancel(false); this._celebTween = null; }
  }

  _placeBurst() {
    this.burst.group.position.copy(this.hero.root.position);
    this.burst.group.quaternion.copy(this.hero.root.quaternion);
  }

  // Walk the hero along the globe surface to site idx while the globe rotates to keep it framed.
  async _moveHero(idx, duration) {
    const H = this.hero;
    if (this._moveTween) { this._moveTween.cancel(false); this._moveTween = null; }
    if (this._celebTween) { this._celebTween.cancel(false); this._celebTween = null; }
    this.celebration.hide();
    const A = H.dir.clone(), B = STAGE_DIRS[idx], endFwd = this.siteFwd[idx];
    const theta = A.angleTo(B);
    const qStart = this.globe.quaternion.clone(), qEnd = this.focusQ[idx];

    if (theta < 1e-3) {
      // already there: only re-centre the globe
      this.heroSite = idx;
      this._moveActive = true;
      const tw = this.tweens.to({
        duration: this.reduced ? 0 : 500, ease: EASE.inOut,
        onUpdate: (e) => this.globe.quaternion.slerpQuaternions(qStart, qEnd, e)
      });
      this._moveTween = tw;
      const ok = await tw.promise;
      if (ok) { this._moveActive = false; this.anim.targetYaw = STAGE_YAW[idx]; this.anim.setMode(REST_MODE[idx]); }
      return ok;
    }

    this.heroSite = -1;
    this._moveActive = true;
    this.anim.setMode('walk');
    this.anim.targetYaw = 0;
    if (idx === 1) this._animRing(1, duration * 0.55, duration * 0.45);
    else if (this.ringJoin > 0) this._animRing(0, 0, 500);

    const u = B.clone().addScaledVector(A, -A.dot(B)).normalize();
    const startFwd = H.fwd.clone();
    const pos = new THREE.Vector3(), tan = new THREE.Vector3(), f = new THREE.Vector3();
    const t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
    const proj = (v, out) => out.copy(v).addScaledVector(pos, -v.dot(pos));

    const tw = this.tweens.to({
      duration, ease: EASE.inOut,
      onUpdate: (e) => {
        const phi = e * theta;
        pos.copy(A).multiplyScalar(Math.cos(phi)).addScaledVector(u, Math.sin(phi));
        tan.copy(A).multiplyScalar(-Math.sin(phi)).addScaledVector(u, Math.cos(phi));
        const ws = 1 - smoothstep(0, 0.15, e), we = smoothstep(0.85, 1, e);
        f.set(0, 0, 0)
          .addScaledVector(proj(startFwd, t1), ws)
          .addScaledVector(tan, 1 - ws - we)
          .addScaledVector(proj(endFwd, t2), we);
        if (f.lengthSq() < 1e-8) f.copy(tan);
        f.normalize();
        H.dir.copy(pos);
        H.fwd.copy(f);
        this._applyHero();
        this.globe.quaternion.slerpQuaternions(qStart, qEnd, e);
      }
    });
    this._moveTween = tw;
    const ok = await tw.promise;
    if (!ok) return false;
    this._moveActive = false;
    this._moveTween = null;
    H.dir.copy(B);
    H.fwd.copy(endFwd);
    this._applyHero();
    this.globe.quaternion.copy(qEnd);
    this.heroSite = idx;
    this.anim.targetYaw = STAGE_YAW[idx];
    this.anim.setMode(REST_MODE[idx]);
    return true;
  }

  _celebrate() {
    this._placeBurst();
    this.celebration.play(false);
    this.anim.setMode('celebrate');
    this._celebTween = this.tweens.to({
      duration: 1300,
      onComplete: () => { if (this.heroSite === 2 && this.anim.mode === 'celebrate') this.anim.setMode('work'); }
    });
    this._wake();
  }

  // ------------------------------------------------------------ picking

  _pick(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this._ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    this.scene.updateMatrixWorld();
    const hits = this._ray.intersectObjects(this.pickTargets, false);
    if (!hits.length) return null;
    return hits[0].object.userData.pick || null;
  }

  _screenOf(member) {
    this._v.set(0, 1.25, 0);
    member.group.localToWorld(this._v);
    this.camera.updateMatrixWorld();
    this._v.project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (this._v.x * 0.5 + 0.5) * r.width, y: r.top + (-this._v.y * 0.5 + 0.5) * r.height };
  }

  _onTap(pick) {
    if (!this.interactive) return;
    if (!pick) {
      if (this.selectedMentor) { this.selectedMentor = null; this.emit('mentorselect', { mentorId: null }); }
      return;
    }
    if (pick.type === 'mentor') {
      this.selectedMentor = pick.id;
      this.emit('mentorselect', { mentorId: pick.id, screen: this._screenOf(pick.member) });
      return;
    }
    if (this.selectedMentor) { this.selectedMentor = null; this.emit('mentorselect', { mentorId: null }); }
    if (this._moveActive) return;
    if (pick.type === 'form' || pick.type === 'hero') {
      if (this.stage === 0) { if (this.heroSite === 0) this.emit('applyrequest', {}); }
      else this.emit('stageadvancerequest', { stage: this.stage });
    }
  }

  _onHover(pick) {
    const key = pick ? pick.type + (pick.id || '') : '';
    if (key === this._hoverKey) return;
    this._hoverKey = key;
    this.canvas.style.cursor = pick && this.interactive ? 'pointer' : '';
    this.formHoverTarget = pick && (pick.type === 'form' || (pick.type === 'hero' && this.stage === 0)) ? 1 : 0;
    const hm = pick && pick.type === 'mentor' ? pick.id : null;
    if (hm !== this.hoverMentor) {
      this.hoverMentor = hm;
      if (hm) this.emit('mentorselect', { mentorId: hm, screen: this._screenOf(pick.member) });
      else if (!this.selectedMentor) this.emit('mentorselect', { mentorId: null });
    }
    this.settle = 40;
    this._wake();
  }

  // ------------------------------------------------------------ public API

  getStage() { return this.stage; }

  async setStage(n, { animate = true } = {}) {
    n = Math.max(0, Math.min(2, Math.round(Number(n) || 0)));
    const token = ++this.moveToken;
    this.stage = n;
    if (this.reduced || !animate) {
      this._snapToStage(n);
      this.moveToken = token;
      this._wake();
      this.emit('stagechange', { stage: n });
      return;
    }
    const theta = this.hero.dir.angleTo(STAGE_DIRS[n]);
    const dur = 1000 + Math.min(1, theta / 2.2) * 1000;
    this._wake();
    const ok = await this._moveHero(n, dur);
    if (!ok || token !== this.moveToken) return;
    if (n === 2) this._celebrate();
    this.emit('stagechange', { stage: n });
    this._wake();
  }

  async playCohortJoin() {
    const token = ++this.moveToken; // stage index is untouched
    this._wake();
    if (this.reduced) {
      this._cancelMoves();
      const H = this.hero;
      H.dir.copy(STAGE_DIRS[1]); H.fwd.copy(this.siteFwd[1]);
      this._applyHero();
      this.globe.quaternion.copy(this.focusQ[1]);
      this.heroSite = 1;
      this._setRing(1);
      this.celebration.hide();
      this.anim.targetYaw = STAGE_YAW[1];
      this.anim.setMode('sit', { snap: true, reduced: true });
      this._wake();
      return;
    }
    const ok = await this._moveHero(1, 1200);
    if (!ok || token !== this.moveToken) return;
    this._wake();
  }

  _zoomTo(target) {
    if (this._zoomTween) this._zoomTween.cancel(false);
    this.zoomed = target > 0.5;
    if (this.reduced) {
      this.rig.setW(target);
      this._zoomTween = null;
      this._wake();
      return Promise.resolve();
    }
    const from = this.rig.w;
    this._zoomTween = this.tweens.to({
      duration: 300, ease: EASE.inOut,
      onUpdate: (e) => this.rig.setW(from + (target - from) * e)
    });
    this._wake();
    return this._zoomTween.promise.then(() => undefined);
  }

  zoomOut() { return this._zoomTo(1); }
  zoomIn() { return this._zoomTo(0); }

  rotateBy(radians) {
    if (!Number.isFinite(radians)) return;
    if (this.reduced) { this._rotateGlobe(radians, 0); this._wake(); return; }
    let prev = 0;
    this.tweens.to({
      duration: 300, ease: EASE.out,
      onUpdate: (e) => { const d = e * radians - prev; prev = e * radians; this._rotateGlobe(d, 0); }
    });
    this._wake();
  }

  setInteractive(v) {
    this.interactive = !!v;
    if (!v) {
      this.input.cancelDrag();
      this.inertia = false;
      this._hoverKey = null;
      this.hoverMentor = null;
      this.formHoverTarget = 0;
      this.canvas.style.cursor = '';
      this.settle = 40;
      this._wake();
    }
  }

  setTheme(theme) {
    this.th = normalizeTheme(theme);
    applyThemeToMaterials(this.mats, this.th);
    for (const r of this.recolors) r(this.th);
    this.scene.background.set(this.th.scene.sceneBackground);
    this.renderer.setClearColor(this.scene.background, 1);
    this.stars.material.color.set(this.th.scene.globeLight);
    this._applyLightColors();
    this._wake();
  }

  setReducedMotion(v) {
    this.reduced = !!v;
    if (this.reduced) {
      this.tweens.cancelAll();
      this._zoomTween = null; this._moveTween = null; this._ringTween = null; this._celebTween = null;
      this._moveActive = false;
      this.rig.setFar(0);
      this.rig.setW(this.zoomed ? 1 : 0);
      this._snapToStage(this.heroSite === 1 && this.stage === 0 ? 1 : this.stage);
    }
    this._wake();
  }

  setPaused(v) {
    this.paused = !!v;
    this._wake();
  }

  _pixelRatio() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const base = Math.min(dpr, this.cfg.pixelRatioCap);
    if (this.quality >= 2) return 1;
    if (this.quality === 1) return Math.min(base, 1.25);
    return base;
  }

  resize() {
    if (this.disposed) return;
    const p = this.canvas.parentElement;
    const w = this.canvas.clientWidth || (p && p.clientWidth) || window.innerWidth;
    const h = this.canvas.clientHeight || (p && p.clientHeight) || window.innerHeight;
    this.renderer.setPixelRatio(this._pixelRatio());
    this.renderer.setSize(w, h, false);
    this.rig.setSize(w, h);
    this._wake();
  }

  _downgrade(level) {
    this.quality = level;
    if (level >= 1) {
      this.renderer.shadowMap.enabled = false;
      this.key.castShadow = false;
      this.mats.lit.needsUpdate = true;
    }
    if (level >= 2) this.stars.points.visible = false;
    this.resize();
    this.emit('quality', { level });
  }

  // Diagnostics: renderer.info + authored vertex counts (not part of the UI contract)
  getStats() {
    const i = this.renderer.info;
    return {
      drawCalls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries,
      textures: i.memory.textures, vertices: this.stats.vertices, quality: this.quality,
      pixelRatio: this.renderer.getPixelRatio(), mobile: this.cfg.isMobile
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.tweens.cancelAll();
    this.input && this.input.dispose();
    if (this.ro) this.ro.disconnect();
    window.removeEventListener('resize', this._onWinResize);
    document.removeEventListener('visibilitychange', this._onVis);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    this.perf && this.perf.dispose();
    for (const g of this.geos) g.dispose();
    this.scene.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.own) o.material.dispose(); });
    for (const m of Object.values(this.mats)) m.dispose();
    this.burst.material.dispose();
    this.burst.ringMat.dispose();
    this.burst.inst.dispose();
    this.stars.material.dispose();
    this.hero.proxy.material.dispose();
    for (const t of this.pickTargets) if (t.material && t.material.type === 'MeshBasicMaterial') t.material.dispose();
    this.key.shadow && this.key.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.handlers.clear();
  }
}
