import * as THREE from 'three';
import { CharacterModel } from '../player/CharacterModel.js';
import { npcLook } from '../scenes/entities.js';
import { mat, textTexture } from '../core/gfx.js';
import { TASK_TYPES } from '../lessons/tasks.js';
import { h } from '../ui/dom.js';

// Миссия «Захват школы»: после 3-го урока в школу врываются грабители.
// Снаряжение полиции выдаётся за решённую задачу (чем лучше — тем сложнее).
// Грабителей оглушают и задерживают (наручники), заложников освобождают, в конце — бомба.

export const GEAR = [
  { id: 'whistle', tier: 1, name: 'Свисток-сирена', icon: '📣', range: 2.6, cd: 1.0, cone: false, desc: 'Оглушает грабителя совсем рядом' },
  { id: 'taser', tier: 2, name: 'Электрошокер', icon: '⚡', range: 4.5, cd: 0.8, cone: true, desc: 'Бьёт током на 4–5 метров вперёд' },
  { id: 'net', tier: 3, name: 'Сетемёт', icon: '🕸️', range: 10, cd: 1.2, cone: true, desc: 'Ловит сетью издалека, до 10 метров' },
];
const BOMB_TIME = 100;

function genFor(tier, grade) {
  if (tier === 1) return { ops: ['+', '-'], min: 2, max: grade <= 2 ? 10 : 20 + grade * 6, count: 2 };
  if (tier === 2) return grade <= 2 ? { ops: ['+', '-'], min: 10, max: 60, count: 3 } : { ops: ['×', '÷'], min: 2, max: grade <= 4 ? 9 : 12, count: 3 };
  if (grade <= 3) return { ops: ['×'], min: 3, max: 9, count: 4 };
  if (grade <= 6) return { ops: ['×', '÷'], min: 6, max: 15, count: 4 };
  return { kind: 'eq', min: 2, max: 12, count: 3 };
}

function robberLook(i) {
  const tops = ['#2d3436', '#1e272e', '#3d3d3d', '#2c3e50'];
  const l = npcLook(tops[i % 4], '#1b1b1b', '#111111', { shape: i % 3 === 0 ? 'tall' : 'normal', skinTone: ['#f1c27d', '#e0ac69', '#ffd3b0', '#c68642'][i % 4] });
  l.acc = { hat: { model: 'beanie', color: '#111111', color2: '#111111' } };
  return l;
}

function tagSprite(text, bg) {
  const tex = textTexture(text, { w: 512, h: 128, bg, fg: '#ffffff', font: 'bold 64px Nunito, sans-serif', radius: 40 });
  const m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const s = new THREE.Sprite(m);
  s.scale.set(2.2, 0.55, 1);
  s.renderOrder = 999;
  return s;
}

export class Raid {
  constructor(game) {
    this.game = game;
    this.robbers = [];
    this.hostages = [];
    this.cool = 0;
    this.hitCool = 0;
  }

  get st() { return this.game.save.progress.flags.raid || null; }
  active() { const s = this.st; return !!s && (s.state === 'robbers' || s.state === 'bomb'); }
  happenedToday() { return !!this.st; }
  bestGear() { const s = this.st; if (!s) return null; return GEAR.filter((x) => s.gear.includes(x.id)).sort((a, b) => b.tier - a.tier)[0] || null; }
  remaining() { const s = this.st; if (!s) return 0; return Object.values(s.floors).reduce((a, f) => a + f.n - f.caught.length, 0); }
  floorsLeft() { const s = this.st; return Object.entries(s.floors).filter(([, f]) => f.caught.length < f.n).map(([k]) => +k); }

