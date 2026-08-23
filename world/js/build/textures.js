// ═══════════════════════════════════════════════════════════════════════════
// textures.js — PROTSEDURAL TEKSTURALAR (CanvasTexture)
//
// Tashqi rasm fayllariga bog'liq bo'lmaslik uchun barcha teksturalar kod
// orqali yaratiladi. Shahar endi tekis ranglar o'rniga realistik qoplamalarga
// ega bo'ladi, ammo loyiha to'liq oflayn qoladi.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

function hexRgb(hex) {
  return [hex >> 16 & 255, hex >> 8 & 255, hex & 255];
}

/** Yumshoq don — barcha teksturalar uchun asos. */
function grain(ctx, w, h, base, amp) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    img.data[i]     = base[0] + n;
    img.data[i + 1] = base[1] + n;
    img.data[i + 2] = base[2] + n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Maysa — mayda o't tiglari va don. */
export function grassTexture(hex = 0x3a7d3a, repeat = [8, 8]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  grain(ctx, w, h, hexRgb(hex), 26);
  ctx.strokeStyle = 'rgba(16, 52, 16, 0.55)';
  for (let i = 0; i < 700; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h + (Math.random() * 5 + 2));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120, 175, 90, 0.4)';
  for (let i = 0; i < 240; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h + (Math.random() * 4 + 1));
    ctx.stroke();
  }
  return toTexture(c, repeat);
}

/** Tuproq — zona yer qoplamasi uchun. */
export function dirtTexture(hex = 0x8a7a4a, repeat = [6, 6]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexRgb(hex);
  grain(ctx, w, h, [r, g, b], 30);
  // mayda toshlar
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const rr = Math.random() * 3 + 1;
    ctx.fillStyle = `rgba(${(r - 50) | 0}, ${(g - 40) | 0}, ${(b - 30) | 0}, 0.55)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, repeat);
}

/** Asfalt — yo'llar uchun. */
export function roadTexture(hex = 0x3a3f4d, repeat = [16, 3]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexRgb(hex);
  grain(ctx, w, h, [r, g, b], 16);
  // yoriqlar va dog'lar
  ctx.strokeStyle = 'rgba(20, 24, 34, 0.5)';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, Math.random() * 4 + 2, Math.random() * 2 + 1, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, repeat);
}

/** Yulka toshlari (pavers) — trotuar va maydon uchun. */
export function tileTexture(hex = 0x6a6a6a, repeat = [10, 10]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexRgb(hex);
  grain(ctx, w, h, [r, g, b], 22);
  // plitalar orasidagi choklar
  const cells = 8;
  const cell = w / cells;
  ctx.strokeStyle = 'rgba(30, 30, 40, 0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    const off = i * cell + (i % 2 ? cell * 0.5 : 0);
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(w, i * cell);
    ctx.stroke();
  }
  // har bir plitaga mayda tus o'zgarishi
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      ctx.fillStyle = `rgba(${(r - 25) | 0}, ${(g - 25) | 0}, ${(b - 25) | 0}, ${Math.random() * 0.12})`;
      ctx.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
    }
  }
  return toTexture(c, repeat);
}

/** G'isht — uylar va do'konlar uchun. */
export function brickTexture(hex = 0xa05538, repeat = [3, 2]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexRgb(hex);
  const rows = 8;
  const rowH = h / rows;
  const bricks = 4;
  const bw = w / bricks;
  for (let i = 0; i < rows; i++) {
    const off = (i % 2) * bw * 0.5;
    for (let j = -1; j < bricks; j++) {
      const shade = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgb(${(r * shade) | 0}, ${(g * shade) | 0}, ${(b * shade) | 0})`;
      ctx.fillRect(j * bw + off + 1, i * rowH + 1, bw - 2, rowH - 2);
    }
  }
  // g'isht o'rtasidagi ohak choklari
  ctx.fillStyle = 'rgba(210, 190, 160, 0.9)';
  for (let i = 0; i <= rows; i++) {
    ctx.fillRect(0, i * rowH - 1, w, 2);
  }
  for (let i = 0; i < rows; i++) {
    const off = (i % 2) * bw * 0.5;
    for (let x = off; x < w + bw; x += bw) {
      ctx.fillRect(x - 1, i * rowH, 2, rowH);
    }
  }
  grain(ctx, w, h, [r, g, b], 6);
  return toTexture(c, repeat);
}

/** Shiva (gips) — ofis va jamoat binolari uchun. */
export function plasterTexture(hex = 0xcfd8e8, repeat = [2, 2]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexRgb(hex);
  grain(ctx, w, h, [r, g, b], 18);
  // nozik gorizontal chiziqlar
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * h);
    ctx.lineTo(w, Math.random() * h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, 0);
    ctx.lineTo(Math.random() * w, h);
    ctx.stroke();
  }
  return toTexture(c, repeat);
}

/** Beton — minoralar va terminałlar uchun. */
export function concreteTexture(hex = 0x8a8a9a, repeat = [2, 2]) {
  const w = 256, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const [r, g, b] = hexRgb(hex);
  grain(ctx, w, h, [r, g, b], 14);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, Math.random() * 10 + 3, Math.random() * 6 + 2, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // panellar choklari
  ctx.strokeStyle = 'rgba(40, 44, 56, 0.4)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * w / 4, 0);
    ctx.lineTo(i * w / 4, h);
    ctx.stroke();
  }
  return toTexture(c, repeat);
}

export default { grassTexture, dirtTexture, roadTexture, tileTexture, brickTexture, plasterTexture, concreteTexture };
