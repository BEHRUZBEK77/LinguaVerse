// ═══════════════════════════════════════════════════════════════════════════
// NPC.js — NPC xatti-harakati: sayr qilish, kutish, suhbat holati, "!" belgisi
//
// Har bir NPC o'z zonasi ichida, uy nuqtasi atrofida sekin sayr qiladi.
// O'yinchi yaqinlashganda to'xtab, unga qarab turadi va "!" belgisi chiqadi.
// ═══════════════════════════════════════════════════════════════════════════
import { WORLD } from '../config.js';

const WANDER_RADIUS = 3.5;          // uy nuqtasi atrofida yurish radiusi
const ROAD_HALF = WORLD.roadWidth / 2;
const V_ROADS = [60, -60];          // vertikal yo'llar markazlari
const WALK_SPEED = 0.85;

function rand(a, b) { return a + Math.random() * (b - a); }

/** Yo'ldan tashqarida yurish mumkin bo'lgan nuqtami? */
function walkable(x, z) {
  if (Math.abs(z) < ROAD_HALF + 0.9) return false;
  for (const vx of V_ROADS) {
    if (Math.abs(Math.abs(x) - vx) < ROAD_HALF + 0.9) return false;
  }
  return true;
}

export class NPC {
  constructor(def, group) {
    this.def = def;
    this.group = group;
    this.parts = group.userData.parts;
    this.badge = group.userData.badge;
    this.homeX = def.pos.x;
    this.homeZ = def.pos.z;
    this.position = { x: this.homeX, z: this.homeZ };
    this.attentionDist = 3.0;          // "!" paydo bo'ladigan masofa
    this.talking = false;
    this.state = 'idle';
    this.stateTimer = rand(1.2, 3.5);
    this.target = { x: this.homeX, z: this.homeZ };
    this._faceYaw = Math.PI;           // oxirgi yurish yo'nalishi
    this._animTime = Math.random() * 10;
    this._phase = Math.random() * Math.PI * 2;
    this._walkPhase = Math.random() * 10;
    this.baseYaw = Math.PI;            // janubga qaragan
    this.group.position.set(this.position.x, 0, this.position.z);
    this.group.rotation.y = this.baseYaw;
  }

  _pickTarget() {
    for (let i = 0; i < 10; i++) {
      const x = this.homeX + rand(-WANDER_RADIUS, WANDER_RADIUS);
      const z = this.homeZ + rand(-WANDER_RADIUS, WANDER_RADIUS);
      if (walkable(x, z)) return { x, z };
    }
    return { x: this.homeX, z: this.homeZ };
  }

  update(dt, playerPos) {
    this._animTime += dt;
    const parts = this.parts;

    // ── Sayr / kutish holatlari ──
    if (!this.talking) {
      this.stateTimer -= dt;
      if (this.state === 'idle' && this.stateTimer <= 0) {
        this.target = this._pickTarget();
        this.state = 'walk';
        this.stateTimer = rand(3, 8);
      } else if (this.state === 'walk') {
        const dx = this.target.x - this.position.x;
        const dz = this.target.z - this.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25 || this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = rand(1.5, 4.5);
        } else {
          const step = WALK_SPEED * dt;
          this.position.x += (dx / dist) * step;
          this.position.z += (dz / dist) * step;
          this.group.position.set(this.position.x, 0, this.position.z);
          this._faceYaw = Math.atan2(dx, dz);
          this._walkPhase += dt * 5.5;
        }
      }
    }

    const walking = this.state === 'walk' && !this.talking;

    // ── Animatsiya ──
    const breath = Math.sin(this._animTime * 1.6 + this._phase) * 0.014;
    const swing = Math.sin(this._walkPhase);
    const swing2 = Math.sin(this._walkPhase + Math.PI);

    parts.torso.position.y = 0.9 + breath + (walking ? Math.abs(swing) * 0.02 : 0);
    parts.head.position.y = 1.48 + breath * 0.8;
    parts.legL.pivot.rotation.x = walking ? swing * 0.5 : 0;
    parts.legR.pivot.rotation.x = walking ? swing2 * 0.5 : 0;
    parts.armL.pivot.rotation.x = walking ? swing2 * 0.6 : Math.sin(this._animTime * 0.8 + this._phase) * 0.06;
    parts.armR.pivot.rotation.x = walking ? swing * 0.6 : Math.sin(this._animTime * 0.8 + this._phase + Math.PI) * 0.06;

    // Suhbatda gapirganda bosh silkitish
    if (this.talking) {
      parts.head.rotation.z = Math.sin(this._animTime * 9) * 0.1;
      parts.torso.position.y = 0.9 + breath + Math.sin(this._animTime * 6) * 0.012;
    } else {
      parts.head.rotation.z = 0;
    }

    // ── O'yinchiga yaqin bo'lsa — "!" belgisi va qarab turish ──
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const near = dist < WORLD.npcInteractDist + 0.6;
    if (this.badge) this.badge.visible = near && !this.talking && !walking;

    let faceYaw = null;
    if (this.talking) {
      faceYaw = Math.atan2(dx, dz);
    } else if (walking) {
      faceYaw = this._faceYaw;
    } else if (dist < 8) {
      faceYaw = Math.atan2(dx, dz);
    }

    if (faceYaw !== null) {
      this.group.rotation.y = lerpAngle(this.group.rotation.y, faceYaw, 0.12);
    } else {
      this.group.rotation.y = lerpAngle(this.group.rotation.y, this.baseYaw, 0.05);
    }
  }

  /** Suhbat rejimi — sayrni to'xtatadi. */
  setTalking(talking) {
    this.talking = talking;
    if (this.badge) this.badge.visible = false;
    if (talking) this.state = 'idle';
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
