// ═══════════════════════════════════════════════════════════════════════════
// Models.js — PROTSEDURAL 3D MODELLAR
//
// Tashqi .glb fayllarga bog'liq bo'lmaslik uchun barcha modellar
// Three.js primitivlaridan quriladi. Shunday qilib loyiha to'liq
// oflayn ishlaydi va hech qanday yuklash kechikishi bo'lmaydi.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { grassTexture, dirtTexture, roadTexture, tileTexture, brickTexture, plasterTexture, concreteTexture } from './textures.js';

// ───────────────────────────────────────────────────────────────────────────
// MATERIALLAR
// ───────────────────────────────────────────────────────────────────────────
export function stdMat(color, opts = {}) {
  const colorKey = color && color.isColor ? color.getHexString() : String(color);
  const options = {
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.02,
    flatShading: opts.flat ?? false,
    emissive: opts.emissive ?? null,
    emissiveIntensity: opts.emissiveIntensity ?? 1
  };
  const key = `${colorKey}|${options.roughness}|${options.metalness}|${options.flatShading}|${options.emissive}|${options.emissiveIntensity}`;
  if (opts.shared && sharedMaterials.has(key)) return sharedMaterials.get(key);

  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness,
    metalness: options.metalness,
    flatShading: options.flatShading
  });
  if (options.emissive != null) {
    m.emissive = new THREE.Color(options.emissive);
    m.emissiveIntensity = options.emissiveIntensity;
  }
  m.userData.base = color;
  if (opts.shared) sharedMaterials.set(key, m);
  return m;
}

export function glowMat(color) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true
  });
}

const geometryCache = new Map();
const sharedMaterials = new Map();
const cachedGeometry = (key, create) => {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
};
const sharedCarGlass = new THREE.MeshPhysicalMaterial({
  color: 0x9ab8c5, roughness: 0.16, metalness: 0.32,
  transparent: true, opacity: 0.76, clearcoat: 0.85, side: THREE.DoubleSide
});
const GEOS = {
  box: (w, h, d) => cachedGeometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt, rb, h, seg = 10) =>
    cachedGeometry(`cyl:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  sphere: (r, seg = 12) =>
    cachedGeometry(`sphere:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, 10)),
  capsule: (r, length, cap = 4, radial = 8) =>
    cachedGeometry(`capsule:${r}:${length}:${cap}:${radial}`, () => new THREE.CapsuleGeometry(r, length, cap, radial)),
  cone: (r, h, seg = 10) => cachedGeometry(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  plane: (w, d) => cachedGeometry(`plane:${w}:${d}`, () => new THREE.PlaneGeometry(w, d))
};

/** Oddiy mesh yaratadi va skeylni o'rnatadi. */
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
// AVATAR — insoniy nisbat va yumaloq, artikulyatsiyalangan tana qismlari
// Animatsiya qismlari: armL, armR, legL, legR, torso, head, group
// ═══════════════════════════════════════════════════════════════════════════
export function buildAvatar(opts = {}) {
  const g = new THREE.Group();
  const mat = (color, materialOpts = {}) =>
    stdMat(color, { ...materialOpts, shared: !!opts.sharedMaterials });
  const skin = opts.skin ?? 0xf1c27d;
  const eyelid = new THREE.Color(skin).lerp(new THREE.Color(0x573d34), 0.14);
  const shirt = opts.shirt ?? 0x4f6ef7;
  const pants = opts.pants ?? 0x2a3350;
  const shoe = opts.shoe ?? 0x23283a;
  const hairC = opts.hair ?? 0x3a2a1a;
  const jacket = opts.jacket ?? null;

  const parts = {};

  // ── Oyoqlar: son, tizza, boldir va oyoq kiyim ──
  parts.legL = pivotLeg(-0.1, skin, shoe, pants, mat);
  parts.legR = pivotLeg(0.1, skin, shoe, pants, mat);
  g.add(parts.legL.pivot, parts.legR.pivot);

  // ── Tana va yelka ──
  parts.torso = new THREE.Group();
  parts.torso.position.set(0, 0.9, 0);
  const clothMat = mat(jacket || shirt, { roughness: 0.94 });
  const hip = mesh(GEOS.capsule(0.17, 0.1, 4, 8), mat(pants, { roughness: 0.92 }), 0, -0.18, 0);
  hip.scale.set(1, 0.72, 0.72);
  const chest = mesh(GEOS.capsule(0.2, 0.25, 5, 10), clothMat, 0, 0.09, 0);
  chest.scale.set(1, 1, 0.76);
  for (const sx of [-0.21, 0.21]) {
    parts.torso.add(mesh(GEOS.sphere(0.115, 10), clothMat, sx, 0.22, 0));
  }
  const collar = mesh(GEOS.cyl(0.075, 0.09, 0.09, 10), mat(skin), 0, 0.32, 0);
  const seamColor = new THREE.Color(jacket || shirt).multiplyScalar(0.78).getHex();
  const seam = mesh(GEOS.box(0.018, 0.27, 0.012), mat(seamColor, { roughness: 0.9 }), 0, 0.09, 0.153);
  parts.torso.add(hip, chest, collar, seam);
  g.add(parts.torso);

  // ── Qo'llar: yelka, bilak va kaft ──
  parts.armL = pivotArm(-0.27, skin, shoe, jacket || shirt, mat);
  parts.armR = pivotArm(0.27, skin, shoe, jacket || shirt, mat);
  g.add(parts.armL.pivot, parts.armR.pivot);

  // ── Bosh, quloqlar va yuz ──
  parts.head = new THREE.Group();
  parts.head.position.set(0, 1.48, 0);
  const neck = mesh(GEOS.capsule(0.065, 0.1, 4, 8), mat(skin), 0, -0.2, 0);
  const skull = mesh(GEOS.sphere(0.155, 18), mat(skin, { roughness: 0.78 }), 0, 0, 0);
  skull.scale.set(0.94, 1.12, 0.98);
  const hairStyle = opts.hairStyle || 'short';
  const hair = mesh(cachedGeometry('hair-cap:0.16:14:10',
    () => new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68)),
  mat(hairC, { roughness: 0.96 }), 0, 0.04, -0.01);
  if (hairStyle === 'long') {
    hair.scale.set(1.02, 0.65, 1.08);
    hair.position.y = 0.035;
    for (const sx of [-0.155, 0.155]) {
      const lock = mesh(GEOS.capsule(0.035, 0.15, 4, 8), mat(hairC), sx, -0.08, -0.015);
      lock.scale.z = 0.8;
      parts.head.add(lock);
    }
  } else if (hairStyle === 'curly') {
    hair.scale.set(1.08, 0.7, 1.1);
    hair.position.y = 0.055;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      parts.head.add(mesh(
        GEOS.sphere(0.052, 8), mat(hairC),
        Math.cos(angle) * 0.12, 0.105, Math.sin(angle) * 0.105
      ));
    }
  } else {
    hair.scale.set(1, 0.58, 1.06);
    const fringe = mesh(GEOS.capsule(0.025, 0.11, 4, 8), mat(hairC), 0, 0.105, 0.11);
    fringe.rotation.z = Math.PI / 2;
    fringe.scale.z = 0.55;
    parts.head.add(fringe);
  }
  for (const sx of [-1, 1]) {
    const ear = mesh(GEOS.sphere(0.038, 10), mat(skin), sx * 0.15, -0.01, 0);
    ear.scale.set(0.68, 1.15, 0.72);
    parts.head.add(ear);
  }
  for (const sx of [-1, 1]) {
    const eyeSocket = mesh(GEOS.sphere(0.039, 10), mat(eyelid), sx * 0.06, 0.045, 0.132);
    eyeSocket.scale.set(1.08, 0.82, 0.48);
    const eye = mesh(GEOS.sphere(0.027, 10), mat(0xfaf8f1), sx * 0.06, 0.045, 0.151);
    eye.scale.y = 0.78;
    const pupil = mesh(GEOS.sphere(0.014, 8), mat(0x28221e), sx * 0.06, 0.045, 0.17);
    const brow = mesh(GEOS.capsule(0.009, 0.04, 3, 6), mat(hairC), sx * 0.06, 0.092, 0.14);
    brow.rotation.z = Math.PI / 2;
    parts.head.add(eyeSocket, eye, pupil, brow);
  }
  const nose = mesh(GEOS.sphere(0.027, 10), mat(skin), 0, -0.015, 0.153);
  nose.scale.set(0.72, 1.05, 0.75);
  const mouth = mesh(GEOS.capsule(0.009, 0.045, 3, 8), mat(0x9a4a3a), 0, -0.085, 0.18);
  mouth.rotation.z = Math.PI / 2;
  const face = [neck, skull, hair, nose, mouth];
  if (opts.beard) {
    const beard = mesh(GEOS.sphere(0.1, 12), mat(hairC), 0, -0.105, 0.09);
    beard.scale.set(1.05, 0.8, 0.85);
    face.push(beard);
  }
  parts.head.add(...face);
  parts.head.userData.mouth = mouth;
  g.add(parts.head);

  g.userData.parts = parts;
  g.traverse(o => { o.userData.avatarPart = true; });
  return g;
}

