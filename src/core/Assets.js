import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Модели, созданные в Blender 5.2 (скрипты в папке blender/) и экспортированные в public/models/*.glb
const FILES = { character: 'models/character.glb', dog: 'models/dog.glb', cat: 'models/cat.glb', props: 'models/props.glb' };
// Модели хоррор-режима — загружаются только при его запуске
const EXTRA = { teacher: 'models/teacher.glb', shadow: 'models/shadow.glb', headmaster: 'models/headmaster.glb', jack: 'models/jack.glb',
  hero_web: 'models/hero_web.glb', wanderer: 'models/wanderer.glb', folk_girl: 'models/folk_girl.glb', bear: 'models/bear.glb', grin_cat: 'models/grin_cat.glb' };
export const SPECIAL_MODELS = ['hero_web', 'wanderer', 'folk_girl', 'bear', 'grin_cat'];

// Процедурная карта нормалей ткани (плетение + шум) — для одежды персонажей
let fabricTex = null;
function fabricNormal() {
  if (fabricTex) return fabricTex;
  const N = 256, hgt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const wx = Math.sin((x / N) * Math.PI * 2 * 24), wy = Math.sin((y / N) * Math.PI * 2 * 24);
    const weave = ((Math.floor(x / (N / 48)) + Math.floor(y / (N / 48))) % 2 ? wx : wy) * 0.5;
    hgt[y * N + x] = weave + (Math.random() - 0.5) * 0.35;
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N);
  const H = (x, y) => hgt[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 1.2, dy = (H(x, y + 1) - H(x, y - 1)) * 1.2;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  fabricTex = new THREE.CanvasTexture(c);
  fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
  fabricTex.repeat.set(5, 5);
  fabricTex.userData.shared = true;
  return fabricTex;
}
const FABRIC = new Set(['Body', 'Pants', 'Coat', 'Dress', 'Suit', 'Suit2', 'Scarf', 'Beanie', 'Blouse', 'Patch', 'Hat']);
export function decorate(g) {
  g.scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (FABRIC.has(m.name) && !m.normalMap && o.geometry.attributes.uv) { m.normalMap = fabricNormal(); m.normalScale.set(0.45, 0.45); m.needsUpdate = true; }
  });
}

export const Assets = {
  gltf: {},
  async load(onProgress) {
    const loader = new GLTFLoader();
    const names = Object.keys(FILES);
    let done = 0;
    await Promise.all(names.map((n) => new Promise((res, rej) => {
      loader.load(FILES[n], (g) => {
        g.scene.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; if (o.material) o.material.userData.shared = true; });
        decorate(g); this.gltf[n] = g; done++; onProgress && onProgress(done / names.length); res(); }, undefined, rej);
    })));
  },
  async ensure(names) {
    const loader = new GLTFLoader();
    await Promise.all(names.filter((n) => !this.gltf[n]).map((n) => new Promise((res, rej) => {
      loader.load(EXTRA[n], (g) => {
        g.scene.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; if (o.material) o.material.userData.shared = true; });
        decorate(g); this.gltf[n] = g; res();
      }, undefined, rej);
    })));
  },
  // Узел окружения из props.glb (дерево, машина, парта, здание…)
  prop(name) {
    const g = this.gltf.props;
    if (!g) return null;
    if (!this._props) { g.scene.updateMatrixWorld(true); this._props = {}; g.scene.children.forEach((c) => (this._props[c.name] = c)); }
    return this._props[name] || null;
  },
  // Отдельная копия объекта окружения (для движущихся машин). colors: { ИмяМатериала: '#hex' }
  propClone(name, colors = {}) {
    const src = this.prop(name);
    const o = src.clone(true);
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      if (colors[m.material.name]) { m.material = m.material.clone(); m.material.userData = { own: true }; m.material.color.set(colors[m.material.name]); }
    });
    return o;
  },
  // Независимая копия модели со своим скелетом и анимациями
  instance(name) {
    const g = this.gltf[name];
    const scene = SkeletonUtils.clone(g.scene);
    scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(scene);
    const actions = {};
    for (const clip of g.animations) actions[clip.name] = mixer.clipAction(clip);
    return { scene, mixer, actions };
  },
};

// Животное с анимациями Idle / Walk / Happy
export function animal(name) {
  const inst = Assets.instance(name);
  let cur = null;
  const play = (n, ts = 1) => {
    const a = inst.actions[n];
    if (!a) return;
    a.timeScale = ts;
    if (cur === n) return;
    a.reset().fadeIn(0.2).play();
    if (cur) inst.actions[cur].fadeOut(0.2);
    cur = n;
  };
  play('Idle');
  inst.actions.Idle.time = Math.random() * 2;
  return { root: inst.scene, play, update: (dt) => inst.mixer.update(dt) };
}
