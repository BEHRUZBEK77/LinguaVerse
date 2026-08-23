// ═══════════════════════════════════════════════════════════════════════════
// SceneManager.js — Three.js sahna, renderer, yorug'lik, kunduz/tun va resize
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

// Tun palitrasi — barcha shaharlar uchun bir xil asos
const NIGHT_SKY = new THREE.Color(0x0a1030);
const NIGHT_FOG = new THREE.Color(0x151b38);
const HEMI_DAY = new THREE.Color(0xbfd9ff);
const HEMI_NIGHT = new THREE.Color(0x242c52);
const HEMI_GROUND_DAY = new THREE.Color(0x3a4a3a);
const HEMI_GROUND_NIGHT = new THREE.Color(0x0a0e20);
const CLOUD_DAY = new THREE.Color(0xffffff);
const CLOUD_NIGHT = new THREE.Color(0x2c3458);

/** Radial gradient canvas tekstura — quyosh/oy glow'u uchun. */
function makeGlowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class SceneManager {
  constructor(container, opts = {}) {
    this.container = container;

    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio || 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // ── Sahna ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87c8f0);
    this.scene.fog = new THREE.Fog(0xa8cff0, 90, 320);

    // ── Yorug'lik ──
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.85);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff2d9, 1.35);
    sun.position.set(80, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 130;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.sun = sun;

    // Zaxira: yumshoq, atrofni to'ldiruvchi nur
    const fill = new THREE.DirectionalLight(0x9fb8e8, 0.4);
    fill.position.set(-60, 60, -40);
    this.scene.add(fill);
    this.fill = fill;

    // Kunduz/tun uchun asosiy qiymatlar (startWorld shahar palitrasini beradi)
    this._day = {
      sky: new THREE.Color(0x87c8f0),
      fog: new THREE.Color(0xa8cff0),
      sunIntensity: 1.35,
      sunColor: new THREE.Color(0xfff2d9)
    };
    this._lamps = [];
    this._windows = [];

    // ── Atmosfera: bulutlar + yulduzlar ──
    this._clouds = [];
    const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
    this._cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false });
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      const s = 5 + Math.random() * 8;
      const puffs = 4 + ((Math.random() * 3) | 0);
      for (let j = 0; j < puffs; j++) {
        const puff = new THREE.Mesh(cloudGeo, this._cloudMat);
        puff.position.set((Math.random() - 0.5) * s * 1.9, (Math.random() - 0.5) * s * 0.14, (Math.random() - 0.5) * s * 1.4);
        puff.scale.set(1, 0.45 + Math.random() * 0.3, 1);
        c.add(puff);
      }
      c.position.set((Math.random() - 0.5) * 300, 58 + Math.random() * 26, -120 - Math.random() * 100);
      c.userData.speed = 0.5 + Math.random() * 1.1;
      this.scene.add(c);
      this._clouds.push(c);
    }

    // Yulduzlar — faqat tunda ko'rinadi (Points, tuman ta'sir qilmasin)
    const starCount = 320;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.98);          // faqat yuqori yarim shar
      const r = 430;
      starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this._stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xdfe8ff,
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    }));
    this.scene.add(this._stars);

    // ── Osmon gumbazi — silliq gradient (tekis rang o'rniga) ──
    this._skyUniforms = {
      topColor: { value: new THREE.Color(0x87c8f0) },
      horizonColor: { value: new THREE.Color(0xa8cff0) },
      offset: { value: 24 },
      exponent: { value: 0.55 }
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this._skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this._skyDome = new THREE.Mesh(new THREE.SphereGeometry(470, 24, 16), skyMat);
    this._skyDome.renderOrder = -1;
    this.scene.add(this._skyDome);

    // ── Quyosh va oy disklari (yumshoq glow) ──
    const glowTex = makeGlowTexture('rgba(255,247,224,1)', 'rgba(255,214,140,0.5)');
    this._sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    }));
    const sunDir = new THREE.Vector3(80, 120, 40).normalize();
    this._sun.position.copy(sunDir).multiplyScalar(420);
    this._sun.scale.setScalar(130);
    this.scene.add(this._sun);

    const moonTex = makeGlowTexture('rgba(232,240,255,1)', 'rgba(168,196,255,0.5)');
    this._moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false, opacity: 0
    }));
    this._moon.position.copy(sunDir).multiplyScalar(-420);
    this._moon.scale.setScalar(70);
    this.scene.add(this._moon);

    // ── Kamera ──
    this.camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 0.1, 600
    );
    this.camera.position.set(0, 5, 8);

    // ── Resize ──
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  add(obj) { this.scene.add(obj); }
  remove(obj) { this.scene.remove(obj); }

  /** Shahar palitrasini qo'llaydi (kunduz bazasi). */
  applyCity(city) {
    if (!city) return;
    this._day.sky = new THREE.Color(city.sky);
    this._day.fog = new THREE.Color(city.fog);
    this._day.sunIntensity = city.sun;
    this._day.sunColor = new THREE.Color(city.sunColor || 0xfff2d9);
    this.setDayNight(0);
  }

  /** Chiroq (lamp) glow materiallari — tunda yonadi. */
  registerLamps(materials) {
    this._lamps = Array.isArray(materials) ? materials : [];
  }

  /** Bino deraza materiallari — tunda ichkaridan yorug'lik. */
  registerWindows(materials) {
    this._windows = Array.isArray(materials) ? materials : [];
  }

  /** Bulutlarni sekin harakatlantirish. */
  updateAmbient(dt) {
    for (const c of this._clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 175) {
        c.position.x = -175;
        c.position.z = -120 - Math.random() * 100;
      }
    }
  }

  /**
   * Kunduz/tun darajasi. f: 0 = kunduz, 1 = chuqur tun.
   * Osmon, tuman, yorug'liklar va chiroq glow'ini silliq aralashtiradi.
   */
  setDayNight(f) {
    const t = Math.max(0, Math.min(1, f));
    this.scene.background.copy(this._day.sky).lerp(NIGHT_SKY, t);
    this.scene.fog.color.copy(this._day.fog).lerp(NIGHT_FOG, t);
    this.hemi.intensity = 0.85 * (1 - t * 0.82);
    this.hemi.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, t);
    this.hemi.groundColor.copy(HEMI_GROUND_DAY).lerp(HEMI_GROUND_NIGHT, t);
    this.sun.color.copy(this._day.sunColor);
    this.sun.intensity = this._day.sunIntensity * (1 - t * 0.94);
    this.fill.intensity = 0.4 * (1 - t * 0.72);
    const lampGlow = 0.55 + t * 2.6;
    for (const m of this._lamps) {
      if (m && m.emissiveIntensity != null) m.emissiveIntensity = lampGlow;
    }
    // Bino derazalari — faqat tunda ichkaridan yonadi
    const winGlow = t * 1.6;
    for (const m of this._windows) {
      if (m) m.emissiveIntensity = winGlow;
    }
    // Bulutlar tunda xiralashadi, yulduzlar paydo bo'ladi
    this._cloudMat.color.lerpColors(CLOUD_DAY, CLOUD_NIGHT, t);
    this._stars.material.opacity = Math.min(0.95, t * 1.8);
    // Osmon gumbazi gradienti kunduz/tunga moslashadi
    this._skyUniforms.topColor.value.copy(this._day.sky).lerp(NIGHT_SKY, t);
    this._skyUniforms.horizonColor.value.copy(this._day.fog).lerp(NIGHT_FOG, t);
    // Quyosh kunduzi yonadi, oy esa tunda chiqadi
    this._sun.material.opacity = 1 - t * 0.95;
    this._moon.material.opacity = Math.max(0, t * 1.4 - 0.05);
  }

  /** Sifat darajasi: high | medium | low */
  setQuality(level) {
    const r = { high: 1, medium: 0.9, low: 0.6 }[level] || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, level === 'low' ? 1 : 2));
    this.renderer.shadowMap.enabled = level !== 'low';
    this.renderer.toneMappingExposure = level === 'low' ? 1.1 : 1.05;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
