// Procedural low-poly builders. No model files. All colors are semantic roles resolved from the theme,
// baked into vertex colors so the whole scene shares ONE lit material and re-skins by rewriting color buffers.
import * as THREE from 'three';
import { resolveRole } from './colors.js';
import { R } from './constants.js';

const { Matrix4, Vector3, Quaternion, Euler, BufferGeometry, BufferAttribute } = THREE;

export const mat = (pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) =>
  new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale));

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
const ico = (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

// Merges many primitives into one non-indexed, vertex-coloured BufferGeometry.
export class Builder {
  constructor() {
    this.parts = [];
    this.base = new Matrix4();
  }

  add(geo, role, local, shade = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = this.base.clone();
    if (local) m.multiply(local);
    g.applyMatrix4(m);
    this.parts.push({ g, role, shade, count: g.attributes.position.count });
    geo.dispose();
    return this;
  }

  build(th) {
    let total = 0;
    for (const p of this.parts) total += p.count;
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const ranges = [];
    let o = 0;
    for (const p of this.parts) {
      pos.set(p.g.attributes.position.array, o * 3);
      nor.set(p.g.attributes.normal.array, o * 3);
      ranges.push({ start: o, count: p.count, role: p.role, shade: p.shade });
      o += p.count;
      p.g.dispose();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(pos, 3));
    geometry.setAttribute('normal', new BufferAttribute(nor, 3));
    const colAttr = new BufferAttribute(col, 3);
    geometry.setAttribute('color', colAttr);
    const recolor = (t) => {
      for (const r of ranges) {
        const c = resolveRole(r.role, t).multiplyScalar(r.shade);
        for (let i = r.start; i < r.start + r.count; i++) {
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
      }
      colAttr.needsUpdate = true;
    };
    recolor(th);
    geometry.computeBoundingSphere();
    return { geometry, recolor, vertexCount: total };
  }
}

// ---------------------------------------------------------------- materials

export function createMaterials(th) {
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  const glowScreen = new THREE.MeshBasicMaterial({ toneMapped: false });
  const glowAccent = new THREE.MeshBasicMaterial({ toneMapped: false });
  const glowWarm = new THREE.MeshBasicMaterial({ toneMapped: false });
  const mats = { lit, glowScreen, glowAccent, glowWarm };
  applyThemeToMaterials(mats, th);
  return mats;
}

export function applyThemeToMaterials(mats, th) {
  mats.glowScreen.color.set(th.colors.primaryText);
  mats.glowAccent.color.set(th.scene.characterAccent);
  mats.glowWarm.color.set(th.scene.globeLight);
  mats.glowScreen.userData.base = mats.glowScreen.color.clone();
  mats.glowAccent.userData.base = mats.glowAccent.color.clone();
  mats.glowWarm.userData.base = mats.glowWarm.color.clone();
}

// ---------------------------------------------------------------- globe

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function buildGlobe(th, detail) {
  let g = new THREE.IcosahedronGeometry(R, detail);
  if (g.index) g = g.toNonIndexed();
  const pos = g.attributes.position;
  const faces = pos.count / 3;
  const land = new Float32Array(faces);
  const jit = new Float32Array(faces);
  const ice = new Float32Array(faces);
  const c = new THREE.Vector3();
  for (let f = 0; f < faces; f++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(new Vector3().fromBufferAttribute(pos, f * 3 + k));
    c.divideScalar(3);
    const n = c.clone().divideScalar(R);
    const noise = Math.sin(n.x * 3.1 + 0.6) * Math.cos(n.y * 2.6 - 0.4) + Math.sin(n.z * 3.7 + n.x * 1.6) * 0.6 + Math.sin((n.x + n.y + n.z) * 4.6) * 0.3;
    land[f] = noise > 0.35 ? 1 : 0;
    jit[f] = (hash3(c.x, c.y, c.z) - 0.5) * 0.14;
    ice[f] = Math.abs(n.y) > 0.9 ? 1 : 0;
  }
  const colAttr = new BufferAttribute(new Float32Array(pos.count * 3), 3);
  g.setAttribute('color', colAttr);
  const recolor = (t) => {
    const base = resolveRole('globeBase', t), acc = resolveRole('globeAccent', t), light = resolveRole('globeLight', t);
    const tmp = new THREE.Color();
    for (let f = 0; f < faces; f++) {
      tmp.copy(land[f] ? acc.clone().lerp(light, 0.12) : base);
      if (ice[f]) tmp.lerp(light, 0.7);
      tmp.multiplyScalar(1 + jit[f]);
      for (let k = 0; k < 3; k++) colAttr.setXYZ(f * 3 + k, tmp.r, tmp.g, tmp.b);
    }
    colAttr.needsUpdate = true;
  };
  recolor(th);
  g.computeBoundingSphere();
  return { geometry: g, recolor, vertexCount: pos.count };
}

export function buildStars(count, th) {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = hash3(i, 1.3, 7.1) * 2 - 1, a = hash3(i, 9.7, 2.2) * Math.PI * 2, rr = 22 + hash3(i, 4.4, 5.5) * 12;
    const s = Math.sqrt(1 - u * u);
    arr[i * 3] = Math.cos(a) * s * rr; arr[i * 3 + 1] = u * rr; arr[i * 3 + 2] = Math.sin(a) * s * rr;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(arr, 3));
  const material = new THREE.PointsMaterial({ size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
  material.color.set(th.scene.globeLight);
  return { points: new THREE.Points(geometry, material), geometry, material };
}

// ---------------------------------------------------------------- figures
// Authored ~1.1 units tall, feet at y=0, facing +z.

const D = { hipY: 0.47, hipX: 0.09, thigh: 0.23, shin: 0.24, shoulderY: 0.82, shoulderX: 0.235, arm: 0.33 };

function bodyParts(b, o) {
  const { accentRole, skinRole, pack, detail, shade = 1 } = o;
  b.add(cyl(0.2, 0.16, 0.4, 7), accentRole, mat([0, 0.67, 0]), shade);
  b.add(cyl(0.165, 0.165, 0.05, 7), accentRole, mat([0, 0.49, 0]), shade * 0.65);
  b.add(cyl(0.05, 0.06, 0.07, 6), skinRole, mat([0, 0.9, 0]));
  b.add(ico(0.14, detail), skinRole, mat([0, 1.02, 0], [0, 0, 0], [1, 1.08, 1]));
  if (pack) b.add(box(0.22, 0.28, 0.1), accentRole, mat([0, 0.68, -0.19]), shade * 0.7);
}

function armParts(b, o) {
  const { accentRole, skinRole, shade = 1 } = o;
  b.add(cyl(0.062, 0.06, 0.13, 6), accentRole, mat([0, -0.055, 0]), shade);
  b.add(cyl(0.05, 0.045, 0.24, 6), skinRole, mat([0, -0.2, 0]));
  b.add(ico(0.055, 0), skinRole, mat([0, -0.335, 0]));
}

function thighParts(b, o) {
  b.add(cyl(0.07, 0.06, D.thigh, 6), o.legRole, mat([0, -D.thigh / 2, 0]));
}

function shinParts(b, o) {
  b.add(cyl(0.06, 0.05, D.shin, 6), o.legRole, mat([0, -D.shin / 2, 0]));
  b.add(box(0.11, 0.06, 0.17), o.shoeRole, mat([0, -D.shin - 0.015, 0.04]));
}

const HERO_ROLES = { accentRole: 'accent', skinRole: 'body', legRole: 'legs', shoeRole: 'shoe', pack: true };

export function buildHero(th, cfg, mats) {
  const detail = cfg.isMobile ? 0 : 1;
  const recolors = [];
  const geos = [];
  let verts = 0;
  const mk = (fn) => {
    const b = new Builder();
    fn(b);
    const r = b.build(th);
    recolors.push(r.recolor);
    geos.push(r.geometry);
    verts += r.vertexCount;
    const m = new THREE.Mesh(r.geometry, mats.lit);
    m.castShadow = cfg.shadows;
    return m;
  };
  const o = { ...HERO_ROLES, detail };

  const root = new THREE.Group();   // pivot placed on the globe surface (scaled)
  const model = new THREE.Group();  // yaw
  const body = new THREE.Group();   // pitch + vertical offset (sit / hop)
  root.add(model);
  model.add(body);
  model.position.y = 0.02;

  body.add(mk((b) => bodyParts(b, o)));

  const armL = new THREE.Group(); armL.position.set(-D.shoulderX, D.shoulderY, 0);
  const armR = new THREE.Group(); armR.position.set(D.shoulderX, D.shoulderY, 0);
  armL.add(mk((b) => armParts(b, o)));
  armR.add(mk((b) => armParts(b, o)));
  body.add(armL, armR);

  const hipL = new THREE.Group(); hipL.position.set(-D.hipX, D.hipY, 0);
  const hipR = new THREE.Group(); hipR.position.set(D.hipX, D.hipY, 0);
  const kneeL = new THREE.Group(); kneeL.position.y = -D.thigh;
  const kneeR = new THREE.Group(); kneeR.position.y = -D.thigh;
  hipL.add(mk((b) => thighParts(b, o)), kneeL);
  hipR.add(mk((b) => thighParts(b, o)), kneeR);
  kneeL.add(mk((b) => shinParts(b, o)));
  kneeR.add(mk((b) => shinParts(b, o)));
  body.add(hipL, hipR);

  // Invisible, generous hit proxy for pointer picking (also good for touch)
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.25, 8), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.y = 0.62;
  proxy.userData.pick = { type: 'hero' };
  geos.push(proxy.geometry);
  model.add(proxy);

  root.scale.setScalar(0.75);
  return { root, model, body, armL, armR, hipL, hipR, kneeL, kneeR, proxy, recolors, geos, vertexCount: verts };
}

// Static seated/standing cohort member (single merged mesh; stool baked in for seated ones)
export function buildMember(th, cfg, mats, idx, mentor) {
  const b = new Builder();
  const role = 'cohort:' + (1 + (idx % Math.max(1, th.scene.cohortColors.length - 1))); // index 0 (accent) is reserved for the hero
  const o = { accentRole: role, skinRole: 'skin', legRole: 'legs', shoeRole: 'shoe', pack: false, detail: cfg.figureDetail, shade: 1 };
  const seated = !mentor;
  const drop = seated ? -0.21 : 0;
  if (seated) {
    b.base = new Matrix4();
    b.add(cyl(0.12, 0.1, 0.22, 8), 'wood', mat([0, 0.11, 0]));
  }
  b.base = mat([0, drop, 0]);
  bodyParts(b, o);
  const armAng = seated ? [-0.9, -0.9] : [0.06, -1.25];
  for (const [side, ang] of [[-1, armAng[0]], [1, armAng[1]]]) {
    b.base = mat([0, drop, 0]).multiply(mat([side * D.shoulderX, D.shoulderY, 0], [ang, 0, side * 0.08]));
    armParts(b, o);
  }
  for (const side of [-1, 1]) {
    const hipBase = mat([0, drop, 0]).multiply(mat([side * D.hipX, D.hipY, 0], [seated ? -1.45 : 0, 0, 0]));
    b.base = hipBase;
    thighParts(b, o);
    b.base = hipBase.clone().multiply(mat([0, -D.thigh, 0], [seated ? 1.45 : 0, 0, 0]));
    shinParts(b, o);
  }
  if (mentor) {
    b.base = new Matrix4();
    b.add(new THREE.OctahedronGeometry(0.075, 0), 'light', mat([0, 1.3, 0], [0, 0.6, 0], [1, 1.35, 1]));
  }
  const r = b.build(th);
  const mesh = new THREE.Mesh(r.geometry, mats.lit);
  mesh.castShadow = cfg.shadows;
  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(mentor ? 1.05 : 0.85);
  const geos = [r.geometry];
  let proxy = null;
  if (mentor) {
    proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = 0.65;
    geos.push(proxy.geometry);
    group.add(proxy);
  }
  return { group, mesh, proxy, recolor: r.recolor, geos, vertexCount: r.vertexCount };
}

// ---------------------------------------------------------------- sites (in site-local units, frame scaled by SITE_SCALE)

function plinth(b, x, z, r) {
  b.add(cyl(r, r + 0.05, 0.7, 12), 'plinth', mat([x, -0.33, z]));
}

function mesh(geo, material, cfg, cast = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cfg.shadows && cast;
  m.receiveShadow = cfg.shadows;
  return m;
}

export function buildApplySite(th, cfg, mats, frame) {
  const recolors = [], geos = [];
  const keep = (r) => { recolors.push(r.recolor); geos.push(r.geometry); return r; };

  const stat = new Builder();
  plinth(stat, 0.3, -0.1, 1.35);
  stat.add(cyl(0.05, 0.07, 0.5, 6), 'metal', mat([0.85, 0.25, -0.12]));
  stat.add(cyl(0.2, 0.24, 0.06, 8), 'metal', mat([0.85, 0.05, -0.12]));
  frame.add(mesh(keep(stat.build(th)).geometry, mats.lit, cfg));

  const panel = new THREE.Group();
  panel.position.set(0.85, 0.86, -0.12);
  panel.rotation.y = -0.45;
  const p = new Builder();
  p.add(box(1.02, 0.74, 0.05), 'frame');
  p.add(box(0.94, 0.66, 0.03), 'screenBg', mat([0, 0, 0.02]));
  panel.add(mesh(keep(p.build(th)).geometry, mats.lit, cfg));

  const f = new Builder();
  f.add(box(0.62, 0.06, 0.012), 'white', mat([-0.13, 0.19, 0.045]));
  f.add(box(0.62, 0.06, 0.012), 'white', mat([-0.13, 0.06, 0.045]));
  f.add(box(0.42, 0.06, 0.012), 'white', mat([-0.23, -0.07, 0.045]));
  f.add(box(0.13, 0.13, 0.012), 'white', mat([0.31, 0.16, 0.045]));
  const fields = new THREE.Mesh(keep(f.build(th)).geometry, mats.glowScreen);
  panel.add(fields);

  const btnB = new Builder();
  btnB.add(box(0.34, 0.1, 0.014), 'white');
  const button = new THREE.Mesh(keep(btnB.build(th)).geometry, mats.glowAccent);
  button.position.set(0.22, -0.23, 0.047);
  panel.add(button);

  const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.95, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.userData.pick = { type: 'form' };
  geos.push(proxy.geometry);
  panel.add(proxy);
  frame.add(panel);
  return { panel, fields, button, proxy, recolors, geos };
}

export function buildLearnSite(th, cfg, mats, frame, mentorIds) {
  const recolors = [], geos = [];
  const centerZ = -0.95, radius = 0.95;
  const stat = new Builder();
  plinth(stat, 0, centerZ + 0.1, 1.6);
  stat.add(cyl(1.3, 1.3, 0.04, 20), 'rug', mat([0, 0.025, centerZ]));
  // The empty seat the hero will take
  stat.add(cyl(0.12, 0.1, 0.22, 8), 'accent', mat([0, 0.13, 0]), 0.9);
  const sr = stat.build(th);
  recolors.push(sr.recolor); geos.push(sr.geometry);
  frame.add(mesh(sr.geometry, mats.lit, cfg));

  // Learning hub crystal in the middle of the ring
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mats.glowAccent);
  crystal.position.set(0, 0.5, centerZ);
  crystal.scale.y = 1.4;
  geos.push(crystal.geometry);
  frame.add(crystal);

  const ringGroup = new THREE.Group();
  ringGroup.position.set(0, 0, centerZ);
  frame.add(ringGroup);

  const M = cfg.members;
  const m1 = 1, m2 = Math.round(M * 0.6);
  const members = [];
  let verts = sr.vertexCount;
  for (let i = 0; i < M; i++) {
    let mentorIdx = -1;
    if (i === m1) mentorIdx = 0; else if (i === m2) mentorIdx = 1;
    const isMentor = mentorIdx >= 0 && !!mentorIds[mentorIdx];
    const mem = buildMember(th, cfg, mats, i, isMentor);
    verts += mem.vertexCount;
    recolors.push(mem.recolor); geos.push(...mem.geos);
    ringGroup.add(mem.group);
    const entry = { i, group: mem.group, mesh: mem.mesh, mentorId: isMentor ? mentorIds[mentorIdx] : null, baseScale: mem.group.scale.x, hover: 0 };
    if (isMentor) {
      mem.proxy.userData.pick = { type: 'mentor', id: entry.mentorId, member: entry };
      mem.mesh.userData.pick = mem.proxy.userData.pick;
      entry.proxy = mem.proxy;
    }
    members.push(entry);
  }
  return { crystal, ringGroup, members, radius, N: M + 1, recolors, geos, vertexCount: verts };
}

export function buildPlacedSite(th, cfg, mats, frame) {
  const recolors = [], geos = [];
  const keep = (r) => { recolors.push(r.recolor); geos.push(r.geometry); return r; };
  const b = new Builder();
  plinth(b, -0.35, -0.5, 1.75);
  // desk
  b.base = mat([-1.0, 0, 0.05], [0, 0.5, 0]);
  b.add(box(0.95, 0.05, 0.5), 'wood', mat([0, 0.42, 0]));
  for (const [x, z] of [[-0.42, -0.2], [0.42, -0.2], [-0.42, 0.2], [0.42, 0.2]]) b.add(box(0.05, 0.4, 0.05), 'wood', mat([x, 0.2, z]), 0.8);
  b.add(box(0.3, 0.02, 0.22), 'metal', mat([-0.1, 0.455, 0]));
  b.add(cyl(0.045, 0.04, 0.09, 6), 'accent', mat([0.3, 0.5, 0.08]));
  // chair, pulled out
  b.base = mat([-0.75, 0, 0.62], [0, 0.9, 0]);
  b.add(box(0.3, 0.04, 0.3), 'accent', mat([0, 0.26, 0]), 0.8);
  b.add(box(0.3, 0.3, 0.04), 'accent', mat([0, 0.44, -0.15]), 0.8);
  b.add(cyl(0.03, 0.03, 0.24, 5), 'metal', mat([0, 0.13, 0]));
  // plant
  b.base = mat([-1.75, 0, 0.35]);
  b.add(cyl(0.11, 0.08, 0.16, 6), 'wood', mat([0, 0.08, 0]));
  b.add(ico(0.16, 0), 'plant', mat([0, 0.3, 0], [0, 0, 0], [1, 1.3, 1]));
  // building backdrop
  b.base = new Matrix4();
  b.add(box(1.7, 1.8, 0.5), 'building', mat([-0.35, 0.9, -1.3]));
  b.add(box(1.0, 0.7, 0.45), 'building', mat([-1.5, 0.35, -1.15]), 0.85);
  b.add(box(0.9, 0.12, 0.05), 'accent', mat([-0.35, 1.62, -1.03]));
  b.add(box(0.3, 0.5, 0.03), 'screenBg', mat([-0.35, 0.25, -1.04]));
  frame.add(mesh(keep(b.build(th)).geometry, mats.lit, cfg));

  // glowing windows + laptop screen
  const w = new Builder();
  for (let cx = 0; cx < 4; cx++) for (let cy = 0; cy < 3; cy++) {
    if (cy === 0 && (cx === 1 || cx === 2)) continue; // door column
    w.add(box(0.2, 0.2, 0.02), 'light', mat([-0.9 + cx * 0.37, 0.7 + cy * 0.36, -1.045]));
  }
  frame.add(new THREE.Mesh(keep(w.build(th)).geometry, mats.glowWarm));

  const ls = new Builder();
  ls.add(box(0.3, 0.2, 0.012), 'white', mat([0, 0, 0]));
  const laptop = new THREE.Mesh(keep(ls.build(th)).geometry, mats.glowScreen);
  // desk group transform: pos (-1.0,0,0.05), rotY 0.5; laptop at local (-0.1,0.56,-0.08)
  const lg = new THREE.Group();
  lg.position.set(-1.0, 0, 0.05);
  lg.rotation.y = 0.5;
  laptop.position.set(-0.1, 0.565, -0.07);
  laptop.rotation.x = -0.2;
  lg.add(laptop);
  frame.add(lg);
  return { recolors, geos };
}

// ---------------------------------------------------------------- celebration (single restrained pulse)

export function buildBurst(th, cfg) {
  const n = cfg.isMobile ? 12 : 24;
  const geo = new THREE.IcosahedronGeometry(0.06, 0);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false });
  const inst = new THREE.InstancedMesh(geo, material, n);
  inst.frustumCulled = false;
  const dirs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, up = 0.5 + hash3(i, 3.3, 1.1) * 0.9;
    dirs.push(new Vector3(Math.cos(a) * (0.7 + hash3(i, 1, 2) * 0.5), up, Math.sin(a) * (0.7 + hash3(i, 2, 3) * 0.5)));
  }
  const ringGeo = new THREE.RingGeometry(0.3, 0.38, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.06;
  const group = new THREE.Group();
  group.add(inst, ring);
  group.visible = false;
  group.scale.setScalar(0.75);
  const recolor = (t) => {
    const cc = t.scene.cohortColors;
    for (let i = 0; i < n; i++) inst.setColorAt(i, new THREE.Color(cc[i % cc.length]));
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    ringMat.color.set(t.scene.globeLight);
  };
  recolor(th);
  return { group, inst, ring, ringMat, material, dirs, n, recolor, geos: [geo, ringGeo], materials: [material, ringMat] };
}
