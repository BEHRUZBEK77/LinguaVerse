// ═══════════════════════════════════════════════════════════════════════════
// Weather.js — yengil ob-havo effektlari (yomg'ir)
//
// Hozircha faqat yomg'ir: shahar maydoni bo'ylab tushayotgan, juda arzon
// (Points) zarracha tizimi. Low sifatda o'chiriladi.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const RAIN_COUNT = 260;
const AREA_X = 180;
const AREA_Z = 120;
const AREA_H = 30;
const FALL = 26;
const DRIFT_X = 5;

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.rain = null;
    this._geo = null;
    this._mat = null;
  }

  enable() {
    if (this.rain) return;
    const pos = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * AREA_X;
      pos[i * 3 + 1] = Math.random() * AREA_H - 3;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * AREA_Z;
    }
    this._geo = new THREE.BufferGeometry();
    this._geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._mat = new THREE.PointsMaterial({
      color: 0xaab8dc,
      size: 0.11,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false
    });
    this.rain = new THREE.Points(this._geo, this._mat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  update(dt) {
    if (!this.rain) return;
    const attr = this._geo.attributes.position;
    const a = attr.array;
    const fall = FALL * dt;
    const drift = DRIFT_X * dt;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += drift;
      a[i + 1] -= fall;
      a[i + 2] += drift * 0.35;
      if (a[i + 1] < -3) {
        a[i + 1] = AREA_H;
        a[i] = (Math.random() * 2 - 1) * AREA_X;
        a[i + 2] = (Math.random() * 2 - 1) * AREA_Z;
      }
      if (a[i] > AREA_X) a[i] = -AREA_X;
      if (a[i + 2] > AREA_Z) a[i + 2] = -AREA_Z;
      if (a[i + 2] < -AREA_Z) a[i + 2] = AREA_Z;
    }
    attr.needsUpdate = true;
  }

  dispose() {
    if (this.rain) {
      this.scene.remove(this.rain);
      this._geo.dispose();
      this._mat.dispose();
      this.rain = null;
      this._geo = null;
      this._mat = null;
    }
  }
}

export default Weather;
