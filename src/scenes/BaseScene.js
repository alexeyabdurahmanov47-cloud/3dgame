import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { World } from '../core/World.js';
import { mat, disposeObject } from '../core/gfx.js';

// Базовый класс локации. Статическая геометрия объединяется (батчится) по цвету,
// чтобы сократить число draw calls и держать 60 FPS.
export class BaseScene {
  constructor(game, name) {
    this.game = game;
    this.name = name;
    this.title = name;
    this.scene = new THREE.Scene();
    this.world = new World();
    this.interactables = [];
    this.labels = [];
    this.points = {};
    this.spawns = {};
    this.mapRects = [];
    this.updaters = [];
    this.nav = {}; // sceneName -> pointName (куда идти, если цель в другой локации)
    this.cameraDist = 5;
    this.mapZoom = 4; // пикселей на метр на мини‑карте
    this.batches = new Map();
    this.layers = {}; // слои (этажи), которые можно скрывать
    this.curLayer = null;
    this.indoor = false;
  }

  // ---------- слои‑этажи («кукольный домик») ----------
  layer(name) {
    if (name && !this.layers[name]) {
      const g = new THREE.Group();
      g.name = name;
      this.scene.add(g);
      this.layers[name] = { group: g, colliders: [], visible: true };
    }
    this.curLayer = name;
  }

  addObj(o) {
    (this.curLayer ? this.layers[this.curLayer].group : this.scene).add(o);
    return o;
  }

  setLayerVisible(name, v) {
    const L = this.layers[name];
    if (!L || L.visible === v) return;
    L.visible = v;
    L.group.visible = v;
    for (const c of L.colliders) c.camera = v && c.cam0;
  }

