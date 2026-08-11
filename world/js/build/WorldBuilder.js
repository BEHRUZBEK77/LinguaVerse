// ═══════════════════════════════════════════════════════════════════════════
// WorldBuilder.js — shahar quruvchisi
//
// ZONAS, yo'llar, maydon, binolar, daraxtlar, predmetlar (lug'at) va NPC'larni
// bir joyga quradi. Barcha koordinatalar MUTLAQ bo'lib, config.js dagi
// zonalar, so'zlar va NPC ma'lumotlariga mos keladi.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { WORLD, ZONES, WORDS, NPCS, cityAt } from '../config.js';
import {
  stdMat, buildBuilding, buildProp, buildNPC, buildGround, buildRoad,
  buildTree, buildBush, buildFlower, buildLamp, buildBench, buildFenceSection
} from './Models.js';

// Gul ranglari — fontan atrofi uchun
const FLOWER_COLORS = [0xff6b9d, 0xffb347, 0xe85cd0, 0x6bc8ff, 0xffffff];

// Har zona uchun yer qoplamasi teksturasi
const GROUND_TEX = {
  cafe: 'dirt', market: 'dirt', office: 'concrete',
  home: 'grass', school: 'grass', airport: 'concrete'
};

// Har zona uchun binolar (markazga nisbatan, x: sharq+, z: janub+)
const LAYOUTS = {
  cafe: [
    { type: 'cafe',   x: -8,  z: -26, w: 18, d: 13, h: 4.6 },
    { type: 'shop',   x: 22,  z: -20, w: 10, d: 8,  h: 2.8 },
    { type: 'tower',  x: -30, z: 10,  w: 9,  d: 9,  h: 5.5 },
    { type: 'shop',   x: 16,  z: 18,  w: 11, d: 9,  h: 2.8 }
  ],
  market: [
    { type: 'market', x: 0,   z: -24, w: 24, d: 16, h: 3.6 },
    { type: 'shop',   x: -30, z: -4,  w: 10, d: 8,  h: 2.6 },
    { type: 'shop',   x: 28,  z: 2,   w: 10, d: 8,  h: 2.6 },
    { type: 'tower',  x: -16, z: 30,  w: 8,  d: 8,  h: 5 }
  ],
  office: [
    { type: 'office', x: 2,   z: -24, w: 20, d: 15, h: 7 },
    { type: 'tower',  x: -30, z: 4,   w: 11, d: 11, h: 9 },
    { type: 'tower',  x: 28,  z: -4,  w: 9,  d: 9,  h: 7 },
    { type: 'shop',   x: -14, z: 30,  w: 10, d: 8,  h: 2.8 },
    { type: 'office', x: 24,  z: 26,  w: 12, d: 9,  h: 5 }
  ],
  home: [
    { type: 'house', x: -24, z: -24, w: 12, d: 10, h: 4.5 },
    { type: 'house', x: 2,   z: -24, w: 12, d: 10, h: 4.5 },
    { type: 'house', x: -24, z: 8,   w: 12, d: 10, h: 4.5 },
    { type: 'house', x: 26,  z: 8,   w: 12, d: 10, h: 4.5 },
    { type: 'house', x: 2,   z: 30,  w: 12, d: 10, h: 4.5 }
  ],
  school: [
    { type: 'school', x: 0,   z: -26, w: 24, d: 16, h: 4 },
    { type: 'tower',  x: -30, z: 12,  w: 8,  d: 8,  h: 5.5 },
    { type: 'shop',   x: 28,  z: 8,   w: 10, d: 8,  h: 2.6 },
    { type: 'shop',   x: -22, z: 30,  w: 9,  d: 8,  h: 2.6 }
  ],
  airport: [
    { type: 'airport', x: 0,   z: -28, w: 34, d: 20, h: 4.5 },
    { type: 'tower',   x: -30, z: 0,   w: 10, d: 10, h: 8 },
    { type: 'shop',    x: 28,  z: -10, w: 11, d: 9,  h: 2.8 },
    { type: 'shop',    x: -24, z: 30,  w: 10, d: 8,  h: 2.6 }
  ]
};

