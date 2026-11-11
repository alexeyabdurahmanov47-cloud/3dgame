import * as THREE from 'three';

// Общий кэш материалов — низкополигональный flat‑стиль
const cache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    const { emissive, transparent, opacity, basic, side } = opts;
    m = basic
      ? new THREE.MeshBasicMaterial({ color, transparent: !!transparent, opacity: opacity ?? 1, side: side ?? THREE.FrontSide })
      : new THREE.MeshLambertMaterial({
          color,
          flatShading: true,
          emissive: emissive || 0x000000,
          transparent: !!transparent,
          opacity: opacity ?? 1,
          side: side ?? THREE.FrontSide,
        });
    m.userData.shared = true;
    cache.set(key, m);
  }
  return m;
}

export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : mat(color, opts));
  m.castShadow = true;
  return m;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Текстура с надписью (таблички, доски, вывески)
export function textTexture(lines, o = {}) {
  const { w = 512, h = 256, bg = '#ffffff', fg = '#2d3436', font = 'bold 72px Nunito, Arial, sans-serif', radius = 24, border = null, sub = null } = o;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 12;
    roundRect(ctx, 6, 6, w - 12, h - 12, radius);
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = h / (arr.length + 0.4);
  const base = parseInt((font.match(/(\d+)px/) || [0, 72])[1]);
  arr.forEach((t, i) => {
    const size = Math.round(Math.min(base * (i === 0 ? 1 : 0.62), lh * (i === 0 ? 0.85 : 0.7)));
    ctx.font = font.replace(/\d+px/, size + 'px');
    ctx.fillStyle = i === 0 ? fg : sub || fg;
    ctx.fillText(t, w / 2, lh * (i + 0.7), w - 30);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function textPlane(lines, width, height, o = {}) {
  const res = o.res || 1;
  const H = Math.round(512 * res);
  const font = (o.font || 'bold 250px Nunito, Arial, sans-serif').replace(/(\d+)px/, (m, n) => Math.round(n * res) + 'px');
  const tex = textTexture(lines, { w: Math.min(2048, Math.round(H * (width / height))), radius: Math.round(24 * res), ...o, h: H, font });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return m;
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach((m) => {
      if (m.userData?.shared) return;
      if (m.map) m.map.dispose();
      m.dispose();
    });
  });
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function angleDamp(a, b, lambda, dt) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}
// Детерминированный генератор случайных чисел (чтобы улица всегда выглядела одинаково)
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