function pivotLeg(x, skin, shoe, pants, mat) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.92, 0);
  const fabric = mat(pants, { roughness: 0.95 });
  const thigh = mesh(GEOS.capsule(0.078, 0.2, 4, 8), fabric, 0, -0.2, 0);
  const knee = new THREE.Group();
  knee.position.y = -0.39;
  knee.add(mesh(GEOS.sphere(0.075, 10), fabric));
  const shin = mesh(GEOS.capsule(0.067, 0.2, 4, 8), fabric, 0, -0.17, 0);
  const sock = mesh(GEOS.capsule(0.066, 0.045, 3, 8), mat(skin), 0, -0.33, 0);
  const foot = mesh(GEOS.capsule(0.07, 0.13, 4, 8), mat(shoe, { roughness: 0.72 }), 0, -0.4, 0.065);
  foot.scale.z = 1.2;
  knee.add(shin, sock, foot);
  pivot.add(thigh, knee);
  return { pivot, knee, mesh: thigh };
}

function pivotArm(x, skin, shoe, shirt, mat) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 1.21, 0);
  const sleeveMat = mat(shirt, { roughness: 0.94 });
  const upper = mesh(GEOS.capsule(0.075, 0.19, 4, 8), sleeveMat, 0, -0.15, 0);
  const elbow = new THREE.Group();
  elbow.position.y = -0.31;
  elbow.add(mesh(GEOS.sphere(0.064, 9), sleeveMat));
  const forearm = mesh(GEOS.capsule(0.057, 0.18, 4, 8), mat(skin, { roughness: 0.82 }), 0, -0.12, 0);
  const wrist = mesh(GEOS.cyl(0.05, 0.052, 0.035, 8), mat(shoe), 0, -0.23, 0);
  const hand = mesh(GEOS.sphere(0.06, 10), mat(skin, { roughness: 0.82 }), 0, -0.29, 0.01);
  hand.scale.set(0.9, 1.05, 0.8);
  elbow.add(forearm, wrist, hand);
  pivot.add(upper, elbow);
  return { pivot, elbow, mesh: upper };
}

// ═══════════════════════════════════════════════════════════════════════════
// NPC — avatar bilan bir xil tuzilma, ammo turlicha ranglar va "!" belgisi
// ═══════════════════════════════════════════════════════════════════════════
export function buildNPC(opts) {
  const g = buildAvatar(opts);
  const badge = new THREE.Group();
  badge.position.set(0, 2.1, 0);
  const bg = mesh(GEOS.box(0.42, 0.3, 0.06), stdMat(0xffd23f, { flat: true }));
  const ex = makeTextSprite('!', { size: 0.22, color: '#1a1400', weight: 'bold' });
  ex.position.set(0, 0, 0.035);
  badge.add(bg, ex);
  badge.visible = false;
  g.add(badge);
  g.userData.badge = badge;
  g.userData.isNPC = true;
  return g;
}

// ───────────────────────────────────────────────────────────────────────────
// MATN SPRITI (CSS2D ishlatmasdan ham bilib bo'lmaydigan joylar uchun)
// ───────────────────────────────────────────────────────────────────────────
export function makeTextSprite(text, opts = {}) {
  const canvas = document.createElement('canvas');
  const size = opts.size || 0.2;
  const fontPx = opts.fontPx || 160;
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${opts.weight || 'bold'} ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color || '#ffffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size * 2.5, size * 1.25, 1);
  return sp;
}

