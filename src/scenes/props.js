import * as THREE from 'three';
import { mat, textPlane, seeded } from '../core/gfx.js';

// Набор «префабов» из примитивов. s — экземпляр BaseScene.
const G = {
  trunk: new THREE.CylinderGeometry(0.15, 0.22, 1, 6),
  crown: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 7),
  sphere: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  petal: new THREE.IcosahedronGeometry(0.09, 0),
};

const TREE_COLORS = ['#3cb371', '#2ecc71', '#27ae60', '#7bc043', '#55a630'];
const FLOWER_COLORS = ['#ff6b6b', '#feca57', '#ff9ff3', '#ffffff', '#a29bfe', '#ff9f43'];

export function tree(s, x, z, sc = 1, kind = 'round', y = 0, rnd = Math.random) {
  const h = 1.4 * sc;
  s.geo(G.trunk, '#8d5524', x, y + h / 2, z, { sx: sc, sy: h, sz: sc });
  const c = TREE_COLORS[Math.floor(rnd() * TREE_COLORS.length)];
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) s.geo(G.cone, '#1e8449', x, y + h + 0.6 * sc + i * 0.75 * sc, z, { sx: (1.5 - i * 0.35) * sc, sy: 1.4 * sc, sz: (1.5 - i * 0.35) * sc });
  } else {
    s.geo(G.crown, c, x, y + h + 0.9 * sc, z, { sx: 1.4 * sc, sy: 1.3 * sc, sz: 1.4 * sc, ry: rnd() * 3 });
    s.geo(G.crown, c, x + 0.5 * sc, y + h + 0.5 * sc, z + 0.3 * sc, { sx: 0.9 * sc, sy: 0.8 * sc, sz: 0.9 * sc, ry: rnd() * 3 });
  }
  s.world.addBox(x - 0.25 * sc, x + 0.25 * sc, y, y + 3, z - 0.25 * sc, z + 0.25 * sc, { camera: false });
  s.mapRects.push({ x, z, w: 1.6 * sc, d: 1.6 * sc, color: '#2e8b57', y, round: true });
}

export function bush(s, x, z, sc = 1, y = 0) {
  s.geo(G.crown, '#2ecc71', x, y + 0.4 * sc, z, { sx: 0.8 * sc, sy: 0.55 * sc, sz: 0.8 * sc, ry: x });
}

export function flowers(s, x, z, w, d, count = 10, y = 0, rnd = Math.random) {
  s.box(x, y, z, w, 0.12, d, '#6d4c41', { cast: false });
  for (let i = 0; i < count; i++) {
    const fx = x + (rnd() - 0.5) * (w - 0.2), fz = z + (rnd() - 0.5) * (d - 0.2);
    s.geo(G.cyl, '#2d8a3e', fx, y + 0.3, fz, { sx: 0.02, sy: 0.4, sz: 0.02, cast: false });
    s.geo(G.petal, FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)], fx, y + 0.52, fz, { sx: 1.3, sy: 0.8, sz: 1.3, cast: false });
  }
}

export function bench(s, x, z, rotY = 0, y = 0) {
  const along = Math.abs(Math.sin(rotY)) > 0.5; // повернута на 90°
  const w = 1.8, d = 0.5;
  const W = along ? d : w, D = along ? w : d;
  s.box(x, y + 0.42, z, W, 0.08, D, '#c0763b');
  const bx = x - Math.sin(rotY) * 0.25, bz = z - Math.cos(rotY) * 0.25;
  s.box(bx, y + 0.5, bz, along ? 0.08 : w, 0.45, along ? w : 0.08, '#c0763b');
  for (const sd of [-0.75, 0.75]) {
    s.box(x + (along ? 0 : sd), y, z + (along ? sd : 0), along ? d : 0.08, 0.42, along ? 0.08 : d, '#4a4a4a');
  }
  s.world.addBox(x - W / 2, x + W / 2, y, y + 0.9, z - D / 2, z + D / 2, { camera: false });
}

