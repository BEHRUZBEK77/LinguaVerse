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
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.02,
    flatShading: opts.flat ?? true
  });
  if (opts.emissive != null) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  m.userData.base = color;
  return m;
}

export function glowMat(color) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true
  });
}

const GEOS = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg),
  sphere: (r, seg = 12) => new THREE.SphereGeometry(r, seg, 10),
  cone: (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg),
  plane: (w, d) => new THREE.PlaneGeometry(w, d)
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
// AVATAR — realistik nisbatli, chiroyli low-poly qahramon
// Animatsiya qismlari: armL, armR, legL, legR, torso, head, group
// ═══════════════════════════════════════════════════════════════════════════
export function buildAvatar(opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.Color(opts.skin || 0xf1c27d);
  const shirt = new THREE.Color(opts.shirt || 0x4f6ef7);
  const pants = new THREE.Color(opts.pants || 0x2a3350);
  const shoe = new THREE.Color(opts.shoe || 0x23283a);
  const hairC = new THREE.Color(opts.hair || 0x3a2a1a);
  const jacket = opts.jacket ? new THREE.Color(opts.jacket) : null;

  const parts = {};

  // ── Oyoqlar (son + boldir + oyoq, kestirma bo'g'inda) ──
  parts.legL = pivotLeg(-0.1, skin, shoe, pants);
  parts.legR = pivotLeg(0.1, skin, shoe, pants);
  g.add(parts.legL.pivot, parts.legR.pivot);

  // ── Tana (dumba + ko'krak + yelkalar) ──
  parts.torso = new THREE.Group();
  parts.torso.position.set(0, 0.9, 0);
  const hip = mesh(GEOS.box(0.34, 0.22, 0.22), stdMat(pants), 0, -0.18, 0);
  const chest = mesh(GEOS.box(0.42, 0.44, 0.27), stdMat(jacket || shirt), 0, 0.08, 0);
  // yelkalar — qo'llar bo'g'ini uchun yumaloq protuberant
  for (const sx of [-0.21, 0.21]) {
    parts.torso.add(mesh(GEOS.sphere(0.13, 10), stdMat(jacket || shirt), sx, 0.24, 0));
  }
  // ko'krak belgisi / yoqa
  const collar = mesh(GEOS.box(0.1, 0.06, 0.02), stdMat(0xffffff, { metalness: 0.4 }), 0, 0.3, 0.14);
  parts.torso.add(hip, chest, collar);
  g.add(parts.torso);

  // ── Qo'llar (yelka + bilak + kaft) ──
  parts.armL = pivotArm(-0.27, skin, jacket || shirt);
  parts.armR = pivotArm(0.27, skin, jacket || shirt);
  g.add(parts.armL.pivot, parts.armR.pivot);

  // ── Bosh (bo'yin + kalla + soch + yuz) ──
  parts.head = new THREE.Group();
  parts.head.position.set(0, 1.48, 0);
  const neck = mesh(GEOS.cyl(0.06, 0.08, 0.18, 8), stdMat(skin), 0, -0.2, 0);
  const skull = mesh(GEOS.sphere(0.155, 14), stdMat(skin), 0, 0, 0);
  skull.scale.y = 1.12;
  // soch — boshning yuqori qismi (uslubga qarab)
  const hairStyle = opts.hairStyle || 'short';
  const hair = mesh(GEOS.sphere(0.16, 12), stdMat(hairC), 0, 0.06, -0.01);
  if (hairStyle === 'long') {
    hair.scale.set(1.02, 0.68, 1.08);
    hair.position.y = 0.02;
    // yon sochlar
    for (const sx of [-0.155, 0.155]) {
      parts.head.add(mesh(GEOS.box(0.05, 0.22, 0.12), stdMat(hairC), sx, -0.06, -0.02));
    }
  } else if (hairStyle === 'curly') {
    hair.scale.set(1.08, 0.6, 1.1);
    hair.position.y = 0.04;
  } else {
    hair.scale.set(1, 0.55, 1.06);
  }
  // quloqlar
  for (const sx of [-1, 1]) {
    parts.head.add(mesh(GEOS.sphere(0.035, 8), stdMat(skin), sx * 0.15, 0, 0));
  }
  // ko'zlar + qoshlar
  for (const sx of [-1, 1]) {
    const eye = mesh(GEOS.sphere(0.032, 8), stdMat(0xffffff), sx * 0.06, 0.045, 0.14);
    const pupil = mesh(GEOS.sphere(0.016, 8), stdMat(0x1c2333), sx * 0.06, 0.045, 0.162);
    const brow = mesh(GEOS.box(0.06, 0.014, 0.02), stdMat(hairC), sx * 0.06, 0.09, 0.145);
    parts.head.add(eye, pupil, brow);
  }
  // burun + og'iz (tabassum)
  const nose = mesh(GEOS.box(0.03, 0.05, 0.03), stdMat(skin), 0, -0.01, 0.15);
  const mouth = mesh(GEOS.box(0.09, 0.02, 0.02), stdMat(0x9a4a3a), 0, -0.09, 0.145);
  const face = [neck, skull, hair, nose, mouth];
  if (opts.beard) {
    const beard = mesh(GEOS.sphere(0.105, 10), stdMat(hairC), 0, -0.1, 0.1);
    beard.scale.set(1.15, 0.85, 1.05);
    face.push(beard);
  }
  parts.head.add(...face);
  g.add(parts.head);

  g.userData.parts = parts;
  g.traverse(o => { o.userData.avatarPart = true; });
  return g;
}

