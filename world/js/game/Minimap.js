// ═══════════════════════════════════════════════════════════════════════════
// Minimap.js — kichik 2D xarita (canvas)
// ═══════════════════════════════════════════════════════════════════════════
import { WORLD, ZONES } from '../config.js';

const W = 150;
const H = 100;
const PAD = 10;
const AX = (W - PAD * 2) / (WORLD.size.x * 2);   // piksel/unit
const AZ = (H - PAD * 2) / (WORLD.size.z * 2);

function px(x) { return PAD + (x + WORLD.size.x) * AX; }
function pz(z) { return PAD + (z + WORLD.size.z) * AZ; }

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._t = 0;
  }

  update(dt, playerPos, currentZone) {
    this._t += dt;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // Fon
    ctx.fillStyle = 'rgba(13,18,34,.55)';
    ctx.fillRect(0, 0, W, H);

    // Zonalar
    const half = WORLD.districtHalf;
    for (const z of ZONES) {
      const x0 = px(z.center.x - half), y0 = pz(z.center.z - half);
      const w = half * 2 * AX, h = half * 2 * AZ;
      const isCur = currentZone && currentZone.id === z.id;

      ctx.fillStyle = isCur ? z.theme : this._alpha(z.theme, .35);
      ctx.fillRect(x0, y0, w, h);

      if (isCur) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0, y0, w, h);
      }

      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(z.nameUz, x0 + w / 2, y0 + h / 2);
    }

    // Yo'llar (z=0 va x=±60)
    ctx.fillStyle = 'rgba(120,120,140,.5)';
    const rw = WORLD.roadWidth / 2;
    ctx.fillRect(px(-WORLD.size.x), pz(-rw), WORLD.size.x * 2 * AX, rw * 2 * AZ);
    ctx.fillRect(px(-60 - rw), pz(-WORLD.size.z), rw * 2 * AX, WORLD.size.z * 2 * AZ);
    ctx.fillRect(px(60 - rw), pz(-WORLD.size.z), rw * 2 * AX, WORLD.size.z * 2 * AZ);

    // Markaz favvora
    ctx.fillStyle = 'rgba(90,170,220,.6)';
    ctx.beginPath();
    ctx.arc(px(0), pz(0), 3, 0, Math.PI * 2);
    ctx.fill();

    // O'yinchi
    const pxp = px(playerPos.x), pzp = pz(playerPos.z);
    const pulse = 3 + Math.sin(this._t * 4) * 0.6;

    ctx.fillStyle = 'rgba(79,110,247,.35)';
    ctx.beginPath();
    ctx.arc(pxp, pzp, pulse + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4f6ef7';
    ctx.beginPath();
    ctx.arc(pxp, pzp, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pxp, pzp, 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  _alpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
}
