// ═══════════════════════════════════════════════════════════════════════════
// Physics.js — sodda AABB kolliziya tizimi
//
// Tashqi physics kutubxonasiga ehtiyoj yo'q: shahar to'rtburchakli binolar,
// devorlar va chegaralardan iborat. Doira (o'yinchi) ↔ to'rtburchak urilishini
// o'zimiz hal qilamiz — tez va ishonchli.
// ═══════════════════════════════════════════════════════════════════════════
export class PhysicsWorld {
  constructor() {
    this.boxes = [];       // { x0, z0, x1, z1 } — yer ustidagi to'siqlar
    this.triggers = [];    // { x0, z0, x1, z1, onEnter, onExit, data }
  }

  /**
   * To'rtburchak to'siq qo'shadi. (x,z) markaz, w,d kenglik/chuqurlik.
   * yHeight hisobga olinmaydi — doira yerdan hech qachon ko'tarilmaydi.
   */
  addBox(cx, cz, w, d) {
    this.boxes.push({
      x0: cx - w / 2, x1: cx + w / 2,
      z0: cz - d / 2, z1: cz + d / 2
    });
  }

  /** Trigger zona qo'shadi. */
  addTrigger(cx, cz, w, d, data, onEnter, onExit) {
    this.triggers.push({
      x0: cx - w / 2, x1: cx + w / 2,
      z0: cz - d / 2, z1: cz + d / 2,
      onEnter, onExit, data,
      inside: false
    });
  }

  clear() { this.boxes.length = 0; this.triggers.length = 0; }

  /**
   * Doirani to'siqlardan chiqaradi (pozitsiyani tuzatadi).
   * @returns {boolean} biror narsaga urildimi
   */
  moveCircle(pos, radius) {
    let hit = false;
    for (const b of this.boxes) {
      // Doira-markaz bilan to'rtburchak orasidagi eng yaqin nuqta
      const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
      const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;

      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          // Markaz to'rtburchak ichida — eng yaqin tomondan chiqaramiz
          const left = pos.x - b.x0, right = b.x1 - pos.x;
          const top = pos.z - b.z0, bottom = b.z1 - pos.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = b.x0 - radius;
          else if (m === right) pos.x = b.x1 + radius;
          else if (m === top) pos.z = b.z0 - radius;
          else pos.z = b.z1 + radius;
        }
      }
    }
    return hit;
  }

  /**
   * Trigerni tekshiradi. Holat o'zgarsa onEnter/onExit chaqiradi.
   */
  checkTriggers(pos, radius = 0.4) {
    for (const t of this.triggers) {
      const inside = pos.x > t.x0 && pos.x < t.x1 && pos.z > t.z0 && pos.z < t.z1;
      if (inside && !t.inside) {
        t.inside = true;
        if (t.onEnter) t.onEnter(t.data);
      } else if (!inside && t.inside) {
        t.inside = false;
        if (t.onExit) t.onExit(t.data);
      }
    }
  }
}
