// ═══════════════════════════════════════════════════════════════════════════
// InputManager.js — klaviatura, sichqoncha, sensor (touch) boshqaruvi
//
// Desktop: WASD + strelkalar, Shift — yugurish, E — interact, Tab — questlar,
//          M — minimap, Esc — sozlamalar, G — panel.
// Mobil: virtual joystick + tugmalar (HUD ishlab beradi).
// ═══════════════════════════════════════════════════════════════════════════
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.move = { x: 0, z: 0 };      // -1..1
    this.running = false;
    this.joystick = { active: false, x: 0, z: 0 };
    this.useJoystick = false;

    // Ekran o'lchamiga qarab joystikni yoqish
    this.useJoystick = matchMedia('(pointer: coarse)').matches || window.innerWidth < 860;

    // Orbital kamera boshqaruvi
    this.orbitDeltaX = 0;
    this.orbitDeltaY = 0;
    this.zoomDelta = 0;
    this._dragging = false;
    this._dragStart = null;
    this._pointerDown = false;

    this.onInteract = null;      // E yoki joystik "interact" tugmasi
    this.onAnyKey = null;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'shift') this.running = true;
      if (k === 'e') this.onInteract && this.onInteract('key');
      if (this.onAnyKey) this.onAnyKey(k, e);
    });

    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
      if (k === 'shift') this.running = false;
    });

    // ── Sichqoncha: aylantirish (drag) + click (interact) + zoom ──
    this.canvas.addEventListener('pointerdown', e => {
      this._pointerDown = true;
      this._dragStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    });

    window.addEventListener('pointermove', e => {
      if (!this._pointerDown) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      // Harakat sezilarli bo'lsa — bu drag (orbit), click emas
      if (Math.abs(dx) + Math.abs(dy) > 8) this._dragging = true;
      if (this._dragging) {
        this.orbitDeltaX += dx;
        this.orbitDeltaY += dy;
        this._dragStart = { x: e.clientX, y: e.clientY, t: Date.now() };
      }
    });

    window.addEventListener('pointerup', e => {
      const isClick = this._pointerDown && !this._dragging &&
        this._dragStart && (Date.now() - this._dragStart.t) < 400;
      if (isClick) this._click = { x: e.clientX, y: e.clientY };
      this._pointerDown = false;
      this._dragging = false;
      this._dragStart = null;
    });

    this.canvas.addEventListener('wheel', e => {
      this.zoomDelta += Math.sign(e.deltaY) * 0.9;
    }, { passive: true });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  /** Har kuzatuv siklda chaqiriladi — tutib olingan burchaklarni qaytaradi. */
  consumeOrbit() {
    const d = { x: this.orbitDeltaX, y: this.orbitDeltaY };
    this.orbitDeltaX = 0;
    this.orbitDeltaY = 0;
    return d;
  }

  consumeZoom() {
    const z = this.zoomDelta;
    this.zoomDelta = 0;
    return z;
  }

  consumeClick() {
    const c = this._click;
    this._click = null;
    return c;
  }

  /** Joystik qiymatini o'rnatadi (mobil). */
  setJoystick(x, z) {
    this.joystick.x = x;
    this.joystick.z = z;
    this.joystick.active = Math.abs(x) > 0.12 || Math.abs(z) > 0.12;
  }

  /** Yurish yo'nalishi: WASD yoki joystik. */
  movement() {
    if (this.useJoystick && this.joystick.active) {
      return {
        x: this.joystick.x,
        z: this.joystick.z,
        running: false
      };
    }
    let x = 0, z = 0;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    if (this.keys['w'] || this.keys['arrowup']) z -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) z += 1;
    return { x, z, running: this.running && (x !== 0 || z !== 0) };
  }

  /** Yozuv maydoni ochiq bo'lganda harakatni to'xtatish uchun. */
  setLocked(locked) { this._locked = locked; }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