function pivotLeg(x, skin, shoe, pants) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.92, 0);
  const thigh = mesh(GEOS.box(0.17, 0.34, 0.19), stdMat(pants), 0, -0.22, 0);
  const shin = mesh(GEOS.box(0.15, 0.34, 0.17), stdMat(pants), 0, -0.56, 0);
  const foot = mesh(GEOS.box(0.16, 0.11, 0.27), stdMat(shoe), 0, -0.79, 0.04);
  pivot.add(thigh, shin, foot);
  return { pivot, mesh: thigh };
}

function pivotArm(x, skin, shirt) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 1.24, 0);
  const upper = mesh(GEOS.box(0.14, 0.34, 0.16), stdMat(shirt), 0, -0.2, 0);
  const hand = mesh(GEOS.sphere(0.075, 8), stdMat(skin), 0, -0.45, 0);
  pivot.add(upper, hand);
  return { pivot, mesh: upper };
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

  // Devor materiali — turiga qarab teksturali
  function wallMat(kind, hex, ww, hh) {
    const fns = { brick: brickTexture, plaster: plasterTexture, concrete: concreteTexture };
    const mat = stdMat(hex, { roughness: 0.95 });
    mat.map = fns[kind](hex, [Math.max(1, Math.round(ww / 5)), Math.max(1, Math.round(hh / 3))]);
    mat.color.set(0xffffff);
    mat.userData.base = hex;
    return mat;
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
      // shisha qatorlar
      for (let i = 0; i < 3; i++) {
        const yy = 1.6 + i * 1.5;
        const win = mesh(GEOS.box(w - 1, 0.9, 0.1), stdMat(0x9ad4ff, { roughness: 0.25 }), 0, yy, d / 2 + 0.06);
        g.add(win);
      }
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
      const roof = mesh(GEOS.cone(Math.max(w, d) * 0.9, 2.4, 4), stdMat(0x8a5a3a), 0, h + 1.2, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(wall, roof);
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
  const bodyC = new THREE.Color(color);
  const dark = stdMat(0x1c1f2a, { roughness: 0.5, metalness: 0.3 });

  // kuzov
  const body = mesh(GEOS.box(1.9, 0.46, 1.0), stdMat(bodyC, { roughness: 0.35, metalness: 0.25 }), 0, 0.55, 0);
  // salon / kabina
  const cabin = mesh(GEOS.box(0.95, 0.4, 0.88), stdMat(bodyC, { roughness: 0.3, metalness: 0.3 }), -0.12, 0.95, 0);
  const glass = mesh(GEOS.box(0.9, 0.34, 0.8), stdMat(0x233043, { roughness: 0.1, metalness: 0.5 }), -0.12, 0.95, 0.02);
  // bamperlar
  g.add(mesh(GEOS.box(0.06, 0.3, 0.94), dark, 0.95, 0.42, 0));
  g.add(mesh(GEOS.box(0.06, 0.3, 0.94), dark, -0.95, 0.42, 0));
  // faralar
  for (const sx of [-0.3, 0.3]) {
    g.add(mesh(GEOS.box(0.03, 0.1, 0.18), stdMat(0xfff4c0, { emissive: 0xfff2a8, emissiveIntensity: 0.9 }), 0.96, 0.55, sx));
  }
  // orqa chiroqlar
  for (const sx of [-0.3, 0.3]) {
    g.add(mesh(GEOS.box(0.03, 0.08, 0.16), stdMat(0xff3030, { emissive: 0xff2020, emissiveIntensity: 0.7 }), -0.96, 0.55, sx));
  }
  // g'ildiraklar
  for (const [px, pz] of [[0.55, 0.55], [0.55, -0.55], [-0.55, 0.55], [-0.55, -0.55]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(px, 0.3, pz);
    wheel.castShadow = true;
    wheel.userData.wheel = true;
    g.add(wheel);
  }

  g.userData.bounds = { halfW: 1.1, halfD: 0.62 };
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildTree(opts = {}) {
  const g = new THREE.Group();
  const r = opts.r || 0.9;
  const trunkH = r * 1.4;
  const trunk = mesh(GEOS.cyl(r * 0.16, r * 0.22, trunkH, 7), stdMat(0x6a4a2a, { roughness: 1 }), 0, trunkH / 2, 0);
  trunk.rotation.z = (Math.random() - 0.5) * 0.06;
  const base = opts.color || 0x2f9e4f;
  const dark = opts.color2 || 0x2a8a46;
  const c1 = mesh(GEOS.sphere(r, 9), stdMat(base, { roughness: 1 }), 0, trunkH + r * 0.75, 0);
  c1.scale.set(1.15, 1, 1.15);
  const c2 = mesh(GEOS.sphere(r * 0.72, 9), stdMat(dark, { roughness: 1 }), r * 0.25, trunkH + r * 1.15, r * 0.1);
  c2.scale.set(1.1, 0.95, 1.1);
  const c3 = mesh(GEOS.sphere(r * 0.55, 8), stdMat(base, { roughness: 1 }), -r * 0.3, trunkH + r * 1.55, -r * 0.2);
  g.add(trunk, c1, c2, c3);
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
