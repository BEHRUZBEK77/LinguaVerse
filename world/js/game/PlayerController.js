// ═══════════════════════════════════════════════════════════════════════════
// PlayerController.js — o'yinchi harakati va avatar animatsiyasi
// ═══════════════════════════════════════════════════════════════════════════
import { WORLD } from '../config.js';
import { buildAvatar } from '../build/Models.js';

export class PlayerController {
  constructor(scene, physics, audio) {
    this.avatar = buildAvatar({});
    scene.add(this.avatar);
    this.physics = physics;
    this.audio = audio;

    this.position = {
      x: WORLD.spawn.x,
      z: WORLD.spawn.z
    };
    this.velocity = { x: 0, z: 0 };
    this.radius = WORLD.playerRadius;
    this.facingYaw = 0;
    this.moving = false;
    this.running = false;
    this.frozen = false;          // suhbat vaqtida
    this._animTime = 0;
    this._walkPhase = 0;
    this._bobPhase = 0;
    this._stepAccum = 0;

    this.avatar.position.set(this.position.x, 0, this.position.z);
    this.parts = this.avatar.userData.parts;
  }

  update(dt, input, cameraYaw) {
    this._animTime += dt;

    // ── Harakat ──
    if (!this.frozen) {
      const mv = input.movement();
      const len = Math.hypot(mv.x, mv.z);

      if (len > 0.05) {
        // Yo'nalish kamera burilishiga nisbatan
        const speed = mv.running ? WORLD.runSpeed : WORLD.walkSpeed;
        this.moving = true;
        this.running = mv.running;

        const cos = Math.cos(cameraYaw);
        const sin = Math.sin(cameraYaw);
        // Joystikda z — oldinga (+1 oldinga). Klaviaturada W → z=-1 (three tarmog'i)
        const forwardZ = mv.z;
        const forwardX = mv.x;
        const wx = -forwardX * cos - forwardZ * sin;
        const wz = forwardX * sin - forwardZ * cos;

        this.velocity.x = wx * speed;
        this.velocity.z = wz * speed;
      } else {
        this.moving = false;
        this.running = false;
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    } else {
      this.moving = false;
      this.running = false;
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // ── Pozitsiyani yangilash + kolliziya ──
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    // Avval X, keyin Z — devorlar bo'ylab sirpanadi
    this.position.x = nextX;
    this.physics.moveCircle(this.position, this.radius);
    this.position.z = nextZ;
    this.physics.moveCircle(this.position, this.radius);

    // ── Burilish ──
    if (this.moving) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.facingYaw = lerpAngle(this.facingYaw, targetYaw, 0.25);
    }

    // ── Animatsiya ──
    this._animate(dt);

    // ── Avatarni joylashtirish ──
    this.avatar.position.x = this.position.x;
    this.avatar.position.z = this.position.z;
    this.avatar.rotation.y = this.facingYaw;

    // ── Qadam ovozi ──
    if (this.moving) {
      this._stepAccum += dt * (this.running ? 2.6 : 2.0);
      if (this._stepAccum >= 1) {
        this._stepAccum = 0;
        if (this.audio) this.audio.step();
      }
    }
  }

  _animate(dt) {
    const parts = this.parts;
    const speed = this.moving ? (this.running ? 11 : 6.5) : 0;
    this._walkPhase += dt * speed;

    const swing = this.moving ? Math.sin(this._walkPhase) : 0;
    const swing2 = this.moving ? Math.sin(this._walkPhase + Math.PI) : 0;
    const legAmp = this.running ? 0.85 : 0.55;
    const armAmp = this.running ? 1.1 : 0.75;

    parts.legL.pivot.rotation.x = swing * legAmp;
    parts.legR.pivot.rotation.x = swing2 * legAmp;
    parts.armL.pivot.rotation.x = swing2 * armAmp;
    parts.armR.pivot.rotation.x = swing * armAmp;

    // Tik turish (idle) — nafas olish
    const breath = Math.sin(this._animTime * 2) * 0.012;
    parts.torso.position.y = 0.9 + breath;
    parts.head.position.y = 1.48 + breath * 0.8;

    // Yurishda tana silkitilishi (ikki qadamda bir marta tepa-past)
    if (this.moving) {
      const bob = Math.abs(Math.sin(this._walkPhase)) * (this.running ? 0.05 : 0.028);
      parts.torso.position.y += bob;
      parts.head.position.y += bob * 0.7;
      parts.torso.rotation.x = 0.06 + Math.sin(this._walkPhase) * 0.025;
      parts.torso.rotation.z = swing * 0.035;      // yelkadan tana aylanmasi
      parts.head.rotation.x = -swing * 0.03;       // bosh qarama-qarshi muvozanati
    } else {
      parts.torso.rotation.x = 0;
      parts.torso.rotation.z = 0;
      parts.head.rotation.x = 0;
    }
  }

  /** O'yinchini suhbatda NPC'ga qaratadi. */
  faceToward(x, z) {
    const targetYaw = Math.atan2(x - this.position.x, z - this.position.z);
    this.facingYaw = lerpAngle(this.facingYaw, targetYaw, 0.3);
    this.avatar.rotation.y = this.facingYaw;
  }

  get position3() { return this.position; }

  setFrozen(frozen) { this.frozen = frozen; }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