  // ---------- построение ----------
  setupLights({ sky = '#8fd3ff', fog = null, sun = true, hemi = 0.9, shadowSize = 30, sunPos = [30, 50, 20], ambient = 0 } = {}) {
    this.scene.background = new THREE.Color(sky);
    if (fog) this.scene.fog = new THREE.Fog(sky, fog[0], fog[1]);
    const h = new THREE.HemisphereLight('#ffffff', '#8a7f6a', hemi);
    this.scene.add(h);
    if (ambient) this.scene.add(new THREE.AmbientLight('#ffffff', ambient));
    if (sun) {
      const d = new THREE.DirectionalLight('#fff4e0', 1.6);
      d.position.set(...sunPos);
      d.castShadow = this.game.quality === 'high';
      d.shadow.mapSize.set(2048, 2048);
      const s = shadowSize;
      Object.assign(d.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 150 });
      d.shadow.bias = -0.0006;
      d.shadow.normalBias = 0.02;
      this.scene.add(d, d.target);
      this.sun = d;
      this.sunOffset = new THREE.Vector3(...sunPos);
    }
  }

  // Прямоугольный блок. x,z — центр; y — низ.
  box(x, y, z, w, h, d, color, o = {}) {
    const { collide = false, walk = false, map = null, cast = true, dynamic = false, rotY = 0, emissive = null, cam = true, parent = null } = o;
    let m = null;
    if (dynamic) {
      m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive ? { emissive } : {}));
      m.position.set(x, y + h / 2, z);
      m.rotation.y = rotY;
      m.castShadow = cast;
      m.receiveShadow = true;
      if (parent) parent.add(m); else this.addObj(m);
    } else {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (rotY) geo.rotateY(rotY);
      geo.translate(x, y + h / 2, z);
      this.addStatic(geo, color, cast, emissive);
    }
    let col = null;
    if (collide) {
      col = this.world.addBox(x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2, { camera: cam, cam0: cam });
      if (this.curLayer) this.layers[this.curLayer].colliders.push(col);
    }
    if (walk) this.world.addSurface(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h);
    if (map) this.mapRects.push({ x, z, w, d, color: map === true ? color : map, y: y + h, y0: y });
    return m || col;
  }

  // Стена вдоль оси X (на линии z) с проёмами gaps: [[x1,x2], ...]
  wallX(z, x1, x2, y, h, color, gaps = [], { t = 0.2, gapH = 2.3, map = '#4b4b6b' } = {}) {
    let cur = x1;
    const segs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b] of segs) {
      if (a > cur) this.box((cur + a) / 2, y, z, a - cur, h, t, color, { collide: true, map });
      if (gapH < h) this.box((a + b) / 2, y + gapH, z, b - a, h - gapH, t, color, { collide: true });
      cur = b;
    }
    if (x2 > cur) this.box((cur + x2) / 2, y, z, x2 - cur, h, t, color, { collide: true, map });
  }

  // Стена вдоль оси Z (на линии x)
  wallZ(x, z1, z2, y, h, color, gaps = [], { t = 0.2, gapH = 2.3, map = '#4b4b6b' } = {}) {
    let cur = z1;
    const segs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b] of segs) {
      if (a > cur) this.box(x, y, (cur + a) / 2, t, h, a - cur, color, { collide: true, map });
      if (gapH < h) this.box(x, y + gapH, (a + b) / 2, t, h - gapH, b - a, color, { collide: true });
      cur = b;
    }
    if (z2 > cur) this.box(x, y, (cur + z2) / 2, t, h, z2 - cur, color, { collide: true, map });
  }

  // Лестница‑пандус со ступеньками вдоль X. Возвращает высоту подъёма.
  stairsX(x1, x2, z1, z2, y0, y1, color = '#c8925a', steps = 10) {
    const dir = x2 > x1 ? 1 : -1;
    const len = Math.abs(x2 - x1), rise = y1 - y0, sw = len / steps, sh = rise / steps;
    const zc = (z1 + z2) / 2, zw = Math.abs(z2 - z1);
    for (let i = 0; i < steps; i++) {
      const cx = x1 + dir * (i + 0.5) * sw;
      this.box(cx, y0, zc, sw, sh * (i + 1), zw, color);
      if (i >= 3) {
        const top = y0 + sh * (i + 1) - 0.65;
        this.world.addBox(cx - sw / 2, cx + sw / 2, y0, top, Math.min(z1, z2), Math.max(z1, z2), { camera: false });
      }
    }
    this.world.addRamp(Math.min(x1, x2), Math.max(x1, x2), Math.min(z1, z2), Math.max(z1, z2), 'x', dir > 0 ? y0 : y1, dir > 0 ? y1 : y0);
    this.mapRects.push({ x: (x1 + x2) / 2, z: zc, w: len, d: zw, color: '#e1b382', y: y0, y0 });
  }

  // Лестница‑пандус вдоль Z
  stairsZ(x1, x2, z1, z2, y0, y1, color = '#c8925a', steps = 12) {
    const dir = z2 > z1 ? 1 : -1;
    const len = Math.abs(z2 - z1), rise = y1 - y0, sw = len / steps, sh = rise / steps;
    const xc = (x1 + x2) / 2, xw = Math.abs(x2 - x1);
    for (let i = 0; i < steps; i++) {
      const cz = z1 + dir * (i + 0.5) * sw;
      // ступенька — только верхняя часть, чтобы под лестницей был проход
      const top = y0 + sh * (i + 1);
      this.box(xc, Math.max(y0, top - 0.6), cz, xw, top - Math.max(y0, top - 0.6), sw, color);
    }
    this.world.addRamp(Math.min(x1, x2), Math.max(x1, x2), Math.min(z1, z2), Math.max(z1, z2), 'z', dir > 0 ? y0 : y1, dir > 0 ? y1 : y0);
    this.mapRects.push({ x: xc, z: (z1 + z2) / 2, w: xw, d: len, color: '#e1b382', y: y0, y0 });
  }

  addStatic(geo, color, cast = true, emissive = null) {
    // все геометрии в батче должны иметь одинаковый набор атрибутов
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
    const key = `${color}|${cast}|${emissive || ''}|${this.curLayer || ''}`;
    if (!this.batches.has(key)) this.batches.set(key, { color, cast, emissive, geos: [], layer: this.curLayer });
    this.batches.get(key).geos.push(geo);
  }

  // Произвольная статическая геометрия с трансформацией
  geo(geometry, color, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true, emissive = null } = {}) {
    const g2 = geometry.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    g2.applyMatrix4(m);
    this.addStatic(g2, color, cast, emissive);
  }

  finalize() {
    for (const b of this.batches.values()) {
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((gg) => gg.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat(b.color, b.emissive ? { emissive: b.emissive } : {}));
      m.castShadow = b.cast;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      (b.layer ? this.layers[b.layer].group : this.scene).add(m);
    }
    this.batches.clear();
    this.curLayer = null;
  }

  // ---------- игровые объекты ----------
  point(name, x, y, z) { this.points[name] = new THREE.Vector3(x, y, z); return this.points[name]; }
  spawn(name, x, y, z, yaw = 0) { this.spawns[name] = { x, y, z, yaw }; }

  interact(def) {
    const it = { radius: 1.6, ...def };
    if (typeof it.enabled !== 'function') it.enabled = () => true;
    if (!(it.pos instanceof THREE.Vector3)) it.pos = new THREE.Vector3(...it.pos);
    this.interactables.push(it);
    return it;
  }

  label(pos, text, o = {}) {
    const l = { pos: pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos), text, maxDist: o.maxDist ?? 18, cls: o.cls || '', icon: o.icon || '', visible: o.visible ?? (() => true), el: null };
    this.labels.push(l);
    return l;
  }

  onUpdate(fn) { this.updaters.push(fn); }

  // ---------- жизненный цикл ----------
  build() {}
  enter() {}
  exit() {}

  update(dt) {
    for (const u of this.updaters) u(dt);
    if (this.sun && this.game.player) {
      const p = this.game.player.pos;
      this.sun.position.set(p.x + this.sunOffset.x, p.y + this.sunOffset.y, p.z + this.sunOffset.z);
      this.sun.target.position.set(p.x, p.y, p.z);
    }
  }

  // точка назначения на текущей локации для цели в другой локации
  navPoint(targetScene) {
    const n = this.nav[targetScene] || this.nav.default;
    return n ? this.points[n] : null;
  }

  dispose() {
    disposeObject(this.scene);
  }
}