  // ---------- старт ----------
  start(floor) {
    const g = this.game;
    if (this.st) return;
    const grade = g.save.data.grade;
    const fl = [...new Set([floor, 1, grade, 1 + ((floor + 4) % 11)])].slice(0, 3);
    const floors = {};
    fl.forEach((f, i) => (floors[f] = { n: i === 0 ? 3 : 2, caught: [], freed: [] }));
    g.save.progress.flags.raid = { state: 'robbers', floors, gear: [], bombFloor: fl[fl.length - 1], startedAt: Date.now() };
    g.save.log('raid', `🚨 В школу ворвались грабители! Этажи: ${fl.join(', ')}`);
    g.save.save();
    g.audio.play('horn');
    for (let i = 0; i < 3; i++) setTimeout(() => g.audio.play('bell'), i * 900);
    g.ui.bigMessage('🚨 ТРЕВОГА!<small>В школу ворвались грабители</small>', 3200);
    setTimeout(() => {
      g.ui.dialog.show([
        { name: 'Директор (по громкой связи)', avatar: '📢', text: 'Внимание! В школе посторонние! Ученики — оставайтесь в кабинетах! Полиция уже едет!' },
        { name: 'Майор Орлов (рация)', avatar: '👮', text: `Слушай внимательно! Грабители на этажах ${fl.join(', ')}. Их видно сквозь стены — красные метки. Ящик с полицейским снаряжением стоит в холле у лифта на каждом этаже.` },
        { name: 'Майор Орлов (рация)', avatar: '👮', text: 'Снаряжение выдаётся только тому, кто решит задачу: чем мощнее снаряжение, тем сложнее пример. Задерживай грабителей клавишей F (или левой кнопкой мыши). И освобождай связанных заложников!' },
      ], () => { if (g.scene?.name === 'school') g.goTo('school', 'lift', `🚨 ${g.scene.floor} этаж`); });
    }, 1500);
  }

  // ---------- наполнение этажа ----------
  populate(s) {
    this.robbers = [];
    this.hostages = [];
    this.bomb = null;
    const st = this.st;
    if (!st || s.name !== 'school') return;
    const F = s.floor;
    const g = this.game;
    // ящик полиции
    if (this.active()) {
      s.box(-1.6, 0, 19.5, 1.4, 0.8, 0.9, '#1e3799', { collide: true });
      s.box(-1.6, 0.8, 19.5, 1.45, 0.1, 0.95, '#f6b93b');
      s.label([-1.6, 1.9, 19.5], '🧰 Снаряжение полиции', { maxDist: 18, cls: 'goal' });
      s.point('raidCrate', -1.6, 0, 18.4);
      s.interact({ pos: [-1.6, 1, 18.6], radius: 1.8, prompt: '🧰 Получить снаряжение (решить задачу)', action: () => this.openGear() });
      if (F === 1) {
        const m = new CharacterModel(npcLook('#0c2461', '#0c2461', '#2d3436', { shape: 'tall', acc: { hat: { model: 'cap', color: '#0c2461' } } }));
        m.root.position.set(-10.5, 0, 12);
        m.root.rotation.y = Math.PI / 2;
        s.addObj(m.root);
        s.onUpdate((dt) => m.animate(dt, 0, {}));
        s.label([-10.5, 2.3, 12], '👮 Майор Орлов', { maxDist: 12, cls: 'npc' });
        s.interact({ pos: [-10.5, 1, 12], radius: 2, prompt: 'Поговорить: Майор Орлов', action: () => g.ui.dialog.show([{ name: 'Майор Орлов', avatar: '👮', text: this.questText() }]) });
      }
    }
    const fd = st.floors[F];
    const X = s.X;
    if (fd) {
      for (let i = 0; i < fd.n; i++) {
        const caught = fd.caught.includes(i);
        const x = 3 + ((i * 0.37 + F * 0.13) % 1) * (X - 6);
        this.spawnRobber(s, F, i, x, 13, caught);
      }
      // заложники — в кабинетах
      const desks = Object.entries(s.points).filter(([k]) => k.startsWith('desk_') && k !== 'desk_gym').map(([, p]) => p);
      for (let i = 0; i < 2 && i < desks.length; i++) {
        if (fd.freed.includes(i)) continue;
        const p = desks[(i * 3 + F) % desks.length];
        this.spawnHostage(s, F, i, p.x + 1.6, p.z);
      }
    }
    if (st.state === 'bomb' && st.bombFloor === F) this.spawnBomb(s, X * 0.5, 11.2);
  }

