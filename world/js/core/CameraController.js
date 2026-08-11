// ═══════════════════════════════════════════════════════════════════════════
// CameraController.js — uchinchi shaxs kamera
// Avatar orqasida, orbit va zoom bilan. Devorlarga kirmaydi.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;              // avatar atrofida burchak
    this.pitch = 0.32;         // qanchalik balanddan qarash
    this.distance = 8.5;
    this.minDistance = 4.2;
    this.maxDistance = 14;
    this.minPitch = 0.08;
    this.maxPitch = 0.85;
    this.heightOffset = 1.45;  // avatar ko'kragi balandligi

    this._look = new THREE.Vector3();
  }

  update(dt, orbit = { x: 0, y: 0 }, zoom = 0) {
    this.yaw -= orbit.x * 0.0052;
    this.pitch = THREE.MathUtils.clamp(this.pitch + orbit.y * 0.0035, this.minPitch, this.maxPitch);
    this.distance = THREE.MathUtils.clamp(this.distance + zoom * 0.12, this.minDistance, this.maxDistance);

    const cx = this.target.x;
    const cy = this.target.y + this.heightOffset;
    const cz = this.target.z;

    const cp = Math.cos(this.pitch);
    const offsetX = Math.sin(this.yaw) * cp * this.distance;
    const offsetZ = Math.cos(this.yaw) * cp * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;

    let px = cx - offsetX;
    let py = cy + offsetY;
    let pz = cz - offsetZ;

    // Yer sathidan pastga tushmasin
    if (py < 0.6) py = 0.6;

    // Kamerani silliq yaqinlashtiramiz (lerp)
    const smooth = 1 - Math.pow(0.0001, dt);
    this.camera.position.lerp(new THREE.Vector3(px, py, pz), smooth);

    this._look.set(cx, cy, cz);
    this.camera.lookAt(this._look);
  }

  /** Suhbat davomida NPC'ga fokuslanadi. */
  focusPoint(point, height = 1.5, dist = 3.6) {
    this.target.copy(point);
    this.distance = Math.min(this.distance, dist);
    this.pitch = Math.max(this.pitch, 0.18);
    this.heightOffset = height;
  }

  snap() {
    const cp = Math.cos(this.pitch);
    const offsetX = Math.sin(this.yaw) * cp * this.distance;
    const offsetZ = Math.cos(this.yaw) * cp * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x - offsetX,
      Math.max(0.6, this.target.y + this.heightOffset + offsetY),
      this.target.z - offsetZ
    );
    this.camera.lookAt(this.target.x, this.target.y + this.heightOffset, this.target.z);
  }
}