export class WorldBuilder {
  constructor(scene, physics, city = null) {
    this.scene = scene;
    this.physics = physics;
    this.city = city || cityAt(null);
    this.staticMeshes = [];      // highlight qilmaslik uchun
    this.interactMeshes = [];    // raycast uchun (predmetlar + NPC + avatar qismlari emas)
    this.wordMesh = new Map();   // wordId → mesh
    this.propToWord = new Map(); // mesh.uuid → wordId
    this.npcMeshes = new Map();  // npcId → group
    this.lampLights = [];        // tunda yonadigan chiroq glow materiallari
    this.windowMats = [];        // tunda yonadigan bino derazalari
    this._rngSeed = 1;
  }

  // Bino ranglarini shahar toniga moslash
  _tintGroup(g) {
    const t = this.city.tint;
    g.traverse(o => {
      if (o.isMesh && o.material && o.material.color) {
        o.material.color.multiplyScalar(t);
      }
    });
    return g;
  }

  _rand() {
    // deterministik sochma joylashtirish uchun
    this._rngSeed = (this._rngSeed * 16807) % 2147483647;
    return (this._rngSeed - 1) / 2147483646;
  }

  build() {
    this._buildBase();
    for (const zone of ZONES) this._buildZone(zone);
    this._buildPlaza();
    this._buildWalls();
    this._buildWords();
    this._buildNPCs();
    return {
      wordMesh: this.wordMesh,
      propToWord: this.propToWord,
      npcMeshes: this.npcMeshes,
      interactMeshes: this.interactMeshes,
      staticMeshes: this.staticMeshes,
      lampLights: this.lampLights,
      windowMats: this.windowMats,
      fountainSpray: this.fountainSpray || null
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  _buildBase() {
    const { grass, road, tree, lamp } = this.city;
    // Umumiy yer — maysa teksturali
    const ground = buildGround(400, 280, grass, { texture: 'grass' });
    this.scene.add(ground);

    // Yo'llar
    const roadH = buildRoad(352, WORLD.roadWidth, road);   // x bo'ylab (z=0)
    roadH.position.set(0, 0.02, 0);
    this.scene.add(roadH);

    const roadV1 = buildRoad(WORLD.roadWidth, 232, road);  // x=-60
    roadV1.position.set(-60, 0.02, 0);
    this.scene.add(roadV1);

    const roadV2 = buildRoad(WORLD.roadWidth, 232, road);  // x=60
    roadV2.position.set(60, 0.02, 0);
    this.scene.add(roadV2);

    // Yo'l chetlari — pastak to'siq, o'yinchi yo'ldan chiqib ketmasin
    for (const x of [-60, 60]) {
      this.physics.addBox(x - WORLD.roadWidth / 2 - 0.3, 0, 0.6, 232);
      this.physics.addBox(x + WORLD.roadWidth / 2 + 0.3, 0, 0.6, 232);
    }
    this.physics.addBox(0, -WORLD.roadWidth / 2 - 0.3, 352, 0.6);
    this.physics.addBox(0, WORLD.roadWidth / 2 + 0.3, 352, 0.6);

    // Yo'l bo'ylab chiroqlar va daraxtlar
    for (let i = 0; i < 5; i++) {
      const x = -176 + 40 + i * 68;
      this._decorate(buildLamp({ color: lamp }), x, -3.5);
      this._decorate(buildLamp({ color: lamp }), x, 3.5);
      this._decorate(buildTree({ r: 0.8, color: tree }), x, -8.5);
      this._decorate(buildTree({ r: 0.8, color: tree }), x, 8.5);
    }

    // Yo'l bo'yidagi butalar — ko'kalamzorlashtirish
    for (let i = 0; i < 6; i++) {
      const x = -156 + i * 60;
      this._decorate(buildBush({ r: 0.42, color: tree }), x, -11.5);
      this._decorate(buildBush({ r: 0.42, color: tree }), x, 11.5);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  _buildZone(zone) {
    const { center } = zone;
    const h = WORLD.districtHalf;

    // Zona yeri — turiga qarab teksturali
    const ground = buildGround(h * 2, h * 2, zone.ground, { texture: GROUND_TEX[zone.id] || 'grass' });
    ground.position.set(center.x, 0.04, center.z);
    this.scene.add(ground);

    // Tro tuarlar (chet) — plitkali
    for (const [ox, oz] of [[0, -h], [0, h], [-h, 0], [h, 0]]) {
      const tile = buildGround(h * 2 - 1.5, 1.4, 0x6a6a6a, { texture: 'tile' });
      tile.position.set(center.x + ox, 0.05, center.z + oz);
      this.scene.add(tile);
    }

    // Binolar
    const layout = LAYOUTS[zone.id] || [];
    for (const b of layout) {
      const g = buildBuilding(b.type, b.w, b.d, b.h);
      g.position.set(center.x + b.x, 0, center.z + b.z);
      // front (+z) tomon o'yinchiga qaragan bo'lsin — bu yerda binoni o'giramiz
      g.userData.buildingInfo = b;
      this._tintGroup(g);
      // Deraza materiallarini yig'ish — tunda yonadi (emissive = asl rang)
      g.traverse(o => {
        if (o.isMesh && o.material && o.material.userData && o.material.userData.isWindow) {
          o.material.emissive = new THREE.Color(o.material.color);
          o.material.emissiveIntensity = 0;
          this.windowMats.push(o.material);
        }
      });
      this.scene.add(g);
      this.physics.addBox(center.x + b.x, center.z + b.z, b.w, b.d);
      this.staticMeshes.push(g);
    }

    // Daraxtlar — binolar orasidagi ochiq joylarga
    const spots = [[-h + 6, -h + 6], [h - 6, -h + 6], [-h + 6, h - 6], [h - 6, h - 6], [-h + 3, 0], [h - 3, 0]];
    for (const [ox, oz] of spots) {
      this._decorate(buildTree({ r: 0.9, color: this.city.tree }), center.x + ox, center.z + oz);
    }

    // Skameykalar
    for (const [ox, oz] of [[-h + 4, 0], [h - 4, 0]]) {
      this._decorate(buildBench(), center.x + ox, center.z + oz);
    }

    // Skameykalar yoniga butalar
    for (const [ox, oz] of [[-h + 7, 3.5], [h - 7, -3.5]]) {
      this._decorate(buildBush({ r: 0.4, color: this.city.tree }), center.x + ox, center.z + oz);
    }
  }

  _decorate(obj, x, z, rot = 0) {
    obj.position.set(x, 0, z);
    obj.rotation.y = rot;
    this.scene.add(obj);
    // Chiroq glow materiallarini yig'ish — kunduz/tun sikli uchun
    if (obj.userData && obj.userData.isLamp) {
      obj.traverse(o => {
        if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity != null) {
          this.lampLights.push(o.material);
        }
      });
    }
    return obj;
  }

  // ───────────────────────────────────────────────────────────────────────
  _buildPlaza() {
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5, 0.5, 20),
      stdMat(0x8a8a9a)
    );
    pool.position.set(0, 0.25, 0);
    pool.receiveShadow = true;
    this.scene.add(pool);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(4.1, 20),
      new THREE.MeshStandardMaterial({ color: this.city.water || 0x4aa8d8, roughness: 0.2, metalness: 0.1 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.5, 0);
    this.scene.add(water);
    this.fountain = water;

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), stdMat(0x8a8a9a));
    pillar.position.set(0, 1.5, 0);
    pillar.castShadow = true;
    this.scene.add(pillar);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.4, 12), stdMat(0x8a8a9a));
    bowl.position.set(0, 2.6, 0);
    bowl.castShadow = true;
    this.scene.add(bowl);

    // Markaz maydoniga olib boruvchi skameykalar
    for (const [x, z] of [[-10, 3], [10, 3], [-10, -3], [10, -3]]) {
      this._decorate(buildBench(), x, z);
    }

    // Maydon atrofida chiroqlar (tunda yonadi)
    for (const [x, z] of [[-13, 4], [13, 4], [-13, -4], [13, -4]]) {
      this._decorate(buildLamp({ color: this.city.lamp }), x, z);
    }

    // Fontan atrofida gul halqasi
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rr = 6.5 + Math.random() * 2.5;
      this._decorate(
        buildFlower({ color: FLOWER_COLORS[i % FLOWER_COLORS.length] }),
        Math.cos(a) * rr, Math.sin(a) * rr, Math.random() * Math.PI * 2
      );
    }

    // Fontan suv sachratgichi (jonli animatsiya)
    const spray = new THREE.Group();
    const dropMat = stdMat(0xbfe8ff, { roughness: 0.3, emissive: 0x9ad4ff, emissiveIntensity: 0.25 });
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), dropMat);
      d.userData.ang = (i / 8) * Math.PI * 2;
      d.userData.phase = Math.random() * 6;
      spray.add(d);
    }
    spray.position.set(0, 0.5, 0);
    this.scene.add(spray);
    this.fountainSpray = spray;
  }

  // ───────────────────────────────────────────────────────────────────────
  _buildWalls() {
    const halfX = WORLD.size.x;
    const halfZ = WORLD.size.z;
    const mat = stdMat(0x5a6a5a);
    const wallH = 2;

    const sections = [
      { x: 0, z: -halfZ, w: halfX * 2, d: 0.6 },
      { x: 0, z: halfZ, w: halfX * 2, d: 0.6 },
      { x: -halfX, z: 0, w: 0.6, d: halfZ * 2 },
      { x: halfX, z: 0, w: 0.6, d: halfZ * 2 }
    ];
    for (const s of sections) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(s.w, wallH, s.d), mat);
      wall.position.set(s.x, wallH / 2, s.z);
      wall.receiveShadow = true;
      wall.castShadow = true;
      this.scene.add(wall);
      this.physics.addBox(s.x, s.z, s.w, s.d);
    }

    // Dachalar (dekorativ) — devor ichida bir oz
    this._decorate(buildFenceSection(30), 0, -halfZ + 6, Math.PI);
    this._decorate(buildFenceSection(30), -halfX + 6, 0, -Math.PI / 2);
    this._decorate(buildFenceSection(30), halfX - 6, 0, Math.PI / 2);
  }

  // ───────────────────────────────────────────────────────────────────────
  _buildWords() {
    for (const w of WORDS) {
      const g = buildProp(w.prop);
      g.position.set(w.pos.x, 0, w.pos.z);
      g.rotation.y = this._rand() * Math.PI * 2;

      // Interaktivilik uchun marker
      g.userData.wordId = w.id;
      g.userData.isWord = true;

      this.scene.add(g);
      this.wordMesh.set(w.id, g);
      this.propToWord.set(g.uuid, w.id);
      this.interactMeshes.push(g);
      this._collectInteractable(g);
    }
  }

  _collectInteractable(g) {
    g.traverse(o => {
      if (o.isMesh) {
        o.userData.wordId = g.userData.wordId;
        o.userData.isWord = true;
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  _buildNPCs() {
    // Alohida personajlar uchun tashqi ko'rinish
    const LOOKS = {
      home_grandpa: { hair: 0xcfcfcf, hairStyle: 'short', beard: true },
      airport_karim: { beard: true },
      market_ali: { hairStyle: 'curly' },
      cafe_marta: { hair: 0x5a2a1a, hairStyle: 'long' },
      school_nilufar: { hair: 0x3a2a1a, hairStyle: 'long' }
    };
    for (const n of NPCS) {
      const looks = LOOKS[n.id] || {};
      const g = buildNPC({
        skin: n.gender === 'female' ? 0xf1c27d : 0xd8a06a,
        shirt: n.color,
        pants: 0x2a3350,
        hair: looks.hair || (n.gender === 'female' ? 0x4a2a1a : 0x2a201a),
        hairStyle: looks.hairStyle || (n.gender === 'female' ? 'long' : 'short'),
        beard: looks.beard || false
      });
      g.position.set(n.pos.x, 0, n.pos.z);
      g.rotation.y = Math.PI;   // o'yinchi tomon qarab tursin (janubga)

      g.userData.npcId = n.id;
      g.userData.isNPC = true;
      g.traverse(o => {
        if (o.isMesh) {
          o.userData.npcId = n.id;
          o.userData.isNPC = true;
        }
      });

      this.scene.add(g);
      this.npcMeshes.set(n.id, g);
      this.interactMeshes.push(g);
    }
  }

  /** Yangi so'z predmetini qo'shish (AI lug'at kengaytmasi uchun zahira). */
  addWordMesh(w) {
    const g = buildProp(w.prop);
    g.position.set(w.pos.x, 0, w.pos.z);
    g.userData.wordId = w.id;
    g.userData.isWord = true;
    this.scene.add(g);
    this.wordMesh.set(w.id, g);
    this.propToWord.set(g.uuid, w.id);
    this.interactMeshes.push(g);
    this._collectInteractable(g);
    return g;
  }
}
