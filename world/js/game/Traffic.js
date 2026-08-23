// ═══════════════════════════════════════════════════════════════════════════
// Traffic.js — shahar transporti va piyodalar
//
// Mashinalar yo'llar bo'ylab (gorizontal z=0 va vertikal x=±60) harakatlanadi,
// piyodalar trotuar/zona ichida sayr qiladi. Faqat ko'rinish uchun — fizika
// to'qnashuvi o'yinchi avtomobillarga urilganda ta'sir qilmaydi.
// ═══════════════════════════════════════════════════════════════════════════
import { WORLD } from '../config.js';
import { buildCar, buildAvatar } from '../build/Models.js';

const ROAD_HALF = WORLD.roadWidth / 2;                 // 8
const H_LEN = 176;                                     // gorizontal yo'l uzunligi (x bo'ylab)
const V_LEN = 112;                                     // vertikal yo'l uzunligi (z bo'ylab)
const LANE = ROAD_HALF * 0.8;                          // yo'l chetiga yaqin qator
const H_BOUND = 160;                                   // devorlardan oldin qaytish
const V_BOUND = 106;

const CAR_COLORS = [
  0xdd4444, 0x4477dd, 0x44aa55, 0xe8b730, 0x8a5dd8, 0x66b6cc, 0xe8687a, 0xf0f0ee, 0x3a3a44
];
const PED_SKINS = [0xf1c27d, 0xd8a06a, 0x8a5a3a, 0xc97e5a];
const PED_SHIRTS = [0x4f6ef7, 0xe85c5c, 0x5cb85c, 0xf0a33a, 0x9a66e0, 0x4ab8b8, 0xe87ad0, 0x7a8a9a];
const PED_HAIRS = [0x2a201a, 0x3a2a1a, 0x5a3a1a, 0x22282e];

function randRange(a, b) { return a + Math.random() * (b - a); }

/** Ma'lumot nuqtasi yo'ldan tashqaridami (piyoda yura oladigan joymi) */
function isWalkable(x, z, margin = 1) {
  if (Math.abs(x) > H_LEN - 4 || Math.abs(z) > V_LEN - 4) return false;
  if (Math.abs(z) < ROAD_HALF + margin) return false;                       // gorizontal yo'l
  if (Math.abs(Math.abs(x) - 60) < ROAD_HALF + margin) return false;        // vertikal yo'llar
  return true;
}