// ═══════════════════════════════════════════════════════════════════════════
// BINOLAR — turiga qarab farqlanadi
// ═══════════════════════════════════════════════════════════════════════════
export function buildBuilding(type, w, d, h) {
  const g = new THREE.Group();
  const roofH = Math.min(2.6, h * 0.22);
  const windowFrame = stdMat(0x344354, { roughness: 0.55, metalness: 0.3 });
  const windowGlass = stdMat(0x9ad4ff, { roughness: 0.24, metalness: 0.18 });
  windowGlass.userData.isWindow = true;

  // Devor materiali — turiga qarab teksturali
  function wallMat(kind, hex, ww, hh) {
    const fns = { brick: brickTexture, plaster: plasterTexture, concrete: concreteTexture };
    const mat = stdMat(hex, { roughness: 0.95 });
    mat.map = fns[kind](hex, [Math.max(1, Math.round(ww / 5)), Math.max(1, Math.round(hh / 3))]);
    mat.color.set(0xffffff);
    mat.userData.base = hex;
    return mat;
  }

  function addWindowGrid(width, rows, columns, z, centerY) {
    const gapX = Math.max(0.35, width / (columns * 5));
    const gapY = 0.32;
    const paneWidth = (width - gapX * (columns + 1)) / columns;
    const paneHeight = Math.max(0.55, (h - 1.4 - gapY * (rows + 1)) / rows);
    for (let row = 0; row < rows; row++) {
      const y = centerY + (rows - 1) * (paneHeight + gapY) / 2 - row * (paneHeight + gapY);
      for (let column = 0; column < columns; column++) {
        const x = -width / 2 + gapX + paneWidth / 2 + column * (paneWidth + gapX);
        g.add(
          mesh(GEOS.box(paneWidth + 0.12, paneHeight + 0.12, 0.08), windowFrame, x, y, z),
          mesh(GEOS.box(paneWidth, paneHeight, 0.035), windowGlass, x, y, z + 0.06),
          mesh(GEOS.box(paneWidth + 0.18, 0.08, 0.14), windowFrame, x, y - paneHeight / 2 - 0.08, z + 0.03)
        );
      }
    }
  }

  switch (type) {
    case 'cafe': {
      const wall = mesh(GEOS.box(w, h, d), wallMat('brick', 0xe8a24a, w, h), 0, h / 2, 0);
      const roof = mesh(GEOS.box(w + 0.6, 0.3, d + 0.6), stdMat(0x7a4a2b), 0, h + 0.15, 0);
      const sign = mesh(GEOS.box(w * 0.5, 0.7, 0.12), stdMat(0x3a2410), 0, h * 0.55, d / 2 + 0.06);
      const door = mesh(GEOS.box(0.8, 1.6, 0.14), stdMat(0x5a3410), 0, 0.8, d / 2 + 0.07);
      // derazalar
      for (const sx of [-1.2, 0, 1.2]) {
        const win = mesh(GEOS.box(0.7, 0.6, 0.1), stdMat(0x9ad4ff, { roughness: 0.3 }), sx, 1.7, d / 2 + 0.06);
        g.add(win);
      }
      g.add(wall, roof, sign, door);
      break;
    }
    case 'market': {
      // ustunlar va ayvon
      const base = mesh(GEOS.box(w, 2.4, d), wallMat('plaster', 0x8a7a4a, w, 2.4), 0, 1.2, 0);
      const posts = [];
      for (const [px, pz] of [[-w / 2 + 1, -d / 2 + 1], [w / 2 - 1, -d / 2 + 1], [-w / 2 + 1, d / 2 - 1], [w / 2 - 1, d / 2 - 1]]) {
        posts.push(mesh(GEOS.cyl(0.18, 0.18, 3, 8), stdMat(0x5a4a2a), px, 1.5, pz));
      }
      const awning = mesh(GEOS.box(w + 1.4, 0.3, d + 1.4), stdMat(0x22c55e), 0, 3.2, 0);
      const roof = mesh(GEOS.box(w + 2, 0.25, d + 2), stdMat(0xb8a060), 0, 3.6, 0);
      const strip = mesh(GEOS.box(w + 1.4, 0.5, d + 1.4), stdMat(0x1e7f3f), 0, 2.7, 0);
      g.add(base, awning, strip, roof, ...posts);
      break;
    }
    case 'office': {
      const wall = mesh(GEOS.box(w, h, d), wallMat('plaster', 0x3b6bb0, w, h), 0, h / 2, 0);
      const roof = mesh(GEOS.box(w + 0.5, 0.35, d + 0.5), stdMat(0x2a3a5a), 0, h + 0.18, 0);
      addWindowGrid(w - 2, 3, Math.max(3, Math.floor(w / 4)), d / 2 + 0.06, h / 2);
      const entrance = mesh(GEOS.box(1.6, 2.2, 0.14), stdMat(0x22304a), 0, 1.1, d / 2 + 0.07);
      const canopy = mesh(GEOS.box(2.6, 0.18, 1.4), stdMat(0x22304a), 0, 2.5, d / 2 - 0.5);
      g.add(wall, roof, entrance, canopy);
      break;
    }
    case 'house': {
      const wall = mesh(GEOS.box(w, 2.6, d), wallMat('brick', 0xc87850, w, 2.6), 0, 1.3, 0);
      const roof = mesh(GEOS.cone(Math.max(w, d) * 0.82, 2.6, 4), stdMat(0x8a4a3a), 0, 3.6, 0);
      roof.rotation.y = Math.PI / 4;
      const door = mesh(GEOS.box(0.7, 1.5, 0.12), stdMat(0x6a3a2a), 0, 0.75, d / 2 + 0.06);
      for (const sx of [-w / 4, w / 4]) {
        const win = mesh(GEOS.box(0.7, 0.6, 0.1), stdMat(0x9ad4ff, { roughness: 0.3 }), sx, 1.6, d / 2 + 0.05);
        g.add(win);
      }
      g.add(wall, roof, door);
      break;
    }
    case 'school': {
      const wall = mesh(GEOS.box(w, 2.8, d), wallMat('plaster', 0x9a7ac8, w, 2.8), 0, 1.4, 0);
      const roof = mesh(GEOS.box(w + 0.6, 0.35, d + 0.6), stdMat(0x5a4a8a), 0, 3.05, 0);
      const door = mesh(GEOS.box(1, 1.8, 0.14), stdMat(0x4a3a6a), 0, 0.9, d / 2 + 0.07);
      for (let i = -1; i <= 1; i++) {
        const win = mesh(GEOS.box(0.9, 0.8, 0.1), stdMat(0xbfe3ff, { roughness: 0.3 }), i * 2, 1.8, d / 2 + 0.06);
        g.add(win);
      }
      g.add(wall, roof, door);
      break;
    }
    case 'airport': {
      const wall = mesh(GEOS.box(w, 3.2, d), wallMat('concrete', 0x8fb8c8, w, 3.2), 0, 1.6, 0);
      const roof = mesh(GEOS.box(w + 1, 0.4, d + 1), stdMat(0x5a7a8a), 0, 3.6, 0);
      const tower = mesh(GEOS.cyl(0.7, 0.9, 5.5, 8), stdMat(0x7a9aa8), w / 2 - 1, 2.75 + 3.2 / 2, d / 2 - 1);
      const glass = mesh(GEOS.cyl(0.9, 0.9, 0.8, 8), stdMat(0x9ad4ff, { roughness: 0.2 }), w / 2 - 1, 5.8 + 3.2 / 2, d / 2 - 1);
      const entrance = mesh(GEOS.box(2, 2.4, 0.16), stdMat(0x4a6a7a), 0, 1.2, d / 2 + 0.08);
      g.add(wall, roof, tower, glass, entrance);
      break;
    }
    case 'tower': {
      const wall = mesh(GEOS.box(w, h, d), wallMat('concrete', 0x6a7a8a, w, h), 0, h / 2, 0);
      const roof = mesh(GEOS.box(w + 0.5, 0.35, d + 0.5), stdMat(0x485564), 0, h + 0.18, 0);
      const rooftop = mesh(GEOS.box(w * 0.42, 0.55, d * 0.38), stdMat(0x687786), 0, h + 0.62, 0);
      const rows = Math.max(2, Math.floor((h - 1.2) / 1.5));
      addWindowGrid(w - 1.2, rows, Math.max(2, Math.floor(w / 2.5)), d / 2 + 0.06, h / 2);
      g.add(wall, roof, rooftop);
      break;
    }
    case 'shop': {
      const wall = mesh(GEOS.box(w, 2.8, d), wallMat('plaster', 0x7a9a6a, w, 2.8), 0, 1.4, 0);
      const roof = mesh(GEOS.box(w + 0.5, 0.3, d + 0.5), stdMat(0x3a5a3a), 0, 3.0, 0);
      const sign = mesh(GEOS.box(w * 0.6, 0.6, 0.12), stdMat(0xf5c842), 0, 2.3, d / 2 + 0.06);
      g.add(wall, roof, sign);
      break;
    }
    default: {
      const wall = mesh(GEOS.box(w, h, d), wallMat('concrete', 0x8a8a9a, w, h), 0, h / 2, 0);
      const roof = mesh(GEOS.box(w + 0.4, 0.3, d + 0.4), stdMat(0x5a5a6a), 0, h + 0.15, 0);
      g.add(wall, roof);
    }
  }

  // Shisha (deraza) materiallarini belgilash — tunda yonishi uchun
  g.traverse(o => {
    if (o.isMesh && o.material && o.material.color) {
      const hex = o.material.color.getHex();
      if (hex === 0x9ad4ff || hex === 0xbfe3ff) o.material.userData.isWindow = true;
    }
  });

  g.userData.building = true;
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// PREDMETLAR — lug'at so'zlari uchun
// ═══════════════════════════════════════════════════════════════════════════
export function buildProp(type) {
  const g = new THREE.Group();

  switch (type) {
    case 'cup': {
      const c = mesh(GEOS.cyl(0.16, 0.13, 0.3, 12), stdMat(0xf5f5f5), 0, 0.15, 0);
      const handle = mesh(GEOS.box(0.08, 0.14, 0.06), stdMat(0xf5f5f5), 0.18, 0.15, 0);
      const steam = mesh(GEOS.cyl(0.02, 0.02, 0.18, 6), stdMat(0xffffff, { roughness: 0.9 }), -0.02, 0.42, 0);
      steam.rotation.z = 0.2;
      g.add(c, handle, steam);
      break;
    }
    case 'menu': {
      const m = mesh(GEOS.box(0.4, 0.55, 0.03), stdMat(0xf7edd8), 0, 0.55, 0);
      m.rotation.z = 0.12;
      const line1 = mesh(GEOS.box(0.3, 0.03, 0.02), stdMat(0x3a2a1a), 0, 0.6, 0.02);
      const line2 = mesh(GEOS.box(0.24, 0.03, 0.02), stdMat(0x3a2a1a), 0, 0.5, 0.02);
      g.add(m, line1, line2);
      break;
    }
    case 'table': {
      const top = mesh(GEOS.box(0.7, 0.08, 0.7), stdMat(0x8a5a3a), 0, 0.55, 0);
      for (const [px, pz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        g.add(mesh(GEOS.box(0.07, 0.5, 0.07), stdMat(0x6a4a2a), px, 0.25, pz));
      }
      g.add(top);
      break;
    }
    case 'bill': {
      const b = mesh(GEOS.box(0.28, 0.04, 0.36), stdMat(0xffffff), 0, 0.18, 0);
      const l1 = mesh(GEOS.box(0.2, 0.03, 0.02), stdMat(0x444444), 0, 0.2, 0.19);
      const l2 = mesh(GEOS.box(0.16, 0.03, 0.02), stdMat(0x444444), 0, 0.2, 0.1);
      b.rotation.z = 0.08;
      g.add(b, l1, l2);
      break;
    }
    case 'bread': {
      const b = mesh(GEOS.box(0.3, 0.18, 0.18), stdMat(0xd9a85c), 0, 0.14, 0);
      b.rotation.z = 0.15;
      const crust = mesh(GEOS.box(0.32, 0.06, 0.19), stdMat(0xa06a2a), 0, 0.22, 0);
      crust.rotation.z = 0.15;
      g.add(b, crust);
      break;
    }
    case 'cake': {
      const c = mesh(GEOS.cyl(0.22, 0.22, 0.2, 12), stdMat(0xf0c0d0), 0, 0.1, 0);
      const top = mesh(GEOS.cyl(0.23, 0.23, 0.06, 12), stdMat(0xf5f5f5), 0, 0.22, 0);
      const cherry = mesh(GEOS.sphere(0.05, 8), stdMat(0xd43a4a), 0, 0.3, 0);
      g.add(c, top, cherry);
      break;
    }
    case 'juice':
    case 'coffee2': {
      const glass = mesh(GEOS.cyl(0.1, 0.1, 0.34, 10), stdMat(0xffb84a, { roughness: 0.3 }), 0, 0.17, 0);
      const straw = mesh(GEOS.cyl(0.015, 0.015, 0.34, 6), stdMat(0xffffff), 0.04, 0.3, 0);
      straw.rotation.z = 0.2;
      g.add(glass, straw);
      break;
    }
    case 'apple': {
      g.add(mesh(GEOS.sphere(0.18, 12), stdMat(0xd43a3a), 0, 0.2, 0));
      const stem = mesh(GEOS.cyl(0.02, 0.02, 0.12, 6), stdMat(0x5a3a1a), 0, 0.36, 0);
      g.add(stem);
      break;
    }
    case 'banana': {
      const b = mesh(GEOS.box(0.14, 0.3, 0.14), stdMat(0xf5c842), 0.1, 0.2, 0);
      b.rotation.z = 0.6;
      g.add(b);
      break;
    }
    case 'sign': {
      const post = mesh(GEOS.box(0.08, 0.9, 0.08), stdMat(0x5a5a6a), 0, 0.45, 0);
      const board = mesh(GEOS.box(0.5, 0.3, 0.06), stdMat(0x2a2a3a), 0, 0.95, 0);
      g.add(post, board);
      break;
    }
    case 'coin': {
      const c = mesh(GEOS.cyl(0.16, 0.16, 0.06, 14), stdMat(0xf5c842, { metalness: 0.5, roughness: 0.3 }), 0, 0.2, 0);
      c.rotation.x = Math.PI / 2;
      g.add(c);
      break;
    }
    case 'discount': {
      const s = mesh(GEOS.box(0.5, 0.5, 0.05), stdMat(0xef4444), 0, 0.55, 0);
      s.rotation.y = 0.3;
      const pct = makeTextSprite('%', { size: 0.12, color: '#ffffff' });
      pct.position.set(0, 0.55, 0.04);
      g.add(s, pct);
      break;
    }
    case 'basket': {
      const b = mesh(GEOS.box(0.5, 0.28, 0.4), stdMat(0xb8a060), 0, 0.2, 0);
      const handle = mesh(GEOS.cyl(0.24, 0.24, 0.04, 12), stdMat(0x8a7a4a), 0, 0.44, 0);
      g.add(b, handle);
      break;
    }
    case 'cheese': {
      const c = mesh(GEOS.cyl(0.18, 0.18, 0.12, 10), stdMat(0xf5c842), 0, 0.1, 0);
      c.rotation.x = Math.PI / 2;
      const holes = [mesh(GEOS.sphere(0.03, 6), stdMat(0xe8b02a), 0.06, 0.12, 0.06), mesh(GEOS.sphere(0.025, 6), stdMat(0xe8b02a), -0.06, 0.12, -0.04)];
      g.add(c, ...holes);
      break;
    }
    case 'seller': {
      g.add(buildSmallStatue(0xf59e0b));
      break;
    }
    case 'meeting': {
      const board = mesh(GEOS.box(1.0, 0.6, 0.05), stdMat(0xffffff), 0, 0.9, 0);
      const stand = mesh(GEOS.box(0.05, 0.9, 0.05), stdMat(0x444444), 0, 0.45, -0.1);
      const table = mesh(GEOS.box(0.9, 0.08, 0.5), stdMat(0x5a6a5a), 0.2, 0.5, 0.4);
      for (const [px, pz] of [[0, 0.4], [0.4, 0.4]]) g.add(mesh(GEOS.box(0.05, 0.45, 0.05), stdMat(0x5a6a5a), px, 0.22, pz));
      g.add(board, stand, table);
      break;
    }
    case 'clock': {
      const face = mesh(GEOS.cyl(0.22, 0.22, 0.06, 14), stdMat(0xffffff), 0, 0.55, 0);
      face.rotation.x = Math.PI / 2;
      const h1 = mesh(GEOS.box(0.02, 0.14, 0.02), stdMat(0x222222), 0, 0.6, 0);
      const h2 = mesh(GEOS.box(0.02, 0.09, 0.02), stdMat(0x222222), 0.04, 0.54, 0);
      const post = mesh(GEOS.box(0.06, 0.9, 0.06), stdMat(0x8a8a9a), 0, 0.3, 0);
      g.add(face, h1, h2, post);
      break;
    }
    case 'laptop': {
      const base = mesh(GEOS.box(0.5, 0.04, 0.34), stdMat(0x333344), 0, 0.5, 0);
      const screen = mesh(GEOS.box(0.46, 0.32, 0.03), stdMat(0x9ad4ff, { roughness: 0.3 }), 0, 0.68, -0.02);
      screen.rotation.x = -0.15;
      g.add(base, screen);
      break;
    }
    case 'report': {
      const r = mesh(GEOS.box(0.34, 0.05, 0.44), stdMat(0xffffff), 0, 0.16, 0);
      const l1 = mesh(GEOS.box(0.26, 0.03, 0.02), stdMat(0x444444), 0, 0.18, 0.2);
      g.add(r, l1);
      break;
    }
    case 'email': {
      const env = mesh(GEOS.box(0.4, 0.06, 0.28), stdMat(0xffffff), 0, 0.2, 0);
      env.rotation.z = 0.1;
      const flap = mesh(GEOS.box(0.4, 0.06, 0.28), stdMat(0xe0e0e0), 0, 0.22, 0);
      flap.rotation.z = 0.1;
      g.add(env, flap);
      break;
    }
    case 'phone': {
      const p = mesh(GEOS.box(0.12, 0.24, 0.02), stdMat(0x222233), 0, 0.3, 0);
      p.rotation.x = 0.3;
      g.add(p);
      break;
    }
    case 'colleague':
    case 'waiter':
    case 'agent':
    case 'teacher':
    case 'neighbor': {
      const shirt = { colleague: 0x3b82f6, waiter: 0x222233, agent: 0x06b6d4, teacher: 0xa855f7, neighbor: 0xec4899 }[type];
      g.add(buildSmallStatue(shirt));
      break;
    }
    case 'kitchen': {
      const counter = mesh(GEOS.box(0.8, 0.5, 0.4), stdMat(0xd8d8d8), 0, 0.28, 0);
      const sink = mesh(GEOS.box(0.3, 0.05, 0.26), stdMat(0x9aa8b8), 0, 0.52, 0);
      const tap = mesh(GEOS.cyl(0.02, 0.02, 0.2, 6), stdMat(0x9aa8b8, { metalness: 0.6 }), 0, 0.7, 0);
      g.add(counter, sink, tap);
      break;
    }
    case 'bed': {
      const base = mesh(GEOS.box(0.8, 0.25, 0.6), stdMat(0x5a5a6a), 0, 0.18, 0);
      const mattress = mesh(GEOS.box(0.7, 0.16, 0.5), stdMat(0xf5f5f5), 0, 0.38, 0);
      const pillow = mesh(GEOS.box(0.5, 0.1, 0.2), stdMat(0xffffff), 0, 0.5, -0.14);
      g.add(base, mattress, pillow);
      break;
    }
    case 'broom': {
      const stick = mesh(GEOS.cyl(0.02, 0.02, 1.1, 6), stdMat(0xb8a060), 0.08, 0.55, 0);
      stick.rotation.z = 0.3;
      const head = mesh(GEOS.box(0.05, 0.3, 0.1), stdMat(0x8a7a3a), -0.05, 0.05, 0);
      g.add(stick, head);
      break;
    }
    case 'key': {
      const k = mesh(GEOS.cyl(0.09, 0.09, 0.05, 12), stdMat(0xf5c842, { metalness: 0.5 }), 0, 0.2, 0);
      k.rotation.x = Math.PI / 2;
      const shaft = mesh(GEOS.box(0.05, 0.25, 0.04), stdMat(0xf5c842, { metalness: 0.5 }), 0, 0.16, 0);
      const teeth = mesh(GEOS.box(0.14, 0.04, 0.04), stdMat(0xf5c842, { metalness: 0.5 }), 0, 0.12, 0);
      g.add(k, shaft, teeth);
      break;
    }
    case 'sofa': {
      const seat = mesh(GEOS.box(0.9, 0.25, 0.4), stdMat(0x7a4a6a), 0, 0.2, 0);
      const back = mesh(GEOS.box(0.9, 0.4, 0.14), stdMat(0x6a3a5a), 0, 0.5, -0.15);
      const arm1 = mesh(GEOS.box(0.14, 0.4, 0.5), stdMat(0x6a3a5a), -0.42, 0.32, 0);
      const arm2 = mesh(GEOS.box(0.14, 0.4, 0.5), stdMat(0x6a3a5a), 0.42, 0.32, 0);
      g.add(seat, back, arm1, arm2);
      break;
    }
    case 'fridge': {
      const f = mesh(GEOS.box(0.5, 1.2, 0.35), stdMat(0xd8e8f0), 0, 0.6, 0);
      const handle1 = mesh(GEOS.box(0.03, 0.3, 0.03), stdMat(0x9aa8b8), 0.24, 0.7, 0.2);
      g.add(f, handle1);
      break;
    }
    case 'plant': {
      const pot = mesh(GEOS.cyl(0.16, 0.12, 0.25, 10), stdMat(0xc06a3a), 0, 0.14, 0);
      const leaf1 = mesh(GEOS.sphere(0.18, 8), stdMat(0x2f9e4f), 0, 0.42, 0);
      const leaf2 = mesh(GEOS.sphere(0.12, 8), stdMat(0x3ab45f), 0.1, 0.5, 0.05);
      g.add(pot, leaf1, leaf2);
      break;
    }
    case 'homework': {
      const book = mesh(GEOS.box(0.34, 0.06, 0.44), stdMat(0x9a4ac8), 0, 0.18, 0);
      book.rotation.x = 0.25;
      const pencil = mesh(GEOS.box(0.04, 0.04, 0.3), stdMat(0xf5c842), 0.15, 0.3, 0);
      pencil.rotation.x = 0.6;
      g.add(book, pencil);
      break;
    }
    case 'classroom': {
      const desk = mesh(GEOS.box(0.7, 0.08, 0.4), stdMat(0xb8a060), 0, 0.5, 0);
      for (const [px, pz] of [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]]) g.add(mesh(GEOS.box(0.05, 0.45, 0.05), stdMat(0x8a7a4a), px, 0.22, pz));
      g.add(desk);
      break;
    }
    case 'pencil': {
      const p = mesh(GEOS.box(0.05, 0.05, 0.5), stdMat(0xf5c842), 0, 0.25, 0);
      const tip = mesh(GEOS.cone(0.04, 0.12, 6), stdMat(0xf0d8b0), 0, 0.09, 0.3);
      tip.rotation.x = Math.PI / 2;
      g.add(p, tip);
      break;
    }
    case 'book': {
      const b = mesh(GEOS.box(0.36, 0.08, 0.28), stdMat(0x3b82f6), 0, 0.2, 0);
      const spine = mesh(GEOS.box(0.02, 0.08, 0.28), stdMat(0x2a5a9a), 0.18, 0.2, 0);
      const cover = mesh(GEOS.box(0.38, 0.1, 0.3), stdMat(0x2a5a9a), 0, 0.25, 0);
      g.add(b, spine, cover);
      break;
    }
    case 'board': {
      const board = mesh(GEOS.box(1.2, 0.7, 0.05), stdMat(0x1c4a3a), 0, 1.0, 0);
      const chalk = mesh(GEOS.box(0.06, 0.06, 0.06), stdMat(0xffffff), 0.2, 1.1, 0.04);
      const stand = mesh(GEOS.box(0.06, 0.7, 0.06), stdMat(0x5a5a6a), 0, 0.45, -0.15);
      g.add(board, chalk, stand);
      break;
    }
    case 'question': {
      const q = makeTextSprite('?', { size: 0.26, color: '#a855f7' });
      const base = mesh(GEOS.cyl(0.2, 0.2, 0.05, 10), stdMat(0x8a8a9a), 0, 0.1, 0);
      g.add(q, base);
      break;
    }
    case 'lesson': {
      const book = mesh(GEOS.box(0.4, 0.08, 0.32), stdMat(0xf0c0a0), 0, 0.2, 0);
      book.rotation.z = 0.1;
      const l1 = mesh(GEOS.box(0.3, 0.03, 0.02), stdMat(0x8a6a5a), 0, 0.24, 0.17);
      g.add(book, l1);
      break;
    }
    case 'ticket': {
      const t = mesh(GEOS.box(0.44, 0.05, 0.18), stdMat(0xf5f5f5), 0, 0.18, 0);
      const st = mesh(GEOS.box(0.4, 0.03, 0.02), stdMat(0x888888), 0, 0.2, 0.1);
      t.rotation.z = 0.15;
      g.add(t, st);
      break;
    }
    case 'gate': {
      const post1 = mesh(GEOS.box(0.15, 1.4, 0.15), stdMat(0x5a7a8a), -0.5, 0.7, 0);
      const post2 = mesh(GEOS.box(0.15, 1.4, 0.15), stdMat(0x5a7a8a), 0.5, 0.7, 0);
      const beam = mesh(GEOS.box(1.2, 0.12, 0.12), stdMat(0x5a7a8a), 0, 1.45, 0);
      const sign = mesh(GEOS.box(0.8, 0.4, 0.06), stdMat(0x0a8a9a), 0, 0.95, 0.02);
      const text = makeTextSprite('B4', { size: 0.13, color: '#ffffff' });
      text.position.set(0, 0.95, 0.06);
      g.add(post1, post2, beam, sign, text);
      break;
    }
    case 'passport': {
      const p = mesh(GEOS.box(0.3, 0.05, 0.4), stdMat(0x7a1a3a), 0, 0.2, 0);
      p.rotation.x = 0.3;
      const star = mesh(GEOS.box(0.08, 0.08, 0.02), stdMat(0xf5c842, { metalness: 0.5 }), 0, 0.24, 0.2);
      g.add(p, star);
      break;
    }
    case 'luggage': {
      const s = mesh(GEOS.box(0.5, 0.4, 0.28), stdMat(0x9a4a8a), 0, 0.24, 0);
      const handle = mesh(GEOS.box(0.24, 0.1, 0.05), stdMat(0x7a3a6a), 0, 0.48, 0);
      const strap = mesh(GEOS.box(0.52, 0.1, 0.02), stdMat(0xf5f5f5), 0, 0.24, 0.15);
      g.add(s, handle, strap);
      break;
    }
    case 'flight': {
      const b = mesh(GEOS.box(0.5, 0.05, 0.4), stdMat(0xbfe3ff), 0, 0.18, 0);
      b.rotation.x = 0.2;
      const plane = mesh(GEOS.box(0.3, 0.08, 0.08), stdMat(0x0a8a9a), 0, 0.32, 0);
      const wing = mesh(GEOS.box(0.36, 0.02, 0.2), stdMat(0x0a8a9a), 0, 0.36, 0);
      g.add(b, plane, wing);
      break;
    }
    case 'boarding': {
      const post = mesh(GEOS.box(0.08, 1, 0.08), stdMat(0x5a7a8a), 0, 0.5, 0);
      const board = mesh(GEOS.box(0.5, 0.3, 0.06), stdMat(0x0a6a7a), 0, 1.1, 0);
      const text = makeTextSprite('BOARD', { size: 0.06, color: '#9ad4ff' });
      text.position.set(0, 1.1, 0.05);
      g.add(post, board, text);
      break;
    }
    case 'plane': {
      const body = mesh(GEOS.box(0.5, 0.35, 1.6), stdMat(0xf0f5fa), 0, 0.4, 0);
      const nose = mesh(GEOS.cone(0.25, 0.4, 8), stdMat(0xf0f5fa), 0, 0.4, 0.95);
      nose.rotation.x = -Math.PI / 2;
      const wing = mesh(GEOS.box(1.8, 0.06, 0.5), stdMat(0x2a5a7a), 0, 0.42, 0);
      const tail = mesh(GEOS.box(0.12, 0.4, 0.3), stdMat(0x2a5a7a), 0, 0.6, -0.7);
      g.add(body, nose, wing, tail);
      break;
    }
    default: {
      g.add(mesh(GEOS.box(0.3, 0.3, 0.3), stdMat(0x8a8a9a), 0, 0.2, 0));
    }
  }

  g.userData.prop = true;
  return g;
}

/** Kichkina haykalcha — inson-tip predmetlar (waiter, teacher, ...). */
function buildSmallStatue(shirtColor) {
  const g = new THREE.Group();
  const skin = 0xf1c27d;
  const body = mesh(GEOS.box(0.22, 0.4, 0.16), stdMat(shirtColor), 0, 0.55, 0);
  const head = mesh(GEOS.box(0.2, 0.2, 0.18), stdMat(skin), 0, 0.88, 0);
  const base = mesh(GEOS.cyl(0.26, 0.3, 0.08, 10), stdMat(0x8a8a9a), 0, 0.05, 0);
  g.add(body, head, base);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHAHAR MANZARASI
// ═══════════════════════════════════════════════════════════════════════════
export function buildGround(w, d, color, opts = {}) {
  const mat = stdMat(color, { roughness: 1 });
  if (opts.texture) {
    const fns = { grass: grassTexture, dirt: dirtTexture, tile: tileTexture, concrete: concreteTexture };
    const fn = fns[opts.texture];
    if (fn) {
      mat.map = fn(color, opts.repeat || [Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(d / 14))]);
      mat.color.set(0xffffff);
      mat.userData.base = color;
    }
  }
  const g = new THREE.Mesh(GEOS.plane(w, d), mat);
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}

export function buildRoad(length, width, color = 0x3a3a4a) {
  const g = new THREE.Group();
  const mat = stdMat(color, { roughness: 1 });
  mat.map = roadTexture(color, [Math.max(1, Math.round(length / 40)), Math.max(1, Math.round(width / 6))]);
  mat.color.set(0xffffff);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    mat
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  g.add(road);

  // markaziy chiziq + yon chiziqlar — yo'l bo'ylab (uzun o'qi bo'ylab)
  const alongX = length >= width;
  const edgeOff = (alongX ? width : length) / 2 - 0.35;
  const lineLen = alongX ? length : width;

  const dash = new THREE.Mesh(
    new THREE.PlaneGeometry(alongX ? lineLen : 0.14, alongX ? 0.14 : lineLen),
    new THREE.MeshBasicMaterial({ color: 0xf5c842 })
  );
  dash.rotation.x = -Math.PI / 2;
  dash.position.y = 0.01;
  g.add(dash);

  for (const s of [1, -1]) {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(alongX ? lineLen : 0.1, alongX ? 0.1 : lineLen),
      new THREE.MeshBasicMaterial({ color: 0xe8e8dc })
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(alongX ? 0 : s * edgeOff, 0.012, alongX ? s * edgeOff : 0);
    g.add(edge);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASHINA — oddiy, realistik nisbatli avtomobil (traffic uchun)
// ═══════════════════════════════════════════════════════════════════════════
export function buildCar(color = 0xdd4444, opts = {}) {
  const g = new THREE.Group();
  const carMat = (colorValue, materialOpts = {}) =>
    stdMat(colorValue, { ...materialOpts, shared: true });
  const paint = carMat(color, { roughness: 0.28, metalness: 0.42 });
  const trim = carMat(0x20242a, { roughness: 0.58, metalness: 0.24 });
  const glass = sharedCarGlass;
  const body = mesh(GEOS.box(1.9, 0.42, 1.02), paint, 0, 0.53, 0);
  const chassis = mesh(GEOS.box(1.72, 0.16, 0.98), trim, 0, 0.31, 0);
  const hood = mesh(GEOS.box(0.64, 0.12, 0.92), paint, 0.58, 0.78, 0);
  const trunk = mesh(GEOS.box(0.42, 0.11, 0.9), paint, -0.72, 0.77, 0);
  const roof = mesh(GEOS.box(0.76, 0.12, 0.76), paint, -0.12, 1.28, 0);
  g.add(body, chassis, hood, trunk, roof);

  const sideWindowGeo = cachedGeometry('car-side-window', () => {
    const sideWindow = new THREE.Shape();
    sideWindow.moveTo(-0.57, 0.78);
    sideWindow.lineTo(-0.45, 1.18);
    sideWindow.lineTo(0.2, 1.18);
    sideWindow.lineTo(0.4, 0.78);
    sideWindow.closePath();
    return new THREE.ShapeGeometry(sideWindow);
  });
  for (const side of [-1, 1]) {
    const pane = mesh(sideWindowGeo, glass, 0, 0, side * 0.386);
    g.add(pane);
    for (const [x, y] of [[-0.55, 0.78], [-0.44, 1.18], [0.2, 1.18], [0.4, 0.78]]) {
      const pillar = mesh(GEOS.cyl(0.018, 0.022, Math.hypot(0.06, 0.4), 6), trim, x, (y + 0.78) / 2, side * 0.4);
      pillar.rotation.z = x < -0.5 ? -0.15 : 0.35;
      g.add(pillar);
    }
    const mirror = mesh(GEOS.box(0.13, 0.08, 0.11), trim, 0.48, 0.82, side * 0.55);
    g.add(mirror);
  }

  const windshield = mesh(GEOS.box(0.035, 0.34, 0.72), glass, 0.36, 0.99, 0);
  windshield.rotation.z = 0.28;
  const rearWindow = mesh(GEOS.box(0.035, 0.32, 0.68), glass, -0.54, 0.99, 0);
  rearWindow.rotation.z = -0.28;
  g.add(windshield, rearWindow);

  g.add(mesh(GEOS.box(0.045, 0.24, 1.04), trim, 0.98, 0.43, 0));
  g.add(mesh(GEOS.box(0.045, 0.22, 1.04), trim, -0.98, 0.43, 0));
  g.add(mesh(GEOS.box(0.025, 0.13, 0.34), carMat(0x343b42, { roughness: 0.5 }), 1.006, 0.48, 0));
  for (const side of [-1, 1]) {
    const headlight = mesh(GEOS.box(0.045, 0.12, 0.22),
      carMat(0xfff4cf, { emissive: 0xffe6a1, emissiveIntensity: 0.48, roughness: 0.24 }),
      0.987, 0.58, side * 0.32);
    const tailLight = mesh(GEOS.box(0.045, 0.1, 0.2),
      carMat(0xe53b35, { emissive: 0x9d1715, emissiveIntensity: 0.35 }),
      -0.987, 0.57, side * 0.33);
    const handle = mesh(GEOS.box(0.035, 0.035, 0.12), trim, -0.04, 0.66, side * 0.516);
    g.add(headlight, tailLight, handle);
  }

  for (const [px, pz] of [[0.62, 0.53], [0.62, -0.53], [-0.62, 0.53], [-0.62, -0.53]]) {
    const wheel = new THREE.Group();
    wheel.position.set(px, 0.235, pz);
    const tire = new THREE.Mesh(
      cachedGeometry('car-tire', () => new THREE.CylinderGeometry(0.235, 0.235, 0.16, 20, 1)), trim
    );
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    tire.receiveShadow = true;
    wheel.add(tire);
    const hub = new THREE.Mesh(
      cachedGeometry('car-hub', () => new THREE.CylinderGeometry(0.105, 0.105, 0.17, 12)),
      carMat(0xb7bdc3, { metalness: 0.78, roughness: 0.28 })
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.z = Math.sign(pz) * 0.012;
    wheel.add(hub);
    for (let spoke = 0; spoke < 5; spoke++) {
      const angle = (spoke / 5) * Math.PI * 2;
      const detail = mesh(GEOS.box(0.025, 0.105, 0.018), carMat(0x737b82, { metalness: 0.72 }), 0, 0, 0);
      detail.position.set(Math.sin(angle) * 0.06, Math.cos(angle) * 0.06, Math.sign(pz) * 0.105);
      detail.rotation.z = -angle;
      wheel.add(detail);
    }
    wheel.userData.wheel = true;
    g.add(wheel);
  }

  g.userData.bounds = { halfW: 1.1, halfD: 0.62 };
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildTree(opts = {}) {
  const g = new THREE.Group();
  g.userData.isTree = true;
  g.userData.windPhase = Math.random() * Math.PI * 2;
  g.userData.windStrength = 0.008 + Math.random() * 0.007;
  const r = opts.r || 0.9;
  const trunkH = r * 1.9;
  const trunkMat = stdMat(0x6a4a2a, { roughness: 1 });
  const trunk = mesh(GEOS.cyl(r * 0.12, r * 0.21, trunkH, 9), trunkMat, 0, trunkH / 2, 0);
  trunk.rotation.z = (Math.random() - 0.5) * 0.1;
  const base = new THREE.Color(opts.color || 0x2f9e4f)
    .offsetHSL((Math.random() - 0.5) * 0.035, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.07);
  const dark = opts.color2 || 0x2a8a46;
  const leafMats = [
    stdMat(base, { roughness: 1 }),
    stdMat(dark, { roughness: 1 }),
    stdMat(base.clone().multiplyScalar(1.12), { roughness: 1 })
  ];
  const crownY = trunkH + r * 1.18;
  const branches = [
    { start: [0, trunkH * 0.58, 0], end: [r * 0.62, crownY - r * 0.15, r * 0.12] },
    { start: [0, trunkH * 0.7, 0], end: [-r * 0.55, crownY + r * 0.05, -r * 0.1] },
    { start: [0, trunkH * 0.8, 0], end: [r * 0.08, crownY + r * 0.48, -r * 0.38] }
  ];
  const canopy = new THREE.Group();
  canopy.position.y = trunkH;
  for (const branch of branches) {
    const from = new THREE.Vector3(...branch.start);
    const to = new THREE.Vector3(...branch.end);
    const direction = to.clone().sub(from);
    const limb = mesh(GEOS.cyl(r * 0.055, r * 0.085, direction.length(), 7), trunkMat);
    limb.position.copy(from.add(to).multiplyScalar(0.5));
    limb.position.y -= trunkH;
    limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    canopy.add(limb);
  }

  const clusters = [
    [0, 0.62, 0, 0.72],
    [0.58, 0.88, 0.12, 0.56],
    [-0.58, 0.88, -0.12, 0.57],
    [0.08, 1.26, 0.52, 0.54],
    [-0.08, 1.25, -0.54, 0.55],
    [0.08, 1.58, -0.08, 0.53],
    [0.46, 1.12, -0.4, 0.43],
    [-0.46, 1.1, 0.4, 0.45]
  ];
  const leafGeo = GEOS.sphere(1, 12);
  const foliage = leafMats.map((material, materialIndex) => {
    const count = clusters.filter((_, index) => index % leafMats.length === materialIndex).length;
    const instances = new THREE.InstancedMesh(leafGeo, material, count);
    instances.castShadow = true;
    instances.receiveShadow = true;
    canopy.add(instances);
    return instances;
  });
  const leafSlots = new Array(leafMats.length).fill(0);
  const leafTransform = new THREE.Object3D();
  clusters.forEach(([x, y, z, size], index) => {
    leafTransform.position.set(r * x, crownY + r * (y - 0.62) - trunkH, r * z);
    const variation = 0.88 + Math.random() * 0.24;
    leafTransform.scale.set(variation * 1.05, 0.82 + Math.random() * 0.24, variation);
    leafTransform.rotation.set(Math.random() * 0.16, Math.random() * Math.PI, Math.random() * 0.16);
    leafTransform.updateMatrix();
    const materialIndex = index % leafMats.length;
    foliage[materialIndex].setMatrixAt(leafSlots[materialIndex]++, leafTransform.matrix);
  });
  foliage.forEach(instances => { instances.instanceMatrix.needsUpdate = true; });
  g.add(trunk, canopy);
  g.userData.canopy = canopy;
  return g;
}

export function buildFlower(opts = {}) {
  const g = new THREE.Group();
  const stem = mesh(GEOS.cyl(0.02, 0.025, 0.35, 6), stdMat(0x2f9e4f, { roughness: 1 }), 0, 0.175, 0);
  const head = mesh(GEOS.sphere(0.07, 8), stdMat(opts.color || 0xff6b9d, { roughness: 0.8 }), 0, 0.38, 0);
  head.scale.set(1, 0.8, 1);
  const center = mesh(GEOS.sphere(0.035, 6), stdMat(0xf5c842, { roughness: 0.9 }), 0, 0.38, 0.03);
  g.add(stem, head, center);
  return g;
}

export function buildBush(opts = {}) {
  const g = new THREE.Group();
  const r = opts.r || 0.5;
  const c1 = mesh(GEOS.sphere(r, 8), stdMat(opts.color || 0x2f9e4f, { roughness: 1 }), 0, r * 0.7, 0);
  c1.scale.set(1.25, 0.85, 1.1);
  const c2 = mesh(GEOS.sphere(r * 0.7, 8), stdMat(opts.color2 || 0x38b05f, { roughness: 1 }), r * 0.45, r * 0.55, r * 0.2);
  c2.scale.set(1.1, 0.8, 1.1);
  const c3 = mesh(GEOS.sphere(r * 0.55, 8), stdMat(opts.color3 || 0x2f9e4f, { roughness: 1 }), -r * 0.4, r * 0.45, -r * 0.3);
  g.add(c1, c2, c3);
  return g;
}

export function buildLamp(opts = {}) {
  const g = new THREE.Group();
  const lightC = opts.color || 0xffe08a;
  const post = mesh(GEOS.cyl(0.06, 0.08, 2.6, 8), stdMat(0x3a3a4a, { metalness: 0.4 }), 0, 1.3, 0);
  const head = mesh(GEOS.box(0.3, 0.12, 0.2), stdMat(0x2a2a3a), 0, 2.7, 0);
  const light = mesh(GEOS.box(0.2, 0.06, 0.1), stdMat(lightC, { emissive: lightC, emissiveIntensity: 0.8 }), 0, 2.6, 0);
  g.add(post, head, light);
  g.userData.isLamp = true;
  light.userData.lampGlow = true;
  return g;
}

export function buildBench() {
  const g = new THREE.Group();
  const seat = mesh(GEOS.box(1, 0.08, 0.36), stdMat(0x8a6a4a), 0, 0.45, 0);
  const back = mesh(GEOS.box(1, 0.4, 0.06), stdMat(0x8a6a4a), 0, 0.72, -0.16);
  for (const px of [-0.4, 0.4]) {
    g.add(mesh(GEOS.box(0.08, 0.4, 0.08), stdMat(0x6a5a3a), px, 0.2, 0));
  }
  g.add(seat, back);
  return g;
}

export function buildFenceSection(w) {
  const g = new THREE.Group();
  const mat = stdMat(0x7a8a7a);
  for (let i = 0; i * 0.5 < w; i++) {
    g.add(mesh(GEOS.box(0.06, 0.7, 0.06), mat, -w / 2 + 0.25 + i * 0.5, 0.35, 0));
  }
  g.add(mesh(GEOS.box(w, 0.06, 0.06), mat, 0, 0.6, 0));
  return g;
}

export default {
  stdMat, buildAvatar, buildNPC, buildBuilding, buildProp,
  buildGround, buildRoad, buildTree, buildBush, buildFlower, buildLamp, buildBench, buildFenceSection,
  buildCar,
  makeTextSprite
};
