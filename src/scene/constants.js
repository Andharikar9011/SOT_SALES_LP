import * as THREE from 'three';

export const R = 2.6;            // globe radius
export const SITE_SCALE = 0.75;  // characters/sets are authored ~1.1 units tall, scaled to fit the globe
export const FOCUS_DIR = new THREE.Vector3(0, 0.9, 0.43).normalize(); // where the active stage is brought to

const rad = (d) => (d * Math.PI) / 180;
export function sph(lonDeg, latDeg) {
  const lon = rad(lonDeg), lat = rad(latDeg);
  return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).normalize();
}

// Globe-local directions of the three stage locations (Placed is on the far side).
export const STAGE_DIRS = [sph(0, 12), sph(72, -6), sph(150, 14)];
// Rest yaw of the hero at each site (radians, relative to the site forward)
export const STAGE_YAW = [0.6, 2.6, -0.7];
export const STAGE_NAMES = ['apply', 'learn', 'placed'];

export function frameQuat(up, fwd, out = new THREE.Quaternion()) {
  const z = fwd.clone().addScaledVector(up, -fwd.dot(up));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(up, -up.z);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(up, z);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
}

// Quaternion that brings globe-local `dir` to FOCUS_DIR
export function focusQuat(dir) {
  return new THREE.Quaternion().setFromUnitVectors(dir, FOCUS_DIR);
}

// Site forward (globe-local): after the focus rotation it points toward the camera
export function siteForward(dir) {
  const q = focusQuat(dir);
  const cam = new THREE.Vector3(0, 0, 1);
  cam.addScaledVector(FOCUS_DIR, -cam.dot(FOCUS_DIR)).normalize();
  return cam.applyQuaternion(q.clone().invert()).normalize();
}
