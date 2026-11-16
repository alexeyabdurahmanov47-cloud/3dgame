import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from '../core/gfx.js';

// Процедурные текстуры крови (canvas) и «запекание» декалей в несколько draw call'ов.
const TEX = {};
const BLOOD = ['#3d0303', '#520606', '#6b0a0a', '#7a0d0d'];

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function finish(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function splat(r) {
  const [c, x] = canvas(256, 256);
  const col = () => BLOOD[Math.floor(r() * BLOOD.length)];
  x.fillStyle = col();
  x.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2, rr = 50 + r() * 30;
    x[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr);
  }
  x.fill();
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 70 + r() * 50, s = 2 + r() * 9;
    x.fillStyle = col();
    x.beginPath(); x.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, s, 0, 7); x.fill();
    x.strokeStyle = col(); x.lineWidth = s * 0.7;
    x.beginPath(); x.moveTo(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60); x.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); x.stroke();
  }
  // блик «мокрой» крови
  x.globalAlpha = 0.18; x.fillStyle = '#ff9a8a';
  x.beginPath(); x.ellipse(110, 110, 20, 8, -0.6, 0, 7); x.fill();
  return finish(c);
}

function hand() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#5a0606';
  x.translate(128, 150);
  x.beginPath(); x.ellipse(0, 10, 46, 54, 0, 0, 7); x.fill();
  const fingers = [[-40, -40, 0.5, 52], [-18, -70, 0.15, 62], [6, -76, 0, 66], [30, -66, -0.15, 58], [56, -10, -0.9, 44]];
  for (const [fx, fy, rot, len] of fingers) {
    x.save(); x.translate(fx, fy); x.rotate(rot);
    x.beginPath(); x.roundRect(-9, -len / 2, 18, len, 9); x.fill();
    x.restore();
  }
  // подтёки вниз
  for (let i = 0; i < 4; i++) { x.fillRect(-30 + i * 18, 50, 5, 30 + i * 12); x.beginPath(); x.arc(-27 + i * 18, 82 + i * 12, 5, 0, 7); x.fill(); }
  return finish(c);
}

function foot() {
  const [c, x] = canvas(128, 256);
  x.fillStyle = '#4d0505';
  x.beginPath(); x.ellipse(64, 90, 34, 62, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(64, 200, 26, 34, 0, 0, 7); x.fill();
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) { x.fillRect(Math.random() * 128, Math.random() * 256, 6, 2); }
  return finish(c);
}

function drag() {
  const [c, x] = canvas(256, 128);
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(90,6,6,0)'); g.addColorStop(0.2, 'rgba(90,6,6,0.9)'); g.addColorStop(1, 'rgba(70,4,4,0.6)');
  x.fillStyle = g;
  for (let i = 0; i < 9; i++) { x.fillRect(0, 30 + i * 8 + Math.random() * 4, 256, 3 + Math.random() * 5); }
  return finish(c);
}

function drip() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#5a0505';
  x.beginPath(); x.ellipse(128, 40, 90, 30, 0, 0, 7); x.fill();
  for (let i = 0; i < 9; i++) {
    const px = 50 + i * 19 + Math.random() * 8, len = 40 + Math.random() * 170, w = 3 + Math.random() * 6;
    x.fillRect(px, 40, w, len);
    x.beginPath(); x.arc(px + w / 2, 40 + len, w * 0.9, 0, 7); x.fill();
  }
  return finish(c);
}

export function bloodTextures() {
  if (!TEX.splat) {
    const r = seeded(7);
    TEX.splat = [splat(r), splat(r), splat(r)];
    TEX.hand = hand();
    TEX.foot = foot();
    TEX.drag = drag();
    TEX.drip = drip();
  }
  return TEX;
}

// Надпись кровью (шрифт с подтёками, поддерживает кириллицу)
export function bloodText(text, w = 4, h = 1.2) {
  const [c, x] = canvas(1024, Math.round(1024 * (h / w)));
  const size = Math.min(c.height * 0.6, (c.width * 1.6) / Math.max(4, text.length));
  x.font = `${Math.round(size)}px "Rubik Wet Paint", "Impact", sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#7a0a0a';
  x.shadowColor = 'rgba(40,0,0,0.8)';
  x.shadowBlur = 8;
  x.fillText(text, c.width / 2, c.height / 2, c.width - 40);
  // подтёки
  x.shadowBlur = 0;
  for (let i = 0; i < text.length * 1.4; i++) {
    const px = 60 + Math.random() * (c.width - 120), len = 20 + Math.random() * c.height * 0.4;
    x.fillRect(px, c.height * 0.62, 3 + Math.random() * 4, len);
  }
  const tex = finish(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.material.userData.own = true;
  return m;
}

// Сборщик декалей: add(kind, pos, normalAxis, size, rot) → bake() даёт по одному мешу на текстуру.
export class DecalBatch {
  constructor() { this.parts = new Map(); }
  add(tex, x, y, z, { face = 'floor', w = 1, h = 1, rot = 0 } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (face === 'floor') q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rot, 'XYZ'));
    else if (face === '+z') q.setFromEuler(new THREE.Euler(0, 0, rot));
    else if (face === '-z') q.setFromEuler(new THREE.Euler(0, Math.PI, rot));
    else if (face === '+x') q.setFromEuler(new THREE.Euler(0, Math.PI / 2, rot));
    else if (face === '-x') q.setFromEuler(new THREE.Euler(0, -Math.PI / 2, rot));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    if (!this.parts.has(tex)) this.parts.set(tex, []);
    this.parts.get(tex).push(g);
  }
  bake(parent) {
    for (const [tex, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.28, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      mat.userData.own = true;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.renderOrder = 2;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.parts.clear();
  }
}

// Текстура разбитого стекла для окон
let glassTex = null;
export function brokenGlass() {
  if (glassTex) return glassTex;
  const [c, x] = canvas(256, 256);
  x.fillStyle = 'rgba(120,140,160,0.35)';
  x.fillRect(0, 0, 256, 256);
  x.globalCompositeOperation = 'destination-out';
  x.beginPath();
  x.moveTo(128, 120);
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = 40 + Math.random() * 70; x.lineTo(128 + Math.cos(a) * rr, 120 + Math.sin(a) * rr); }
  x.fill();
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = 'rgba(200,215,230,0.6)';
  x.lineWidth = 2;
  for (let i = 0; i < 10; i++) { const a = Math.random() * 7; x.beginPath(); x.moveTo(128, 120); x.lineTo(128 + Math.cos(a) * 200, 120 + Math.sin(a) * 200); x.stroke(); }
  glassTex = finish(c);
  return glassTex;
}
