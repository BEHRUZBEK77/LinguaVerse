// ═══════════════════════════════════════════════════════════════════════════
// Interactables.js — predmetlar bilan ishlash, label (CSS2D), highlight
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { WORD_BY_ID, NPC_BY_ID } from '../config.js';

export class Interactables {
  constructor(scene) {
    this.scene = scene;
    this.wordLabels = new Map();   // wordId → CSS2DObject
    this.npcLabels = new Map();    // npcId → CSS2DObject
    this.rings = new Map();        // wordId → ring sprite (SRS glow)
    this._highlighted = null;
    this._ringTime = 0;
  }

  // ───────────────────────────────────────────────────────────────────────
  // SO'Z LABELLARI
  // ───────────────────────────────────────────────────────────────────────
  buildWordLabel(word) {
    const el = document.createElement('div');
    el.className = 'lv-word-label';
    el.innerHTML = `<b>${escapeHtml(word.word)}</b><span>${escapeHtml(word.translation)}</span>`;
    const obj = new CSS2DObject(el);
    obj.position.set(0, 1.5, 0);
    obj.visible = false;
    this.wordLabels.set(word.id, obj);
    return obj;
  }

  /** NPC nomi yorlig'i. */
  buildNpcLabel(npc) {
    const el = document.createElement('div');
    el.className = 'lv-npc-label';
    el.innerHTML = `<b>${escapeHtml(npc.name)}</b><span>${escapeHtml(npc.role)}</span>`;
    const obj = new CSS2DObject(el);
    obj.position.set(0, 2.25, 0);
    obj.visible = false;
    this.npcLabels.set(npc.id, obj);
    return obj;
  }

  /** O'yinchiga yaqin so'zlar labelini ko'rsatadi. */
  updateWordLabels(playerPos, radius = 5.5) {
    for (const [wid, obj] of this.wordLabels) {
      const w = WORD_BY_ID[wid];
      const d = Math.hypot(w.pos.x - playerPos.x, w.pos.z - playerPos.z);
      obj.visible = d < radius;
    }
  }

  updateNpcLabels(playerPos, radius = 9) {
    for (const [nid, obj] of this.npcLabels) {
      const n = NPC_BY_ID[nid];
      const d = Math.hypot(n.pos.x - playerPos.x, n.pos.z - playerPos.z);
      obj.visible = d < radius;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // HIGHLIGHT (sichqoncha ustiga olib borilganda)
  // ───────────────────────────────────────────────────────────────────────
  highlight(group) {
    this.clearHighlight();
    this._highlighted = group;
    if (!group) return;
    group.traverse(o => {
      if (o.isMesh && o.material) {
        o.material.userData._em = o.material.emissive ? o.material.emissive.clone() : null;
        if (o.material.emissive) {
          o.material.emissive.setHex(0xffffff);
          o.material.emissiveIntensity = 0.35;
        }
      }
    });
  }

  clearHighlight() {
    if (!this._highlighted) return;
    this._highlighted.traverse(o => {
      if (o.isMesh && o.material && o.material.userData._em) {
        o.material.emissive.copy(o.material.userData._em);
        o.material.emissiveIntensity = o.material.userData._emIntensity ?? 0;
        delete o.material.userData._em;
      }
    });
    this._highlighted = null;
  }

  // ───────────────────────────────────────────────────────────────────────
  // SRS — takrorlash muddati kelgan so'zlarga yashil halqa
  // ───────────────────────────────────────────────────────────────────────
  setDueRings(dueIds, wordMesh) {
    for (const [wid, ring] of this.rings) {
      if (!dueIds.includes(wid)) {
        this.scene.remove(ring);
        this.rings.delete(wid);
      }
    }
    for (const wid of dueIds) {
      if (this.rings.has(wid)) continue;
      const mesh = wordMesh.get(wid);
      if (!mesh) continue;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(mesh.position.x, 0.06, mesh.position.z);
      this.scene.add(ring);
      this.rings.set(wid, ring);
    }
  }

  updateRings(dt) {
    this._ringTime += dt;
    for (const ring of this.rings.values()) {
      const s = 1 + Math.sin(this._ringTime * 3) * 0.06;
      ring.scale.set(s, s, s);
      ring.material.opacity = 0.6 + Math.sin(this._ringTime * 3) * 0.25;
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