  spawnRobber(s, F, i, x, z, caught) {
    const g = this.game;
    const model = new CharacterModel(robberLook(i + F));
    // маска-балаклава
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.12), mat('#111111'));
    mask.position.set(0, -0.08, 0.24);
    model.head.add(mask);
    const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), mat('#a1887f'));
    bag.position.set(0.32, 0.7, -0.15);
    model.body.add(bag);
    model.root.position.set(x, 0, z);
    s.addObj(model.root);
    const tag = tagSprite(caught ? '⛓ Задержан' : '🦹 ГРАБИТЕЛЬ', caught ? '#1f9d55' : '#d63031');
    tag.position.set(0, 2.45, 0);
    model.root.add(tag);
    const r = { id: i, floor: F, model, tag, pos: model.root.position, caught, wp: new THREE.Vector3(x, 0, z), wait: 0, speed: 0 };
    if (caught) this.cuff(r, false);
    this.robbers.push(r);
  }

  cuff(r, fresh = true) {
    r.caught = true;
    r.model.pose = 'sit';
    const cuffs = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), mat('#b2bec3'));
    cuffs.position.set(0, 0.62, 0.32);
    r.model.body.add(cuffs);
    const tex = textTexture('⛓ Задержан', { w: 512, h: 128, bg: '#1f9d55', fg: '#ffffff', font: 'bold 64px Nunito, sans-serif', radius: 40 });
    r.tag.material.map = tex;
    r.tag.material.needsUpdate = true;
    if (fresh) r.stars = 2.5;
  }

  spawnHostage(s, F, i, x, z) {
    const g = this.game;
    const look = npcLook(['#74b9ff', '#fd79a8', '#55efc4'][i % 3], '#2d3436', ['#6d4c41', '#2d3436', '#e1b12c'][i % 3], { shape: i % 2 ? 'mini' : 'normal' });
    const model = new CharacterModel(look);
    model.pose = 'sit';
    model.root.position.set(x, 0, z);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 16), mat('#c49a6c'));
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 0.7;
    model.body.add(rope);
    s.addObj(model.root);
    const hh = { id: i, floor: F, model, rope, freed: false, run: 0 };
    this.hostages.push(hh);
    const lbl = s.label([x, 1.9, z], '🆘 Заложник', { maxDist: 14, cls: 'goal', visible: () => !hh.freed });
    s.interact({
      pos: [x, 1, z], radius: 1.6, prompt: '🔓 Развязать и освободить заложника', enabled: () => !hh.freed,
      action: () => {
        hh.freed = true;
        this.st.floors[F].freed.push(i);
        model.body.remove(rope);
        model.pose = 'stand';
        model.wave = 2;
        g.audio.play('correct');
        g.fx.burst(new THREE.Vector3(x, 1.2, z), '#ffd32a', 18);
        g.save.addCoins(10, 'hostage');
        g.save.addXp(15);
        g.save.log('raid', `Освободил заложника на ${F} этаже`);
        g.achievements.unlock('rescuer');
        g.ui.toast('🙌 Спасибо, что спас меня! +10 🪙');
        hh.run = 3;
        void lbl;
      },
    });
  }

  spawnBomb(s, x, z) {
    const g = this.game;
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), mat('#3d3d3d'));
    body.position.y = 0.25;
    const disp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.02), mat('#ff3b30', { emissive: '#aa0000' }));
    disp.position.set(0, 0.32, 0.31);
    grp.add(body, disp);
    ['#ff3b30', '#3fa7ff', '#2ed573'].forEach((c, i) => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 12, Math.PI), mat(c));
      w.position.set(-0.25 + i * 0.25, 0.5, 0);
      grp.add(w);
    });
    grp.position.set(x, 0, z);
    s.addObj(grp);
    const tag = tagSprite('💣 БОМБА', '#e17055');
    tag.position.y = 1.4;
    grp.add(tag);
    this.bomb = { grp, disp, x, z };
    s.point('raidBomb', x, 0, z + 1);
    s.interact({ pos: [x, 1, z + 0.9], radius: 1.8, prompt: '✂️ Обезвредить бомбу (решить задачи на время)', enabled: () => this.st?.state === 'bomb', action: () => this.openBomb() });
  }

  // ---------- игровой цикл ----------
  update(dt) {
    const g = this.game;
    const s = g.scene;
    if (!s || s.name !== 'school' || !this.st) return;
    this.cool = Math.max(0, this.cool - dt);
    this.hitCool = Math.max(0, this.hitCool - dt);
    const p = g.player.pos;
    const t = performance.now() / 1000;
    for (const r of this.robbers) {
      r.tag.position.y = 2.45 + Math.sin(t * 3 + r.id) * 0.06;
      if (r.caught) {
        if (r.stars > 0) { r.stars -= dt; if (Math.random() < 0.2) g.fx.burst(new THREE.Vector3(r.pos.x, 1.4, r.pos.z), '#ffd32a', 2); }
        r.model.animate(dt, 0, {});
        continue;
      }
      if (g.lesson.active || !this.active()) { r.model.animate(dt, 0, {}); continue; }
      const dx = p.x - r.pos.x, dz = p.z - r.pos.z;
      const dist = Math.hypot(dx, dz);
      let tx, tz, sp;
      if (dist < 7 && Math.abs(p.y - r.pos.y) < 1.5) { tx = p.x; tz = p.z; sp = 2.7; }
      else {
        if (r.wait > 0) { r.wait -= dt; sp = 0; tx = r.pos.x; tz = r.pos.z; }
        else {
          if (Math.hypot(r.wp.x - r.pos.x, r.wp.z - r.pos.z) < 0.5) {
            r.wp.set(Math.random() < 0.8 ? 1 + Math.random() * (s.X - 2) : -12 + Math.random() * 10, 0, 11 + Math.random() * 4);
            r.wait = 0.5 + Math.random() * 2;
          }
          tx = r.wp.x; tz = r.wp.z; sp = 1.6;
        }
      }
      const ddx = tx - r.pos.x, ddz = tz - r.pos.z, dd = Math.hypot(ddx, ddz);
      if (dd > 0.05 && sp > 0) {
        const step = Math.min(dd, sp * dt);
        r.pos.x += (ddx / dd) * step;
        r.pos.z += (ddz / dd) * step;
        s.world.resolve(r.pos, 0.32, 1.6);
        r.model.root.rotation.y = Math.atan2(ddx, ddz);
      }
      r.model.animate(dt, sp ? sp / 4 : 0, {});
      // столкновение с игроком — толкает
      if (dist < 0.85 && this.hitCool <= 0) {
        this.hitCool = 2.2;
        const k = 1.8 / (dist || 1);
        p.x += dx * k; p.z += dz * k;
        s.world.resolve(p, 0.32, 1.6);
        g.cam.shake = 0.15;
        g.audio.play('kick');
        g.ui.toast('💥 Грабитель толкнул тебя! Держи дистанцию и используй снаряжение (F)', 'warn', 2500);
      }
    }
    for (const hh of this.hostages) {
      if (hh.run > 0) {
        hh.run -= dt;
        const m = hh.model.root;
        const dx = -5.5 - m.position.x, dz = 23 - m.position.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { m.position.x += (dx / d) * 3 * dt; m.position.z += (dz / d) * 3 * dt; m.rotation.y = Math.atan2(dx, dz); }
        hh.model.animate(dt, 0.8, {});
        if (hh.run <= 0) m.visible = false;
      } else hh.model.animate(dt, 0, {});
    }
    if (this.bomb) {
      this.bomb.disp.material = mat(Math.floor(t * 2) % 2 ? '#ff3b30' : '#550000', { emissive: Math.floor(t * 2) % 2 ? '#aa0000' : '#000000' });
      if (Math.floor(t * 2) !== this._beep) { this._beep = Math.floor(t * 2); if (p.distanceTo(this.bomb.grp.position) < 12) g.audio.play('tick'); }
    }
    if (g.input.pressed('KeyF') && this.active() && !g.lesson.active) this.attack();
  }

  attack() {
    const g = this.game;
    const gear = this.bestGear();
    if (!gear) { g.ui.toast('🧰 Сначала получи снаряжение в ящике полиции у лифта!', 'warn'); return; }
    if (this.cool > 0) return;
    this.cool = gear.cd;
    const p = g.player.pos;
    const fx = Math.sin(g.player.facing), fz = Math.cos(g.player.facing);
    let best = null, bd = Infinity;
    for (const r of this.robbers) {
      if (r.caught) continue;
      const dx = r.pos.x - p.x, dz = r.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > gear.range) continue;
      const front = (dx * fx + dz * fz) / (d || 1);
      if (gear.cone && d > 1.6 && front < 0.55) continue;
      if (d < bd) { bd = d; best = r; }
    }
    this.effect(gear, best);
    if (!best) {
      g.audio.play('whoosh');
      g.ui.toast(`${gear.icon} Мимо! Повернись к грабителю (дальность ${gear.range} м)`);
      return;
    }
    this.catchRobber(best);
  }

  effect(gear, r) {
    const g = this.game;
    const s = g.scene;
    const p = g.player.pos;
    const from = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    const to = r ? new THREE.Vector3(r.pos.x, 1.1, r.pos.z) : from.clone().add(new THREE.Vector3(Math.sin(g.player.facing), 0, Math.cos(g.player.facing)).multiplyScalar(gear.range));
    if (gear.id === 'whistle') {
      g.audio.tone(2600, 0.5, { type: 'square', vol: 0.12 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), mat('#ffd32a', { basic: true, transparent: true, opacity: 0.8 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(from);
      s.scene.add(ring);
      let k = 0;
      const up = (dt) => { k += dt; ring.scale.setScalar(1 + k * 8); ring.material.opacity = Math.max(0, 0.8 - k * 2); if (k > 0.4) { ring.removeFromParent(); s.updaters.splice(s.updaters.indexOf(up), 1); } };
      s.onUpdate(up);
      return;
    }
    const geo = new THREE.BufferGeometry().setFromPoints(gear.id === 'taser'
      ? Array.from({ length: 9 }, (_, i) => from.clone().lerp(to, i / 8).add(new THREE.Vector3((Math.random() - 0.5) * 0.25 * (i % 8 ? 1 : 0), (Math.random() - 0.5) * 0.25 * (i % 8 ? 1 : 0), 0)))
      : [from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: gear.id === 'taser' ? '#74b9ff' : '#ffffff' }));
    s.scene.add(line);
    g.audio.play(gear.id === 'taser' ? 'tick' : 'whoosh');
    if (gear.id === 'taser') g.audio.tone(120, 0.3, { type: 'sawtooth', vol: 0.1 });
    setTimeout(() => { line.removeFromParent(); geo.dispose(); }, 220);
    if (r && gear.id === 'net') g.fx.burst(to, '#dfe6e9', 20);
  }

  catchRobber(r) {
    const g = this.game;
    const st = this.st;
    this.cuff(r);
    st.floors[r.floor].caught.push(r.id);
    g.audio.play('correct');
    g.fx.burst(new THREE.Vector3(r.pos.x, 1.2, r.pos.z), '#74b9ff', 16);
    g.save.addCoins(15, 'robber');
    g.save.addXp(20);
    g.save.log('raid', `Задержал грабителя на ${r.floor} этаже`);
    const left = this.remaining();
    g.ui.toast(`⛓ Грабитель задержан! +15 🪙 · осталось: ${left}`);
    if (left === 0) {
      st.state = 'bomb';
      g.save.save();
      g.achievements.unlock('hero');
      setTimeout(() => {
        g.audio.play('horn');
        g.ui.bigMessage('💣 В школе бомба!<small>Найди её и обезвредь</small>', 3200);
        g.ui.dialog.show([
          { name: 'Майор Орлов (рация)', avatar: '👮', text: 'Отличная работа, все грабители задержаны! Но один из них признался: в школе заложена бомба!' },
          { name: 'Майор Орлов (рация)', avatar: '👮', text: `Бомба на ${st.bombFloor} этаже, в коридоре. Сапёры застряли в пробке — только ты успеешь. Реши задачи, чтобы перерезать нужные провода!` },
        ], () => { if (g.scene?.floor === st.bombFloor) g.goTo('school', 'lift', `💣 ${st.bombFloor} этаж`); });
      }, 900);
    } else if (!this.robbers.some((x) => !x.caught)) {
      g.ui.tip(`На этом этаже всё чисто! Грабители остались на этажах: <b>${this.floorsLeft().join(', ')}</b>. Поезжай на лифте.`);
    }
    g.save.save();
  }

  // ---------- задачи за снаряжение ----------
  taskBox(task, onResult) {
    const g = this.game;
    const wrap = h('div', { class: 'task raid-task' });
    const handler = TASK_TYPES[task.type].render(wrap, task, { done: onResult, submit: () => {}, speak: () => {}, canSpeak: () => false, sound: (n) => g.audio.play(n), note: () => {}, sport: () => Promise.resolve({ frac: 1 }) }) || {};
    return { wrap, handler };
  }

  openGear() {
    const g = this.game;
    const st = this.st;
    const grade = g.save.data.grade;
    const body = h('div', { class: 'raid-gear' });
    const render = () => {
      body.innerHTML = '';
      body.append(h('p', { class: 'raid-note' }, 'Выбери снаряжение. Чтобы его получить, реши задачу. Чем мощнее снаряжение — тем сложнее пример. Все средства — нелетальные: грабителя оглушают и надевают наручники.'));
      body.append(h('div', { class: 'raid-cards' }, GEAR.map((x) => {
        const own = st.gear.includes(x.id);
        return h('button', { class: `raid-card ${own ? 'own' : ''}`, disabled: own, onclick: () => solve(x) },
          h('div', { class: 'rc-ic' }, x.icon), h('b', {}, x.name), h('small', {}, x.desc),
          h('div', { class: 'rc-meta' }, `Дальность ${x.range} м · сложность ${'★'.repeat(x.tier)}${'☆'.repeat(3 - x.tier)}`),
          h('div', { class: 'rc-state' }, own ? '✓ получено' : 'Решить задачу →'));
      })));
    };
    const solve = (x) => {
      body.innerHTML = '';
      const task = { type: 'math', q: `${x.icon} ${x.name}: реши примеры`, gen: genFor(x.tier, grade) };
      const { wrap, handler } = this.taskBox(task);
      const out = h('div');
      const btn = h('button', { class: 'btn green', onclick: () => {
        if (handler.empty && handler.empty()) { g.ui.toast('✏️ Заполни все ответы'); return; }
        const r = handler.check();
        btn.remove();
        if (r.frac >= 1) {
          st.gear.push(x.id);
          g.save.save();
          g.audio.play('buy');
          g.save.log('raid', `Получил снаряжение «${x.name}» за решённую задачу`);
          out.append(h('div', { class: 'feedback ok' }, `Верно! Ты получил: ${x.icon} ${x.name}. Нажимай F, чтобы задерживать грабителей.`), h('button', { class: 'btn', onclick: render }, 'К снаряжению'));
        } else {
          g.audio.play('wrong');
          out.append(h('div', { class: 'feedback bad' }, `Есть ошибки. Правильно: ${r.answer}`), h('button', { class: 'btn white', onclick: () => solve(x) }, '🔁 Новый пример'));
        }
      } }, 'Проверить ✓');
      body.append(wrap, h('div', { class: 'lab-btns' }, btn, h('button', { class: 'btn white', onclick: render }, '← Назад')), out);
    };
    render();
    g.ui.modal('raidgear', '🧰 Снаряжение полиции', body);
  }

  // ---------- бомба ----------
  openBomb() {
    const g = this.game;
    const st = this.st;
    const grade = g.save.data.grade;
    let left = BOMB_TIME, stage = 0, finished = false;
    const wires = ['🔴 красный', '🔵 синий', '🟢 зелёный'];
    const timer = h('div', { class: 'bomb-timer' });
    const wireRow = h('div', { class: 'bomb-wires' }, wires.map((w) => h('span', { class: 'bw' }, w)));
    const area = h('div');
    const out = h('div');
    const tick = setInterval(() => {
      if (finished) return;
      left -= 1;
      timer.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      timer.classList.toggle('low', left <= 20);
      if (left % 2 === 0) g.audio.play('tick');
      if (left <= 0) end(false);
    }, 1000);
    const end = (ok) => {
      finished = true;
      clearInterval(tick);
      st.state = 'done';
      g.save.save();
      area.innerHTML = '';
      if (ok) {
        g.audio.play('levelup');
        g.ui.confetti(4000);
        g.save.addCoins(150, 'bomb');
        g.save.addXp(80);
        g.achievements.unlock('sapper');
        g.save.log('raid', 'Обезвредил бомбу! Школа спасена');
        out.replaceChildren(h('div', { class: 'feedback ok' }, '✅ Бомба обезврежена! Ты спас школу! +150 🪙'));
      } else {
        g.audio.play('wrong');
        g.save.log('raid', 'Не успел обезвредить бомбу — это сделали сапёры');
        out.replaceChildren(h('div', { class: 'feedback bad' }, '⏰ Время вышло! К счастью, сапёры подоспели и обезвредили бомбу в последний момент.'));
      }
      out.append(h('button', { class: 'btn', onclick: () => { g.ui.closeModal('bomb'); this.afterRaid(ok); } }, 'Продолжить'));
    };
    const nextStage = () => {
      area.innerHTML = '';
      if (stage >= 3) { end(true); return; }
      const task = { type: 'math', q: `Провод ${wires[stage]}: реши, чтобы перерезать`, gen: genFor(Math.min(3, 2 + (stage === 2 ? 1 : 0)), grade) };
      const { wrap, handler } = this.taskBox(task);
      const btn = h('button', { class: 'btn red', onclick: () => {
        if (handler.empty && handler.empty()) { g.ui.toast('✏️ Заполни все ответы'); return; }
        const r = handler.check();
        if (r.frac >= 1) {
          g.audio.play('kick');
          wireRow.children[stage].classList.add('cut');
          stage++;
          setTimeout(nextStage, 700);
        } else {
          g.audio.play('wrong');
          left = Math.max(1, left - 15);
          g.ui.toast(`❌ Неверно! −15 секунд. Правильно: ${r.answer}`, 'warn', 3500);
          setTimeout(nextStage, 900);
        }
        btn.remove();
      } }, '✂️ Перерезать провод');
      area.append(wrap, h('div', { class: 'lab-btns' }, btn));
    };
    timer.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const body = h('div', { class: 'bomb' }, h('div', { class: 'bomb-top' }, timer, wireRow), area, out);
    nextStage();
    const m = g.ui.modal('bomb', '💣 Обезвреживание бомбы', body, { onClose: () => { if (!finished) { clearInterval(tick); g.ui.toast('💣 Бомба всё ещё тикает! Вернись к ней.', 'warn'); } } });
    void m;
  }

  afterRaid(ok) {
    const g = this.game;
    g.ui.dialog.show([
      { name: 'Майор Орлов', avatar: '👮', text: ok ? 'Ты настоящий герой! Грабители задержаны, заложники спасены, бомба обезврежена. От имени полиции — спасибо!' : 'Все живы и здоровы — это главное. Ты задержал всех грабителей, ты молодец!' },
      { name: 'Директор', avatar: '👨‍💼', text: 'Уроки продолжаются! Спасибо тебе за смелость.' },
    ], () => {
      if (this.bomb) { this.bomb.grp.visible = false; }
      if (g.scene?.bellNext) g.scene.bellNext();
    });
  }

  // ---------- для HUD и навигации ----------
  questText() {
    const st = this.st;
    if (!st) return '';
    if (st.state === 'robbers') {
      if (!this.bestGear()) return '🧰 Возьми снаряжение полиции у лифта (реши задачу)';
      return `🚨 Задержи грабителей (F): осталось ${this.remaining()} · этажи ${this.floorsLeft().join(', ')}`;
    }
    if (st.state === 'bomb') return `💣 Найди и обезвредь бомбу на ${st.bombFloor} этаже`;
    return '';
  }

  target() {
    const g = this.game;
    const s = g.scene;
    const st = this.st;
    if (!s || !st) return null;
    if (s.name !== 'school') return s.points.schoolDoor || null;
    if (st.state === 'robbers') {
      if (!this.bestGear()) return s.points.raidCrate || s.points.lift;
      const p = g.player.pos;
      let best = null, bd = Infinity;
      for (const r of this.robbers) {
        if (r.caught) continue;
        const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
        if (d < bd) { bd = d; best = r; }
      }
      return best ? new THREE.Vector3(best.pos.x, 0, best.pos.z) : s.points.lift;
    }
    if (st.state === 'bomb') return s.floor === st.bombFloor ? s.points.raidBomb : s.points.lift;
    return null;
  }

  extraSub() {
    const s = this.game.scene;
    const st = this.st;
    if (!s || s.name !== 'school' || !st) return '';
    if (st.state === 'robbers' && this.bestGear() && !this.robbers.some((r) => !r.caught)) return `⬆ Поезжай на этаж ${this.floorsLeft()[0]}`;
    if (st.state === 'bomb' && s.floor !== st.bombFloor) return `Бомба на ${st.bombFloor} этаже`;
    const gear = this.bestGear();
    return gear ? `${gear.icon} ${gear.name}` : '';
  }

  mapDots() { return this.game.scene?.name === 'school' ? this.robbers.filter((r) => !r.caught).map((r) => r.pos) : []; }
}
