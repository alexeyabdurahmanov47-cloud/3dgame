import * as THREE from 'three';
import { mat } from './gfx.js';

// Частицы‑вспышки (монеты, звёзды, сердечки)
const partGeo = new THREE.OctahedronGeometry(0.08, 0);
export class Effects {
  constructor() {
    this.parts = [];
    this.scene = null;
  }

  setScene(scene) {
    this.parts.forEach((p) => p.m.parent && p.m.parent.remove(p.m));
    this.parts = [];
    this.scene = scene;
  }

  burst(pos, color = '#ffd32a', count = 12, kind = 'spark') {
    if (!this.scene) return;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(partGeo, mat(color, { basic: true }));
      m.position.copy(pos);
      if (kind === 'heart') m.scale.set(1.5, 1.5, 0.6);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2.5;
      this.parts.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp), life: 0.8 + Math.random() * 0.5, kind });
      this.scene.add(m);
    }
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.kind === 'heart') p.v.y = 1.5;
      else p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 6;
      p.m.rotation.y += dt * 4;
      const s = Math.max(0, Math.min(1, p.life * 2));
      p.m.scale.setScalar(s * (p.kind === 'heart' ? 1.4 : 1));
      if (p.life <= 0) {
        p.m.parent && p.m.parent.remove(p.m);
        this.parts.splice(i, 1);
      }
    }
  }
}
