// Camera controller. Poses are blended by two params:
//   w   (0 close-up hero shot ... 1 world view: camera dollies back so the globe spans ~36% of the viewport height
//        and camera.setViewOffset shifts the framing into the top of the viewport)
//   far (1 = intro far shot ... 0 = at rest)
// Zoom tweens are driven by the shared TweenManager, so they stay in sync with the drawer/character.
import * as THREE from 'three';
import { R } from './constants.js';

const FOV = 40;
const CLOSE_POS = new THREE.Vector3(0, 3.2, 4.6);
const CLOSE_LOOK = new THREE.Vector3(0, 2.72, 1.3);
const WORLD_DIR = new THREE.Vector3(0, 0.15, 1).normalize();
const WORLD_LOOK = new THREE.Vector3(0, 0, 0);
const FAR_POS = new THREE.Vector3(0, 3.2, 16);
const FAR_LOOK = new THREE.Vector3(0, 0.4, 0);
const TOP_FRACTION = 0.4; // share of the viewport the world view occupies (top)

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
    this.w = 0;
    this.far = 0;
    this.viewW = 1;
    this.viewH = 1;
    this.worldPos = new THREE.Vector3(0, 1.4, 9.6);
    this.cWorld = 0.19; // globe centre as fraction of viewport height, from the top
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
    this.update();
  }

  setSize(w, h) {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
    this.camera.aspect = this.viewW / this.viewH;
    // Globe diameter in px: 36% of height, but never wider than 90% of the width (portrait phones)
    const targetPx = Math.min(TOP_FRACTION * this.viewH, 0.9 * this.viewW);
    const frac = targetPx / this.viewH;
    const alpha = Math.atan(frac * Math.tan((FOV * Math.PI) / 360));
    const dist = (R + 1.0) / Math.sin(alpha); // +1.0: sites, plinths and the office poke out of the globe silhouette
    this.worldPos.copy(WORLD_DIR).multiplyScalar(dist);
    this.cWorld = targetPx / 2 / this.viewH + 0.02;
  }

  setW(v) { this.w = v; }
  setFar(v) { this.far = v; }

  update() {
    const c = this.camera;
    const w = this.w, f = this.far;
    this._p.lerpVectors(CLOSE_POS, this.worldPos, w);
    this._l.lerpVectors(CLOSE_LOOK, WORLD_LOOK, w);
    // pull back a bit on portrait so the hero + ring fit horizontally
    if (c.aspect < 1) {
      const pull = 1 + (1 - c.aspect) * 0.45 * (1 - w);
      this._p.sub(this._l).multiplyScalar(pull).add(this._l);
    }
    this._p.lerp(FAR_POS, f);
    this._l.lerp(FAR_LOOK, f);
    c.position.copy(this._p);
    c.lookAt(this._l);
    // Framing shift (world view only): the sub-window starts below the virtual frame, so the scene moves UP.
    const k = w * (1 - f);
    if (k > 0.0005) {
      const shift = (0.5 - this.cWorld) * this.viewH * k;
      c.setViewOffset(this.viewW, this.viewH, 0, shift, this.viewW, this.viewH);
    } else if (c.view && c.view.enabled) {
      c.clearViewOffset();
    }
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
}