export function lamp(s, x, z, y = 0) {
  s.geo(G.cyl, '#3d3d3d', x, y + 1.8, z, { sx: 0.07, sy: 3.6, sz: 0.07 });
  s.geo(G.box, '#3d3d3d', x, y + 3.6, z, { sx: 0.5, sy: 0.12, sz: 0.5 });
  s.geo(G.sphere, '#fff7d6', x, y + 3.4, z, { sx: 0.22, sy: 0.22, sz: 0.22, emissive: '#d8c27a' });
  s.world.addBox(x - 0.12, x + 0.12, y, y + 3.6, z - 0.12, z + 0.12, { camera: false });
}

export function fence(s, x1, z1, x2, z2, color = '#f5f6fa', y = 0) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(2, Math.round(len / 1.2));
  const ang = Math.atan2(x2 - x1, z2 - z1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    s.geo(G.box, color, x1 + (x2 - x1) * t, y + 0.45, z1 + (z2 - z1) * t, { sx: 0.12, sy: 0.9, sz: 0.12 });
  }
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  s.geo(G.box, color, cx, y + 0.65, cz, { sx: 0.06, sy: 0.1, sz: len, ry: ang });
  s.geo(G.box, color, cx, y + 0.3, cz, { sx: 0.06, sy: 0.1, sz: len, ry: ang });
  const minX = Math.min(x1, x2) - 0.1, maxX = Math.max(x1, x2) + 0.1;
  const minZ = Math.min(z1, z2) - 0.1, maxZ = Math.max(z1, z2) + 0.1;
  s.world.addBox(minX, maxX, y, y + 1, minZ, maxZ, { camera: false });
}

// Окно на стене. axis: 'x' — стена вдоль оси X (окно смотрит по Z)
export function windowPane(s, x, y, z, w, h, axis = 'x', frame = '#ffffff') {
  const t = 0.05;
  if (axis === 'x') {
    s.box(x, y, z, w, h, 0.26, frame, { cast: false });
    s.box(x, y + 0.08, z, w - 0.16, h - 0.16, 0.3, '#9ad8ff', { cast: false, emissive: '#3f7ea8' });
    s.box(x, y + h / 2 - t / 2, z, w - 0.1, t, 0.32, frame, { cast: false });
  } else {
    s.box(x, y, z, 0.26, h, w, frame, { cast: false });
    s.box(x, y + 0.08, z, 0.3, h - 0.16, w - 0.16, '#9ad8ff', { cast: false, emissive: '#3f7ea8' });
    s.box(x, y + h / 2 - t / 2, z, 0.32, t, w - 0.1, frame, { cast: false });
  }
}

export function plant(s, x, y, z, sc = 1) {
  s.geo(G.cyl, '#d35400', x, y + 0.25 * sc, z, { sx: 0.25 * sc, sy: 0.5 * sc, sz: 0.25 * sc });
  s.geo(G.crown, '#27ae60', x, y + 0.75 * sc, z, { sx: 0.35 * sc, sy: 0.5 * sc, sz: 0.35 * sc, ry: x * 3 });
  s.geo(G.crown, '#2ecc71', x + 0.1, y + 0.95 * sc, z - 0.05, { sx: 0.22 * sc, sy: 0.35 * sc, sz: 0.22 * sc, ry: z });
  s.world.addBox(x - 0.25 * sc, x + 0.25 * sc, y, y + 1, z - 0.25 * sc, z + 0.25 * sc, { camera: false });
}

// Парта со стулом. facing: +1 — ученик смотрит в +Z, -1 — в -Z
export function desk(s, x, y, z, facing = 1, color = '#e8c18f') {
  s.box(x, y + 0.72, z, 1.3, 0.06, 0.6, color);
  for (const dx of [-0.58, 0.58]) s.box(x + dx, y, z, 0.06, 0.72, 0.5, '#7f8c8d');
  const cz = z - facing * 0.55;
  s.box(x, y + 0.42, cz, 0.45, 0.06, 0.42, '#3498db');
  s.box(x, y + 0.45, cz - facing * 0.21, 0.45, 0.45, 0.05, '#3498db');
  s.box(x, y, cz, 0.38, 0.42, 0.36, '#7f8c8d', { cast: false });
  s.world.addBox(x - 0.65, x + 0.65, y, y + 0.78, z - 0.3, z + 0.3, { camera: false });
  return { seat: new THREE.Vector3(x, y, cz) };
}