/** Tasodifiy yuriladigan nuqta topish */
function randomWalkPoint() {
  for (let i = 0; i < 50; i++) {
    const x = randRange(-H_LEN + 4, H_LEN - 4);
    const z = randRange(-V_LEN + 4, V_LEN - 4);
    if (isWalkable(x, z)) return { x, z };
  }
  return { x: 0, z: 20 };
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.peds = [];
    this.disposed = false;
  }

  init() {
    this._spawnCars();
    this._spawnPeds();
  }

  // ───────────────────────────────────────────────────────────────────────
  _spawnCars() {
    // Gorizontal yo'l (z=0): 6 ta mashina — 3 tadan har yo'nalish
    for (let i = 0; i < 3; i++) {
      this._addCar({ axis: 'h', lane: LANE, dir: -1, start: randRange(-130, 40) });
      this._addCar({ axis: 'h', lane: -LANE, dir: 1, start: randRange(-40, 130) });
    }
    // Vertikal yo'llar (x=±60): 4 ta
    for (let i = 0; i < 2; i++) {
      this._addCar({ axis: 'v', lane: -60 + LANE, dir: -1, start: randRange(-40, 40) });
      this._addCar({ axis: 'v', lane: 60 - LANE, dir: 1, start: randRange(-40, 40) });
    }
  }

  _addCar({ axis, lane, dir, start }) {
    const color = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
    const mesh = buildCar(color);
    const speed = randRange(4.5, 8);
    this.scene.add(mesh);
    this.cars.push({ mesh, axis, lane, dir, pos: start, speed, wheels: this._wheels(mesh) });
    this._placeCar(this.cars[this.cars.length - 1]);
  }

  _wheels(mesh) {
    const arr = [];
    mesh.traverse(o => { if (o.userData.wheel) arr.push(o); });
    return arr;
  }

  _placeCar(car) {
    const { mesh, axis, lane } = car;
    if (axis === 'h') {
      mesh.position.set(car.pos, 0, lane);
      mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(lane, 0, car.pos);
      mesh.rotation.y = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  _spawnPeds() {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const skin = PED_SKINS[(Math.random() * PED_SKINS.length) | 0];
      const shirt = PED_SHIRTS[(Math.random() * PED_SHIRTS.length) | 0];
      const hair = PED_HAIRS[(Math.random() * PED_HAIRS.length) | 0];
      const female = Math.random() < 0.5;
      const mesh = buildAvatar({
        skin, shirt,
        pants: 0x3a3f52,
        hair,
        hairStyle: female ? 'long' : 'short',
        beard: !female && Math.random() < 0.3
      });
      // bolalar — kichikroq
      const child = Math.random() < 0.12;
      mesh.scale.setScalar(child ? 0.82 : 0.96);
      const p = randomWalkPoint();
      mesh.position.set(p.x, 0, p.z);
      this.scene.add(mesh);

      this.peds.push({
        mesh,
        parts: mesh.userData.parts,
        x: p.x, z: p.z,
        tx: p.x, tz: p.z,
        state: 'idle',
        timer: randRange(1, 3),
        walkPhase: randRange(0, 10),
        breathePhase: randRange(0, 10),
        speed: randRange(0.7, 1.4)
      });
    }
  }

  _pedTarget() {
    const p = randomWalkPoint();
    return { x: p.x, z: p.z };
  }

  // ───────────────────────────────────────────────────────────────────────
  update(dt, playerPos = null) {
    if (this.disposed) return;
    this._updateCars(dt);
    this._updatePeds(dt, playerPos);
  }

  _updateCars(dt) {
    for (const car of this.cars) {
      car.pos += car.dir * car.speed * dt;

      // g'ildiraklar aylanishi
      const spin = car.dir * car.speed / 0.3 * dt;
      for (const w of car.wheels) {
        w.rotation.x -= spin;   // g'ildirak lokal o'qi bo'ylab
      }

      // oxiriga yetganda narigi tarafga
      const bound = car.axis === 'h' ? H_BOUND : V_BOUND;
      if (car.pos > bound) car.pos = -bound;
      if (car.pos < -bound) car.pos = bound;

      this._placeCar(car);
    }
  }

  _updatePeds(dt, playerPos) {
    for (const p of this.peds) {
      p.timer -= dt;

      if (p.state === 'idle') {
        // turib nafas oladi — muzlab qolmagan ko'rinishda
        p.breathePhase += dt * 1.6;
        const br = Math.sin(p.breathePhase) * 0.015;
        p.parts.torso.position.y = 0.9 + br;
        p.parts.head.position.y = 1.48 + br * 0.8;

        if (p.timer <= 0) {
          // yangi nuqtaga yo'l olish
          const t = this._pedTarget();
          p.tx = t.x; p.tz = t.z;
          p.state = 'walk';
          p.timer = randRange(3, 8);
        }
      } else if (p.state === 'walk') {
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.3 || p.timer <= 0) {
          p.state = 'idle';
          p.timer = randRange(1.5, 4);
        } else {
          const step = p.speed * dt;
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
          p.mesh.rotation.y = Math.atan2(dx, dz);
          p.walkPhase += dt * 7;
          this._animatePed(p);

          // o'yinchiga juda yaqin kelsa — chetga surish
          if (playerPos) {
            const pdx = p.x - playerPos.x;
            const pdz = p.z - playerPos.z;
            const pd = Math.hypot(pdx, pdz);
            if (pd > 0.001 && pd < 1.5) {
              const push = (1.5 - pd) * dt * 2;
              p.x += (pdx / pd) * push;
              p.z += (pdz / pd) * push;
            }
          }
        }
      }

      p.mesh.position.set(p.x, 0, p.z);
    }
  }

  _animatePed(p) {
    const parts = p.parts;
    const swing = Math.sin(p.walkPhase);
    const swing2 = Math.sin(p.walkPhase + Math.PI);
    parts.legL.pivot.rotation.x = swing * 0.5;
    parts.legR.pivot.rotation.x = swing2 * 0.5;
    parts.armL.pivot.rotation.x = swing2 * 0.6;
    parts.armR.pivot.rotation.x = swing * 0.6;
    parts.torso.position.y = 0.9 + Math.abs(swing) * 0.02;
    parts.head.position.y = 1.48 + Math.abs(swing) * 0.014;
  }

  dispose() {
    this.disposed = true;
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const p of this.peds) this.scene.remove(p.mesh);
    this.cars = [];
    this.peds = [];
  }
}
