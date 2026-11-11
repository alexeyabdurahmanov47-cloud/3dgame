import * as THREE from 'three';
import { CharacterModel } from '../player/CharacterModel.js';
import { mat } from '../core/gfx.js';

// Отдельный маленький рендерер для предпросмотра персонажа в магазине
export class Preview {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    this.camera.position.set(0, 1.3, 4.6);
    this.camera.lookAt(0, 0.95, 0);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b0a0ff', 1.3));
    const d = new THREE.DirectionalLight('#ffffff', 1.4);
    d.position.set(2, 4, 3);
    this.scene.add(d);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.15, 24), mat('#ffffff'));
    disc.position.y = -0.08;
    this.scene.add(disc);
    this.model = new CharacterModel();
    this.scene.add(this.model.root);
    this.rot = 0.5;
    this.vel = 0;
    this.running = false;
    let drag = false, lx = 0;
    const down = (x) => { drag = true; lx = x; };
    const move = (x) => { if (drag) { this.vel = (x - lx) * 0.01; this.rot += this.vel; lx = x; } };
    this.canvas.addEventListener('mousedown', (e) => down(e.clientX));
    addEventListener('mousemove', (e) => move(e.clientX));
    addEventListener('mouseup', () => (drag = false));
    this.canvas.addEventListener('touchstart', (e) => down(e.touches[0].clientX), { passive: true });
    this.canvas.addEventListener('touchmove', (e) => move(e.touches[0].clientX), { passive: true });
    this.canvas.addEventListener('touchend', () => (drag = false));
    this.isDrag = () => drag;
  }

  setLook(look) {
    this.model.build(look);
    this.model.wave = 1.2;
    this.jump = 0.4;
  }

  start(container) {
    container.prepend(this.canvas);
    this.container = container;
    this.running = true;
    const clock = new THREE.Clock();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      const w = container.clientWidth, hgt = container.clientHeight;
      if (w && hgt && (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio()) || this._h !== hgt)) {
        this.renderer.setSize(w, hgt, false);
        this.camera.aspect = w / hgt;
        this.camera.updateProjectionMatrix();
        this._h = hgt;
      }
      if (!this.isDrag()) { this.vel *= 0.95; this.rot += dt * 0.6 + this.vel; }
      this.model.root.rotation.y = this.rot;
      if (this.jump > 0) {
        this.jump -= dt;
        this.model.root.position.y = Math.sin((0.4 - this.jump) / 0.4 * Math.PI) * 0.25;
      } else this.model.root.position.y = 0;
      this.model.animate(dt, 0, { onGround: this.jump <= 0 });
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() { this.running = false; }
}
