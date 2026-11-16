import * as THREE from 'three';
import { h } from '../ui/dom.js';

// Экранные эффекты: виньетка, плёночное зерно, урон, брызги крови на экране,
// жуткие сообщения, скримеры (с настройкой интенсивности), щели шкафчика, дым появления.
export class HorrorFX {
  constructor(mode) {
    this.mode = mode;
    this.game = mode.game;
    this.grain = h('canvas', { class: 'hz-grain', width: 480, height: 270 });
    this.vig = h('div', { class: 'hz-vignette' });
    this.dmg = h('div', { class: 'hz-damage' });
    this.blood = h('canvas', { class: 'hz-blood' });
    this.msg = h('div', { class: 'hz-msg' });
    this.slats = h('div', { class: 'hz-slats hidden' });
    this.scr = h('div', { class: 'hz-screamer hidden' });
    this.root = h('div', { class: 'hz-fx passthru' }, this.vig, this.grain, this.blood, this.dmg, this.slats, this.msg, this.scr);
    this.game.ui.root.append(this.root);
    this.gctx = this.grain.getContext('2d');
    this.bctx = this.blood.getContext('2d');
    this.resize();
    this._rs = () => this.resize();
    addEventListener('resize', this._rs);
    this.dmgV = 0;
    this.bloodA = 0;
    this.grainT = 0;
    this.smokes = [];
  }

  resize() { this.blood.width = innerWidth; this.blood.height = innerHeight; }

  dispose() {
    removeEventListener('resize', this._rs);
    this.root.remove();
    this.game.canvas.style.filter = '';
    this.smokes.forEach((s) => s.m.removeFromParent());
  }

  get gore() { return this.game.save.data.horror.gore !== 'low'; }
  get intensity() { return this.game.save.data.horror.screamers; }

  damage(amount) {
    this.dmgV = Math.min(1, this.dmgV + amount / 40);
    this.game.cam.shake = Math.min(0.5, 0.1 + amount / 120);
    if (this.gore) this.splat(Math.ceil(amount / 12));
  }

  // брызги крови на «объективе»
  splat(n = 2) {
    const c = this.bctx, W = this.blood.width, H = this.blood.height;
    for (let k = 0; k < n; k++) {
      const x = Math.random() < 0.5 ? Math.random() * W * 0.3 : W - Math.random() * W * 0.3;
      const y = Math.random() * H;
      const r = 40 + Math.random() * 90;
      c.fillStyle = `rgba(${90 + Math.random() * 40},0,0,0.85)`;
      c.beginPath(); c.arc(x, y, r * 0.5, 0, 7); c.fill();
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * 7, d = r * (0.5 + Math.random());
        c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + Math.random() * 8, 0, 7); c.fill();
      }
      for (let i = 0; i < 4; i++) c.fillRect(x - r * 0.3 + Math.random() * r * 0.6, y, 3 + Math.random() * 5, 40 + Math.random() * 120);
    }
    this.bloodA = 1;
  }

  message(text, ms = 2600, cls = '') {
    this.msg.className = 'hz-msg show ' + cls;
    this.msg.textContent = text;
    clearTimeout(this._mt);
    this._mt = setTimeout(() => (this.msg.className = 'hz-msg'), ms);
  }

  // скример: лицо монстра на весь экран. Интенсивность — настройка игрока.
  screamer(kind = 'teacher') {
    const lvl = this.intensity;
    const A = this.mode.audio;
    if (lvl === 'off') { this.dmgV = Math.max(this.dmgV, 0.6); return; }
    if (this.mode.puzzleOpen && lvl !== 'high') return;
    const ms = lvl === 'low' ? 380 : lvl === 'mid' ? 650 : 950;
    this.scr.className = `hz-screamer ${kind} ${lvl}`;
    this.scr.innerHTML = faceSVG(kind);
    if (lvl !== 'low') A.play('scream', A.bus); else A.play('stinger', A.bus);
    if (lvl === 'high') { A.play('stinger', A.bus); this.game.cam.shake = 0.6; }
    clearTimeout(this._st);
    this._st = setTimeout(() => (this.scr.className = 'hz-screamer hidden'), ms);
  }

  setHidden(on) { this.slats.classList.toggle('hidden', !on); }

  smoke(pos) {
    const s = this.mode.scene;
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + Math.random() * 0.3, 0), new THREE.MeshBasicMaterial({ color: '#050506', transparent: true, opacity: 0.7, depthWrite: false }));
      m.material.userData.own = true;
      m.position.set(pos.x + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.8, pos.z + (Math.random() - 0.5) * 0.8);
      s.scene.add(m);
      this.smokes.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8), t: 1.4 });
    }
  }

  update(dt) {
    const M = this.mode;
    // зерно
    this.grainT -= dt;
    if (this.grainT <= 0) {
      this.grainT = 0.06;
      const img = this.gctx.createImageData(480, 270);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 40; }
      this.gctx.putImageData(img, 0, 0);
    }
    // урон / низкое здоровье / погоня
    this.dmgV = Math.max(0, this.dmgV - dt * 0.9);
    const low = Math.max(0, 1 - M.hp / 45);
    const chase = M.tension;
    this.dmg.style.opacity = Math.min(1, this.dmgV + low * 0.45 * (0.7 + 0.3 * Math.sin(performance.now() / 180)));
    this.vig.style.opacity = 0.75 + chase * 0.25;
    this.vig.style.setProperty('--red', `${Math.round(chase * 60)}%`);
    if (this.bloodA > 0) {
      this.bloodA = Math.max(0, this.bloodA - dt * 0.12);
      this.blood.style.opacity = Math.min(1, this.bloodA * 1.5);
      if (this.bloodA === 0) this.bctx.clearRect(0, 0, this.blood.width, this.blood.height);
    }
    const sat = M.hidden ? 0.3 : Math.max(0.25, 1 - low * 0.7);
    this.game.canvas.style.filter = `saturate(${sat.toFixed(2)}) contrast(${(1.05 + chase * 0.15).toFixed(2)})`;
    // дым
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t -= dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.scale.multiplyScalar(1 + dt * 0.8);
      s.m.material.opacity = Math.max(0, s.t / 1.4) * 0.7;
      if (s.t <= 0) { s.m.removeFromParent(); s.m.geometry.dispose(); s.m.material.dispose(); this.smokes.splice(i, 1); }
    }
  }
}

