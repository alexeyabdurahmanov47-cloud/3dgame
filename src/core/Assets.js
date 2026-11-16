import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Модели, созданные в Blender 5.2 (скрипты в папке blender/) и экспортированные в public/models/*.glb
const FILES = { character: 'models/character.glb', dog: 'models/dog.glb', cat: 'models/cat.glb' };

export const Assets = {
  gltf: {},
  async load(onProgress) {
    const loader = new GLTFLoader();
    const names = Object.keys(FILES);
    let done = 0;
    await Promise.all(names.map((n) => new Promise((res, rej) => {
      loader.load(FILES[n], (g) => {
        g.scene.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; if (o.material) o.material.userData.shared = true; });
        this.gltf[n] = g; done++; onProgress && onProgress(done / names.length); res(); }, undefined, rej);
    })));
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