export function signText(s, text, x, y, z, w, h, rotY = 0, o = {}) {
  const p = textPlane(text, w, h, o);
  p.position.set(x, y, z);
  p.rotation.y = rotY;
  s.addObj(p);
  return p;
}

// Указатель «Иди сюда»
export function signpost(s, x, z, rotY, text = 'Иди сюда →', y = 0) {
  s.geo(G.cyl, '#6d4c41', x, y + 1.1, z, { sx: 0.08, sy: 2.2, sz: 0.08 });
  const board = new THREE.Group();
  board.position.set(x, y + 1.9, z);
  board.rotation.y = rotY;
  const b = new THREE.Mesh(G.box, mat('#ffd32a'));
  b.scale.set(1.8, 0.5, 0.08);
  b.castShadow = true;
  board.add(b);
  const t1 = textPlane(text, 1.7, 0.45, { bg: null, fg: '#2d3436' });
  t1.position.z = 0.05;
  const t2 = t1.clone();
  t2.position.z = -0.05;
  t2.rotation.y = Math.PI;
  board.add(t1, t2);
  s.addObj(board);
  s.world.addBox(x - 0.1, x + 0.1, y, y + 2.2, z - 0.1, z + 0.1, { camera: false });
}

// Плоская стрелка на земле
const arrowGeo = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.7);
  sh.lineTo(0.55, 0);
  sh.lineTo(0.25, 0);
  sh.lineTo(0.25, -0.6);
  sh.lineTo(-0.25, -0.6);
  sh.lineTo(-0.25, 0);
  sh.lineTo(-0.55, 0);
  sh.closePath();
  const geo = new THREE.ShapeGeometry(sh);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
export function groundArrow(s, x, y, z, dirX, dirZ) {
  const m = new THREE.Mesh(arrowGeo, mat('#ffe066', { basic: true, transparent: true, opacity: 0.95 }));
  m.position.set(x, y + 0.04, z);
  m.rotation.y = Math.atan2(dirX, dirZ) + Math.PI;
  m.renderOrder = 1;
  s.addObj(m);
  return m;
}

export function house(s, x, z, w, d, h, color, roof = '#c0392b', rnd = seeded(Math.round(x * 13 + z * 7))) {
  s.box(x, 0, z, w, h, d, color, { collide: true, map: '#b2bec3' });
  s.geo(G.cone, roof, x, h + 1, z, { sx: Math.max(w, d) * 0.75, sy: 2, sz: Math.max(w, d) * 0.75, ry: Math.PI / 4 });
  const floors = Math.floor(h / 3);
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < Math.floor(w / 3); i++) {
      const wx = x - w / 2 + 1.5 + i * 3;
      const lit = rnd() > 0.7;
      s.box(wx, f * 3 + 1, z + d / 2 + 0.02, 1.2, 1.3, 0.08, lit ? '#fff3b0' : '#9ad8ff', { cast: false });
      s.box(wx, f * 3 + 1, z - d / 2 - 0.02, 1.2, 1.3, 0.08, '#9ad8ff', { cast: false });
    }
  }
}

export function cloud(s, x, y, z, sc = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(G.sphere, mat('#ffffff'));
    m.scale.setScalar(sc * (1.2 + (i % 2) * 0.6));
    m.position.set((i - 1.5) * sc * 1.4, (i % 2) * sc * 0.5, (i % 3) * sc * 0.4);
    g.add(m);
  }
  g.position.set(x, y, z);
  s.addObj(g);
  return g;
}

export { G as GEO };
