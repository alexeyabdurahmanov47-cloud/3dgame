import * as THREE from 'three';

// HTML‑метки над объектами («Парк: здесь можно отдохнуть», номера кабинетов и т.д.)
const v = new THREE.Vector3();
export class Labels {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('labels');
    this.list = [];
  }

  setScene(scene) {
    this.root.innerHTML = '';
    this.list = scene ? scene.labels : [];
    for (const l of this.list) {
      l.el = document.createElement('div');
      l.el.className = `label3d ${l.cls}`;
      l.el.innerHTML = l.text;
      l.el.style.display = 'none';
      this.root.append(l.el);
    }
  }

  update(camera) {
    const g = this.game;
    const show = g.save.settings.labels && g.state === 'play' && !g.lesson.active;
    const W = innerWidth, H = innerHeight;
    const p = g.player.pos;
    for (const l of this.list) {
      const d = camera.position.distanceTo(l.pos);
      const dy = l.pos.y - p.y;
      const vis = show && d < l.maxDist && dy > -0.3 && dy < 4.5 && l.visible();
      if (vis) {
        v.copy(l.pos).project(camera);
        if (v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2) {
          const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
          const s = Math.max(0.6, 1.1 - d / l.maxDist * 0.5);
          l.el.style.display = 'block';
          l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${s.toFixed(2)})`;
          l.el.style.opacity = Math.min(1, (l.maxDist - d) / 3).toFixed(2);
          continue;
        }
      }
      if (l.el.style.display !== 'none') l.el.style.display = 'none';
    }
  }
}