// процедурные лица для скримеров (SVG)
function faceSVG(kind) {
  if (kind === 'shadow') {
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice"><rect width="400" height="400" fill="#000"/>
      <ellipse cx="200" cy="210" rx="150" ry="190" fill="#050507"/>
      <ellipse cx="140" cy="180" rx="22" ry="9" fill="#f4f8ff"/><ellipse cx="260" cy="180" rx="22" ry="9" fill="#f4f8ff"/>
      <path d="M120 290 Q200 330 280 290 Q200 400 120 290" fill="#000"/></svg>`;
  }
  if (kind === 'headmaster') {
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice"><rect width="400" height="400" fill="#120202"/>
      <ellipse cx="200" cy="200" rx="160" ry="200" fill="#e6e0d2"/>
      <path d="M215 20 L190 120 L230 180 L200 260" stroke="#140c0c" stroke-width="6" fill="none"/>
      <ellipse cx="135" cy="170" rx="38" ry="24" fill="#120808"/><ellipse cx="265" cy="170" rx="38" ry="24" fill="#120808"/>
      <circle cx="135" cy="170" r="9" fill="#ff1a0a"/><circle cx="265" cy="170" r="9" fill="#ff1a0a"/>
      <rect x="140" y="290" width="120" height="12" fill="#140c0c"/><path d="M130 200 Q128 300 140 380" stroke="#5a0606" stroke-width="7" fill="none"/></svg>`;
  }
  return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice"><rect width="400" height="400" fill="#0a0606"/>
    <ellipse cx="200" cy="200" rx="150" ry="200" fill="#8f9a8a"/>
    <ellipse cx="140" cy="165" rx="40" ry="34" fill="#050404"/><ellipse cx="260" cy="165" rx="40" ry="34" fill="#050404"/>
    <circle cx="146" cy="168" r="7" fill="#f2f0e6"/><circle cx="254" cy="168" r="7" fill="#f2f0e6"/>
    <circle cx="140" cy="165" r="46" fill="none" stroke="#9fb0b0" stroke-width="5"/><circle cx="260" cy="165" r="46" fill="none" stroke="#9fb0b0" stroke-width="5"/>
    <path d="M100 280 Q200 250 300 280 Q290 380 200 385 Q110 380 100 280" fill="#120607"/>
    ${Array.from({ length: 11 }, (_, i) => `<polygon points="${112 + i * 17},274 ${120 + i * 17},300 ${128 + i * 17},272" fill="#c9c2a8"/>`).join('')}
    <path d="M200 380 L205 400" stroke="#4a0606" stroke-width="10"/><path d="M60 40 Q120 0 200 10 Q300 0 340 60 L330 110 Q200 60 70 110Z" fill="#2a2622"/></svg>`;
}
