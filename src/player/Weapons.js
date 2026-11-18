import * as THREE from 'three';
import { h } from '../ui/dom.js';

// Оружие особых персонажей (у каждого своё). F или клик при захваченном курсоре.
// Оружие не убивает: оглушает грабителей (их сразу задерживают) и монстров хоррор-режима.
export const WEAPONS = {
  web: { name: 'Паутина', icon: '🕸️', anim: 'Shoot', range: 11, cd: 1.0, stun: 4, kind: 'shot', sound: 'web', color: '#eef2fb' },
  staff: { name: 'Посох', icon: '🦯', anim: 'Attack', range: 2.5, cd: 0.8, stun: 2.5, kind: 'melee', sound: 'swing', color: '#c9a070' },
  pan: { name: 'Сковородка', icon: '🍳', anim: 'Attack', range: 2.1, cd: 0.65, stun: 3, kind: 'melee', sound: 'bong', color: '#e0e0e0' },
  log: { name: 'Бревно + рёв', icon: '🪵', anim: 'Attack', range: 3, cd: 1.4, stun: 3.5, kind: 'melee', sound: 'roar', area: 4, color: '#a0703a' },
  mallet: { name: 'Мульт-молот', icon: '🔨', anim: 'Attack', range: 2.7, cd: 1.0, stun: 3.5, kind: 'melee', sound: 'boing', stars: true, color: '#ff5050' },
};

export class Weapons {
  constructor(game) {
    this.game = game;
    this.cool = 0;
    this.fx = [];
    this.icon = h('span', { class: 'ic' }, '');
    this.name = h('span', { class: 'nm' }, '');
    this.bar = h('div', { class: 'cd' }, h('div'));
    this.el = h('button', { class: 'weapon-chip hidden', onclick: () => this.fire() }, this.icon, h('div', {}, this.name, this.bar), h('span', { class: 'key' }, game.input.isTouch ? '👊' : 'F'));
    game.hud.el.append(this.el);
  }

  get def() { const w = this.game.player.model.weapon; return w ? WEAPONS[w] : null; }

  // цели рядом: грабители (налёт), монстры (хоррор)
  targets() {
    const g = this.game, out = [];
    if (g.raid.active()) for (const r of g.raid.robbers) if (!r.caught) out.push({ pos: r.pos, hit: () => g.raid.catchRobber(r) });
    if (g.horror.active && g.horror.ready) {
      for (const m of g.horror.monsters) {
        if (m.kind === 'shadow') { if (m.state === 'stalk') out.push({ pos: m.pos, hit: () => m.vanish() }); continue; }
        if (m.kind === 'headmaster') { if (m.state !== 'dead' && m.state !== 'dying') out.push({ pos: m.pos, hit: (st) => { m.state = 'stun'; m.stateT = -st * 0.4; m.play('Idle'); } }); continue; }
        out.push({ pos: m.pos, hit: (st) => { m.setState('stunned'); m.stateT = -st; m.play('Idle'); m.aware = 0.6; } });
      }
    }
    return out;
  }

  fire() {
    const g = this.game, W = this.def, P = g.player;
    if (!W || this.cool > 0 || g.state !== 'play' || P.frozen) return false;
    this.cool = W.cd * (g.horror.active ? 2.5 : 1);
    P.model.attack = W.anim === 'Shoot' ? 0.5 : 0.7;
    P.model.attackName = W.anim;
    P.model.attackStart = true;
    g.audio.play(W.sound);
    const p = P.pos;
    const fx = Math.sin(P.facing), fz = Math.cos(P.facing);
    let best = null, bd = Infinity;
    const hits = [];
    for (const t of this.targets()) {
      const dx = t.pos.x - p.x, dz = t.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > W.range) continue;
      const front = (dx * fx + dz * fz) / (d || 1);
      if (W.area && d < W.area) { hits.push(t); continue; }
      if (front < (W.kind === 'shot' ? 0.8 : 0.35) && d > 1.2) continue;
      if (d < bd) { bd = d; best = t; }
    }
    if (best && !hits.includes(best)) hits.push(best);
    const to = best ? new THREE.Vector3(best.pos.x, 1.1, best.pos.z) : new THREE.Vector3(p.x + fx * (W.kind === 'shot' ? W.range : 1.6), 1.1, p.z + fz * (W.kind === 'shot' ? W.range : 1.6));
    setTimeout(() => {
      this.effect(W, to, !!best);
      for (const t of hits) t.hit(W.stun * (g.horror.active ? 1 : 1.5));
      if (g.horror.active) g.horror.makeNoise(p.x, p.z, 10, 'weapon');
    }, W.kind === 'shot' ? 120 : 260);
    return true;
  }

  effect(W, to, hit) {
    const g = this.game, s = g.scene, p = g.player.pos;
    const from = new THREE.Vector3(p.x, p.y + 1.25, p.z);
    const add = (m, life, fn) => { s.scene.add(m); this.fx.push({ m, life, t: 0, fn }); };
    const M = (c, o = 0.9) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }); m.userData.own = true; return m; };
    if (W.kind === 'shot') {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: W.color, transparent: true })), 0.6, (m, k) => (m.material.opacity = 1 - k));
      // паутинная сетка на цели
      const net = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 4, 8), M(W.color));
      net.position.copy(to);
      net.lookAt(from);
      for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.012, 0.012), M(W.color)); sp.rotation.z = (i / 4) * Math.PI; net.add(sp); }
      add(net, hit ? 3 : 0.8, (m, k) => { m.material.opacity = 1 - k; m.children.forEach((c) => (c.material.opacity = 1 - k)); });
      return;
    }
    // взмах: дуга перед персонажем
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 4, 20, Math.PI * 0.8), M(W.color, 0.8));
    arc.position.set(p.x, p.y + 1.0, p.z);
    arc.rotation.set(Math.PI / 2, 0, -g.player.facing - Math.PI * 0.9);
    add(arc, 0.3, (m, k) => { m.material.opacity = 0.8 * (1 - k); m.scale.setScalar(1 + k * 0.3); });
    if (W.area) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 30), M('#ffd27a', 0.8));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, 0.2, p.z);
      add(ring, 0.6, (m, k) => { m.scale.setScalar(1 + k * 6); m.material.opacity = 0.8 * (1 - k); });
      g.cam.shake = 0.25;
    }
    if (hit) {
      for (let i = 0; i < (W.stars ? 6 : 3); i++) {
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), M(W.stars ? '#ffe14a' : '#ffffff', 1));
        st.position.copy(to).add(new THREE.Vector3(0, 0.6, 0));
        const a = (i / 6) * Math.PI * 2;
        add(st, 1.2, (m, k) => { m.position.set(to.x + Math.cos(a + k * 8) * 0.35, to.y + 0.7, to.z + Math.sin(a + k * 8) * 0.35); m.material.opacity = 1 - k; });
      }
    }
  }

  update(dt) {
    const g = this.game;
    const W = this.def;
    this.el.classList.toggle('hidden', !W || g.state !== 'play');
    if (W) {
      this.icon.textContent = W.icon;
      this.name.textContent = W.name;
      this.bar.firstChild.style.width = `${Math.max(0, 1 - this.cool / (W.cd * (g.horror.active ? 2.5 : 1))) * 100}%`;
      const raidGear = g.raid.active() && g.raid.bestGear();
      if (!raidGear && g.input.pressed('KeyF')) this.fire();
    }
    this.cool = Math.max(0, this.cool - dt);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      f.fn(f.m, k);
      if (k >= 1) { f.m.removeFromParent(); f.m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); this.fx.splice(i, 1); }
    }
  }
}
