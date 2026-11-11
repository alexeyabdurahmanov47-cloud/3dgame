import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { tree, flowers, lamp, bench, cloud, GEO } from './props.js';
import { CharacterModel, starGeometry } from '../player/CharacterModel.js';
import { lookFromEquipped } from '../shop/items.js';
import { mat, seeded, textPlane } from '../core/gfx.js';

// Диорама для главного меню: остров со школой, деревьями и персонажем
export class MenuScene extends BaseScene {
  constructor(game) {
    super(game, 'menu');
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
    this.t = 0;
  }

  build() {
    this.setupLights({ sky: '#8fd3ff', fog: [40, 120], shadowSize: 16, sunPos: [10, 20, 8] });
    const rnd = seeded(42);
    // остров
    this.geo(GEO.cyl12, '#7bd36b', 0, -0.5, 0, { sx: 14, sy: 1, sz: 14 });
    this.geo(GEO.cyl12, '#b77b4f', 0, -2.2, 0, { sx: 13, sy: 2.6, sz: 13 });
    this.geo(GEO.cone, '#9c6640', 0, -5.5, 0, { sx: 11, sy: 4.5, sz: 11, rx: Math.PI });
    // дорожка
    this.box(0, -0.02, 3, 1.6, 0.04, 10, '#f2d7a6', { cast: false });
    // школа
    this.box(0, 0, -6, 9, 4.5, 4, '#ffb26b');
    this.box(0, 4.5, -6, 9.4, 0.4, 4.4, '#e17055');
    this.box(0, 0, -3.9, 1.6, 2.4, 0.3, '#74b9ff');
    for (let i = -3; i <= 3; i += 2) {
      if (i === -1 || i === 1) continue;
      this.box(i, 1.2, -3.95, 1.2, 1, 0.1, '#bfe9ff', { cast: false });
      this.box(i, 3, -3.95, 1.2, 1, 0.1, '#bfe9ff', { cast: false });
    }
    this.box(-1, 3, -3.95, 1.2, 1, 0.1, '#bfe9ff', { cast: false });
    this.box(1, 3, -3.95, 1.2, 1, 0.1, '#bfe9ff', { cast: false });
    const sign = textPlane('ШКОЛА', 3, 0.7, { bg: '#ffffff', fg: '#6c5ce7' });
    sign.position.set(0, 4.1, -3.78);
    this.scene.add(sign);
    // флаг
    this.geo(GEO.cyl, '#dfe6e9', 5.5, 2.5, -4, { sx: 0.06, sy: 5, sz: 0.06 });
    this.flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.04), mat('#ff6b6b'));
    this.flag.position.set(6.1, 4.6, -4);
    this.scene.add(this.flag);

    tree(this, -7, -1, 1.1, 'round', 0, rnd);
    tree(this, -8, 3, 0.9, 'pine', 0, rnd);
    tree(this, 7.5, 2, 1, 'round', 0, rnd);
    tree(this, 6, 6.5, 0.8, 'round', 0, rnd);
    tree(this, -5, 7, 0.9, 'round', 0, rnd);
    flowers(this, -3.5, 4, 2.4, 1.2, 12, 0, rnd);
    flowers(this, 3.5, 4.5, 2.4, 1.2, 12, 0, rnd);
    lamp(this, 2, 1);
    bench(this, -3, 1, 0);

    for (let i = 0; i < 6; i++) this.clouds = (this.clouds || []).concat(cloud(this, -30 + i * 12, 14 + (i % 3) * 3, -20 - (i % 2) * 15, 1.2));

    // парящие книги и звёзды
    this.floaters = [];
    const bookColors = ['#ff6b6b', '#3fa7ff', '#2ed573', '#ffc93c'];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.65), mat(bookColors[i]));
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.6), mat('#ffffff'));
      p.position.x = 0.04;
      b.add(c, p);
      b.position.set(-4 + i * 2.6, 5 + (i % 2), -1 + (i % 2) * 2);
      this.scene.add(b);
      this.floaters.push(b);
    }
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(starGeometry(0.4, 0.12), mat('#ffe066', { emissive: '#a08000' }));
      s.position.set(-5 + i * 5, 7 + i, -3);
      this.scene.add(s);
      this.floaters.push(s);
    }

    this.hero = new CharacterModel();
    this.hero.pose = 'wave';
    this.hero.root.position.set(1.2, 0, 4);
    this.scene.add(this.hero.root);
    this.refreshLook();
    this.finalize();
  }

  refreshLook() {
    this.hero.build(lookFromEquipped(this.game.save.data.equipped));
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const wide = innerWidth > 760;
    const a = Math.sin(t * 0.15) * 0.35;
    const r = wide ? 6.2 : 9;
    const hx = this.hero.root.position.x, hz = this.hero.root.position.z;
    // персонаж смещён вправо на широких экранах (меню слева)
    const off = wide ? 2.1 : 0;
    this.camera.position.set(hx + Math.sin(a) * r - off * 0.3, 2.6, hz + Math.cos(a) * r);
    this.camera.lookAt(hx - off, 1.5, hz - 2);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.hero.root.rotation.y = Math.sin(t * 0.5) * 0.3 + 0.2;
    this.hero.animate(dt, 0, {});
    this.floaters.forEach((f, i) => {
      f.position.y += Math.sin(t * 1.5 + i) * 0.004;
      f.rotation.y += dt * (0.4 + i * 0.1);
    });
    this.clouds.forEach((c, i) => { c.position.x += dt * (0.5 + i * 0.1); if (c.position.x > 50) c.position.x = -50; });
    this.flag.rotation.y = Math.sin(t * 3) * 0.2;
  }
}
