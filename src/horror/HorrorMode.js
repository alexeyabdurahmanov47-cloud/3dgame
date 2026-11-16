import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { Assets } from '../core/Assets.js';
import { DIFFICULTIES, diffById } from './config.js';
import { MISSIONS, missionById } from './missions.js';
import { PUZZLES, PUZZLE_TITLES, DOCS } from './puzzles.js';
import { ROOMS, roomById } from './HorrorScene.js';
import { Teacher, Shadow, Headmaster, Silhouette } from './monsters.js';
import { HorrorAudio } from './audio.js';
import { HorrorFX } from './fx.js';
import { bloodText } from './decals.js';
import { openHorrorMenu } from './HorrorMenu.js';

const ITEM_NAMES = {
  fragment: 'Осколок кода', fuse: 'Предохранитель', keypart: 'Клочок ключа', doc: 'Страница дневника', key: 'Ключ', gear: 'Деталь звонка',
  reagent: 'Реактив', page: 'Страница с условиями', battery: 'Батарейка', medkit: 'Аптечка', exam: 'Экзаменационный лист',
};
const SCARY = ['Я ВИЖУ ТЕБЯ', 'ОБЕРНИСЬ', 'ТЫ НЕ ВЫУЧИЛ УРОК', 'ОНА УЖЕ ЗА ДВЕРЬЮ', 'НЕ ДЫШИ', 'ЗВОНОК БЫЛ ДЛЯ ТЕБЯ', 'ЗДЕСЬ НИКОГО НЕТ… КРОМЕ НАС', 'ТЫ ОСТАНЕШЬСЯ ПОСЛЕ УРОКОВ', 'КТО-ТО СТОИТ ПОЗАДИ'];
const VKEYS = ['DARK', 'FEAR', 'GRIM', 'HUSH', 'BELL', 'TOMB', 'VOID'];

export class HorrorMode {
  constructor(game) {
    this.game = game;
    this.active = false;
  }

  get scene() { return this.game.scene; }

  // ---------------------------------------------------------------- запуск
  async launch(missionId, diffId) {
    const g = this.game;
    if (this.active) this.end();
    this.mission = missionById(missionId);
    this.diff = diffById(diffId);
    this.diffIndex = DIFFICULTIES.indexOf(this.diff);
    this.seed = (Date.now() % 1000003) | 1;
    this.active = true;
    this.ready = false;
    g.audio.init();
    g.mainMenu.hide();
    g.ui.closeAllModals();
    g.ui.toastBox.innerHTML = '';
    if (g.ui.tipEl) { g.ui.tipEl.remove(); g.ui.tipEl = null; }
    g.ui.loading.show('🩸 Загрузка кошмара…');
    await Assets.ensure(['teacher', 'shadow', 'headmaster']);
    try { await document.fonts.load('64px "Rubik Wet Paint"'); } catch (_) { /* шрифт не обязателен */ }
    g.save.log('horror', `Хоррор-режим: «${this.mission.name}» (${this.diff.name})`);
    g.state = 'loading';
    await g.goTo('horror', 'start', `${this.mission.icon} ${this.mission.name} · ${this.diff.name}`);
  }

  // вызывается из HorrorScene.enter()
  begin() {
    const g = this.game, d = this.diff, m = this.mission;
    this.ready = true;
    this.ended = false;
    this.dead = false;
    this.hp = 100;
    this.stamina = 100;
    this.exhausted = false;
    this.battery = 100;
    this.batteries = Math.max(0, d.batteries - (m.id === 'night' ? 1 : 0));
    this.flashOn = true;
    this.crouch = false;
    this.hidden = null;
    this.noises = [];
    this.noiseLevel = 0;
    this.noiseT = 0;
    this.tension = 0;
    this.blackout = !!m.blackout;
    this.blackoutT = 0;
    this.powerOff = !!m.blackout;
    this.timeLeft = Math.round(m.time * d.time);
    this.elapsed = 0;
    this.lastHurt = -99;
    this.items = [];
    this.monsters = [];
    this.teachers = [];
    this.shadows = [];
    this.decoys = [];
    this.temp = [];
    this.cache = {};
    this.evT = 25;
    this.fake = null;
    this.stats = { wrong: 0, damage: 0, hides: 0, noise: 0, pickups: 0 };
    this.state = {
      chainValue: 0,
      fragments: [],
      vkey: VKEYS[Math.floor(Math.random() * VKEYS.length)],
      vkeyParts: [],
    };
    const verts = [3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    this.state.fragments = verts.map((n) => ({ n, d: Math.floor(Math.random() * 10), found: false }));

    // игрок
    const P = g.player;
    P.speedMul = 1;
    P.canRun = true;
    P.model.crouch = false;
    g.cam.maxDist = 3.4;
    document.body.classList.add('horror-on');

    this.audio = new HorrorAudio(g);
    this.audio.start();
    this.fx = new HorrorFX(this);
    this.buildHud();

    // монстры
    const nT = d.teachers + (m.extraTeachers || 0);
    const tSpots = [[36, 0], [-36, -13.5], [10, 7], [-20, 0]];
    for (let i = 0; i < nT; i++) { const t = new Teacher(this, ...tSpots[i % tSpots.length]); this.teachers.push(t); this.monsters.push(t); }
    const nS = d.shadows + (m.extraShadows || 0);
    for (let i = 0; i < nS; i++) { const s = new Shadow(this); s.timer = 15 + i * 12 + Math.random() * 15; this.shadows.push(s); this.monsters.push(s); }
    if (m.boss) { this.boss = new Headmaster(this, 64, 0); this.monsters.push(this.boss); } else this.boss = null;

    // запасы
    const nb = [6, 5, 4, 3, 2][this.diffIndex] + (m.id === 'night' ? 3 : 0);
    const nm = [3, 2, 2, 1, 0][this.diffIndex];
    const rooms = this.shuffled(ROOMS);
    for (let i = 0; i < nb; i++) this.spawnItemInRoom('battery', rooms[i % rooms.length]);
    for (let i = 0; i < nm; i++) this.spawnItemInRoom('medkit', rooms[(i + 7) % rooms.length]);

    // «Пять дверей» — заранее запертые кабинеты
    if (m.id === 'doors') for (const st of m.stages) { const door = this.scene.doors.find((x) => x.id === 'd_' + st.at); if (door) door.locked = true; }

    this.stageIdx = -1;
    this.nextStage();
    this.fx.message(m.name.toUpperCase(), 3200, 'title');
    g.ui.toast(`<b>${m.icon} ${m.name}</b> · ${d.name}<br>${m.goal}`, 'warn', 6000);
    if (!g.save.data.horror.controlsSeen) {
      g.save.data.horror.controlsSeen = true;
      g.ui.tip(g.input.isTouch
        ? 'Кнопки справа: 🔦 фонарик, 🔋 батарейка, 🧎 пригнуться. ✋ — действие и шкафчики. Бег — джойстик до упора.'
        : '<b>Shift</b> — бег (тратит выносливость, шумно) · <b>C</b> — пригнуться (тихо) · <b>F</b> — фонарик · <b>R</b> — сменить батарейку · <b>E</b> — действие / спрятаться в шкафчик · <b>Esc</b> — пауза', null, 14000, '');
    }
  }

  shuffled(arr) { return arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((a) => a[1]); }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const g = this.game;
    this.el = {};
    const bar = (cls) => { const f = h('div'); this.el[cls] = f; return h('div', { class: `hz-bar ${cls}` }, f); };
    this.el.batt = h('span', {}, '');
    this.el.time = h('div', { class: 'hz-time' }, '');
    this.el.eye = h('div', { class: 'hz-eye' }, h('div', { class: 'pupil' }));
    this.el.noise = h('div', { class: 'hz-noise' }, h('div'));
    this.el.state = h('div', { class: 'hz-state' }, '');
    const mob = g.input.isTouch ? h('div', { class: 'hz-mob' },
      h('button', { onclick: () => g.input.press('KeyF') }, '🔦'),
      h('button', { onclick: () => g.input.press('KeyR') }, '🔋'),
      h('button', { onclick: () => g.input.press('KeyC') }, '🧎')) : null;
    this.hudEl = h('div', { class: 'hz-hud passthru' },
      h('div', { class: 'hz-stats' },
        h('div', { class: 'hz-line' }, h('b', {}, 'HP'), bar('hp')),
        h('div', { class: 'hz-line' }, h('b', {}, 'SP'), bar('sp')),
        h('div', { class: 'hz-line' }, h('b', {}, '🔦'), bar('fl'), this.el.batt)),
      h('div', { class: 'hz-tr' }, h('div', { class: 'hz-diff', style: { '--c': this.diff.color } }, this.diff.name), this.el.time),
      h('div', { class: 'hz-bl' }, this.el.eye, h('div', {}, h('small', {}, 'ШУМ'), this.el.noise), this.el.state));
    g.ui.root.append(this.hudEl);
    if (mob) { g.ui.root.append(mob); this.mobEl = mob; }
    g.hud.el.classList.add('horror');
    g.hud.el.classList.toggle('nomap', this.diff.hints < 2);
  }

  updateHud() {
    const e = this.el;
    e.hp.style.width = `${Math.max(0, this.hp)}%`;
    e.sp.style.width = `${this.stamina}%`;
    e.sp.parentNode.classList.toggle('ex', this.exhausted);
    e.fl.style.width = `${this.battery}%`;
    e.fl.parentNode.classList.toggle('off', !this.flashOn);
    e.batt.textContent = `×${this.batteries}`;
    const st = this.stage;
    const t = st && st.t === 'survive' ? this.surviveLeft : this.timeLeft;
    const mm = Math.max(0, Math.floor(t / 60)), ss = Math.max(0, Math.floor(t % 60));
    e.time.textContent = `${st && st.t === 'survive' ? '🌅 ' : '⏱ '}${mm}:${String(ss).padStart(2, '0')}`;
    e.time.classList.toggle('low', t < 60);
    const aware = Math.max(0, ...this.teachers.map((m) => Math.min(1, m.aware)), this.boss && this.boss.state === 'hunt' ? 1 : 0, ...this.shadows.map((s) => (s.state === 'stalk' ? 0.5 : 0)));
    e.eye.style.setProperty('--a', aware.toFixed(2));
    e.eye.classList.toggle('chase', this.tension > 0.9);
    e.noise.firstChild.style.width = `${Math.min(100, this.noiseLevel * 100)}%`;
    e.noise.classList.toggle('loud', this.noiseLevel > 0.7);
    e.state.textContent = this.hidden ? '🫣 Ты в шкафчике — не дыши' : this.crouch ? '🧎 Пригнулся' : this.exhausted ? '😮‍💨 Нет сил бежать' : '';
  }

  // ---------------------------------------------------------------- главный цикл
  update(dt) {
    if (!this.ready) return;
    const g = this.game, I = g.input, P = g.player, d = this.diff;
    this.fx.update(dt);
    if (this.ended) { this.updateHud(); return; }
    this.elapsed += dt;
    // время
    if (this.stage && this.stage.t === 'survive') {
      this.surviveLeft -= dt;
      if (this.surviveLeft <= 0) { this.nextStage(); return; }
    } else {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.fail('Время вышло. Урок окончен — навсегда.'); return; }
    }
    // управление выживанием
    if (I.pressed('KeyF')) { this.flashOn = !this.flashOn; this.audio.play('click'); }
    if (I.pressed('KeyR')) this.swapBattery();
    if (I.pressed('KeyC') || I.pressed('ControlLeft')) { this.crouch = !this.crouch; }
    const moving = P.speed > 0.3;
    const wantRun = I.running() && moving && !this.crouch;
    if (this.exhausted && this.stamina > 35) this.exhausted = false;
    P.canRun = !this.crouch && !this.exhausted && this.stamina > 0 && !this.hidden;
    P.speedMul = this.crouch ? 0.45 : 1;
    P.model.crouch = this.crouch && !this.hidden;
    const running = wantRun && P.canRun;
    if (running) { this.stamina -= dt * (20 + this.diffIndex * 2); if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.audio.play('breath'); } }
    else this.stamina = Math.min(100, this.stamina + dt * (moving ? 9 : 15));
    if (this.flashOn && this.battery > 0 && !this.hidden) {
      this.battery = Math.max(0, this.battery - dt * 1.25 * d.drain);
      if (this.battery === 0) { this.flashOn = false; this.fx.message('Фонарик сел. R — сменить батарейку', 2400); }
    }
    if (g.elapsedHurt === undefined) g.elapsedHurt = 0;
    if (this.elapsed - this.lastHurt > 8 && this.hp < 100) this.hp = Math.min(100, this.hp + dt * d.regen);

    // шум
    this.updateNoise(dt, moving, running);

    // монстры
    for (const m of this.monsters) m.update(dt);
    for (const s of this.decoys) s.update(dt);
    this.updateTemp(dt);
    this.tension = 0;
    for (const t of this.teachers) {
      const dd = t.distToPlayer();
      if (t.state === 'chase' || t.state === 'attack') this.tension = Math.max(this.tension, 1);
      else if (t.state === 'investigate') this.tension = Math.max(this.tension, 0.5 * Math.max(0, 1 - dd / 30));
      else this.tension = Math.max(this.tension, Math.max(0, 0.35 - dd / 60));
    }
    for (const s of this.shadows) if (s.state === 'stalk') this.tension = Math.max(this.tension, 0.65 * Math.max(0, 1 - s.distToPlayer() / 14));
    if (this.boss && this.boss.state !== 'dead' && this.boss.state !== 'idle') this.tension = Math.max(this.tension, 0.85);
    this.audio.setTension(this.tension, dt);
    this.audio.ambient(dt);
    if (this.hidden && Math.random() < dt * 0.15) this.audio.play('breath');

    this.updateEvents(dt);
    this.updateStage(dt);
    this.updateItems(dt);
    this.updateHud();
  }

  // ---------------------------------------------------------------- шум и обнаружение
  makeNoise(x, z, r, kind = '', loud = false) {
    this.noises.push({ x, z, r, t: performance.now(), loud, kind });
    this.noiseLevel = Math.max(this.noiseLevel, r / 16);
  }

  updateNoise(dt, moving, running) {
    const P = this.game.player, S = this.scene, p = P.pos;
    const now = performance.now();
    this.noises = this.noises.filter((n) => now - n.t < 1500);
    this.noiseLevel = Math.max(0, this.noiseLevel - dt * 0.8);
    const onGlass = S.zones.some((z) => z.kind === 'glass' && p.x > z.minX && p.x < z.maxX && p.z > z.minZ && p.z < z.maxZ);
    this.onGlass = onGlass;
    this.noiseT -= dt;
    if (moving && P.onGround && this.noiseT <= 0 && !this.hidden) {
      this.noiseT = 0.35;
      let r = running ? 14 : this.crouch ? 1.2 : 6;
      let loud = running;
      if (onGlass && !this.crouch) { r = 16; loud = true; this.audio.play('crunch'); }
      this.makeNoise(p.x, p.z, r, onGlass ? 'glass' : 'step', loud);
      if (loud) this.onLoud(onGlass ? 'стекло под ногами' : 'бег');
    }
    if (P.justLanded) {
      P.justLanded = false;
      const r = onGlass && !this.crouch ? 16 : this.crouch ? 2 : 7;
      this.makeNoise(p.x, p.z, r, 'land', r >= 16);
      if (r >= 16) this.onLoud('приземление на стекло');
    }
    // нити с колокольчиками
    for (const w of S.wires) {
      if (this.prevZ !== undefined && p.x > w.minX && p.x < w.maxX && (this.prevZ - w.z) * (p.z - w.z) < 0 && p.y < 0.3) {
        this.audio.at('bells', p);
        this.makeNoise(p.x, p.z, 20, 'bells', true);
        this.onLoud('задета нить с колокольчиками');
      }
    }
    this.prevZ = p.z;
  }

  onLoud(what) {
    this.stats.noise++;
    const st = this.stage;
    if (st && st.t === 'stealth' && this.stealthIn) {
      if (this.diffIndex >= 4) { this.fail(`Шум в классе-ловушке: ${what}. На HELL это провал.`); return; }
      this.penalty('noise', 1, `Громкий звук: ${what}! Начни заново.`);
      this.stealthIn = false;
      const P = this.game.player;
      P.place(this.stealthReset.x, 0, this.stealthReset.z, P.facing);
    }
  }

  onDetected(monster) {
    if (this.hidden) return;
    this.fx.message('ОНА ТЕБЯ ВИДИТ', 1600, 'alert');
    this.audio.play('stinger');
  }

  // ---------------------------------------------------------------- урон и смерть
  damage(amount, src, opts = {}) {
    if (this.ended || this.dead) return;
    amount = Math.round(amount);
    this.hp -= amount;
    this.lastHurt = this.elapsed;
    this.stats.damage += amount;
    this.fx.damage(amount);
    this.audio.play('hit');
    const P = this.game.player;
    if (src && src.pos) {
      const dx = P.pos.x - src.pos.x, dz = P.pos.z - src.pos.z, l = Math.hypot(dx, dz) || 1;
      P.pos.x += (dx / l) * 1.2; P.pos.z += (dz / l) * 1.2;
      this.scene.world.resolve(P.pos, 0.32, 1.6);
    }
    if (this.puzzleOpen) { this.closePuzzle(); this.game.ui.toast('🩸 Тебя оторвали от задачи!', 'warn'); }
    if (amount >= 28 || opts.shadow) this.fx.screamer(src ? src.kind : 'teacher');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.fail(src && src.kind === 'headmaster' ? 'Директор поставил тебе «неуд». Навсегда.' : src && src.kind === 'shadow' ? 'Тень забрала тебя в темноту.' : 'Учитель поймал тебя в коридоре.');
    }
  }

  penalty(kind, count = 1, msg = '') {
    const pen = (this.mission.pen && this.mission.pen[kind]) || {};
    this.stats.wrong += count;
    this.audio.play('wrongH');
    if (pen.time) this.addTime(-pen.time * count);
    if (pen.dmg) { this.hp -= pen.dmg * count; this.lastHurt = this.elapsed; this.fx.damage(pen.dmg * count); if (this.hp <= 0) { this.hp = 0; this.fail('Ты не выдержал боли.'); return; } }
    if (pen.alert) {
      const p = this.game.player.pos;
      this.makeNoise(p.x, p.z, 28, 'alert', true);
      for (const t of this.teachers) { t.aware = Math.max(t.aware, 0.9); if (t.state !== 'chase') { t.setState('investigate'); t.goTo(p.x, p.z); } }
    }
    if (pen.blackout) this.startBlackout(7);
    if (this.boss && this.boss.state !== 'dying' && this.boss.state !== 'dead' && this.stage && this.stage.t === 'boss') this.boss.teleportNear();
    const parts = [];
    if (pen.time) parts.push(`−${pen.time * count} сек`);
    if (pen.dmg) parts.push(`−${pen.dmg * count} HP`);
    if (pen.alert) parts.push('монстр услышал');
    this.game.ui.toast(`☠️ ${msg}${parts.length ? '<br><small>' + parts.join(' · ') + '</small>' : ''}`, 'warn', 3200);
    if (this.puzzleStatus) this.puzzleStatus.textContent = msg;
  }

  addTime(s) { this.timeLeft = Math.max(1, this.timeLeft + s); }

  swapBattery() {
    if (this.batteries <= 0) { this.fx.message('Батареек нет', 1400); return; }
    if (this.battery > 90) return;
    this.batteries--;
    this.battery = 100;
    this.flashOn = true;
    this.audio.play('battery');
  }

  // ---------------------------------------------------------------- шкафчики
  toggleHide(L) {
    const g = this.game, P = g.player;
    if (this.hidden) {
      const H = this.hidden;
      this.hidden = null;
      P.frozen = false;
      P.object.visible = true;
      P.place(H.out.x, 0, H.out.z, H.face > 0 ? 0 : Math.PI);
      g.cam.override = null;
      this.fx.setHidden(false);
      this.audio.at('locker', H);
      return;
    }
    // если учитель в погоне и видит — он запомнит шкафчик
    L.seenBy = this.teachers.find((t) => t.state === 'chase' && t.lastSeenNow) || null;
    this.hidden = L;
    this.stats.hides++;
    P.frozen = true;
    P.object.visible = false;
    const inside = new THREE.Vector3(L.x, 1.55, L.z);
    g.cam.override = { pos: inside, look: new THREE.Vector3(L.x, 1.4, L.z + L.face * 3) };
    this.fx.setHidden(true);
    this.audio.at('locker', L);
    this.makeNoise(L.x, L.z, 4, 'locker');
  }

  pullOut(monster) {
    if (!this.hidden) return;
    this.toggleHide(this.hidden);
    this.fx.screamer(monster.kind);
    this.damage(30 * this.diff.damage, monster);
  }

  // ---------------------------------------------------------------- предметы
  itemMesh(kind) {
    const g = new THREE.Group();
    const M = (c, e = '#000') => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: e, roughness: 0.5, metalness: 0.2 }); m.userData.own = true; return m; };
    const add = (geo, mat, y = 0.1, r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.set(...r); m.castShadow = true; g.add(m); return m; };
    switch (kind) {
      case 'fragment': add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 6), M('#7a7068', '#3a0000'), 0.05); break;
      case 'fuse': add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), M('#d8d0c0'), 0.05, [0, 0, Math.PI / 2]); add(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10), M('#a08a40', '#201800'), 0.05, [0, 0, Math.PI / 2]).position.x = 0.13; break;
      case 'key': add(new THREE.TorusGeometry(0.07, 0.02, 6, 12), M('#c9a040', '#4a3000'), 0.05, [Math.PI / 2, 0, 0]); add(new THREE.BoxGeometry(0.2, 0.02, 0.03), M('#c9a040', '#4a3000'), 0.05).position.x = 0.15; break;
      case 'gear': add(new THREE.TorusGeometry(0.11, 0.035, 6, 10), M('#8a8070', '#201a10'), 0.05, [Math.PI / 2, 0, 0]); break;
      case 'reagent': add(new THREE.CylinderGeometry(0.06, 0.1, 0.25, 10), M(['#3fa36b', '#a33f3f', '#3f6ba3', '#c9a03f'][Math.floor(Math.random() * 4)], '#1a1a10'), 0.14); break;
      case 'battery': add(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10), M('#2a2a2a'), 0.05, [0, 0, Math.PI / 2]); add(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 10), M('#3aff6a', '#0a6a20'), 0.05, [0, 0, Math.PI / 2]); break;
      case 'medkit': add(new THREE.BoxGeometry(0.35, 0.18, 0.25), M('#d8d0c4'), 0.09); add(new THREE.BoxGeometry(0.2, 0.19, 0.06), M('#b01010', '#300000'), 0.09); add(new THREE.BoxGeometry(0.06, 0.19, 0.2), M('#b01010', '#300000'), 0.09); break;
      default: add(new THREE.BoxGeometry(0.3, 0.01, 0.4), M('#c8c0a8', '#1a1810'), 0.02, [0, Math.random() * 3, 0]); break;
    }
    return g;
  }

  spawnItem(kind, x, z, extra = {}) {
    const S = this.scene;
    const mesh = this.itemMesh(kind);
    mesh.position.set(x, 0, z);
    S.dyn.add(mesh);
    const it = { kind, x, z, mesh, taken: false, ...extra };
    it.interact = S.interact({
      pos: [x, 0.6, z], radius: 1.4,
      prompt: () => (it.kind === 'exam' ? 'Осмотреть экзаменационный лист' : `Подобрать: ${ITEM_NAMES[it.kind]}`),
      enabled: () => !it.taken && !this.ended,
      action: () => this.pickup(it),
    });
    if (this.diff.hints >= 2 && kind !== 'battery' && kind !== 'medkit') it.label = S.label([x, 0.9, z], ITEM_NAMES[kind], { maxDist: 9, cls: 'room' });
    this.items.push(it);
    return it;
  }

  spawnItemInRoom(kind, room, extra) {
    const spots = this.scene.itemSpots[room.id] || [{ x: room.xc, z: room.zc }];
    this._used = this._used || new Set();
    let s = spots.find((p) => !this._used.has(p.x + ',' + p.z)) || spots[0];
    this._used.add(s.x + ',' + s.z);
    return this.spawnItem(kind, s.x + (Math.random() - 0.5) * 0.4, s.z + (Math.random() - 0.5) * 0.4, extra);
  }

  removeItem(it) {
    it.taken = true;
    it.mesh.removeFromParent();
    if (it.label) it.label.visible = () => false;
  }

  pickup(it) {
    const g = this.game;
    if (it.kind === 'exam') { this.inspectExam(it); return; }
    this.removeItem(it);
    this.stats.pickups++;
    this.audio.play('pickup');
    this.makeNoise(it.x, it.z, 2, 'pick');
    if (it.kind === 'battery') { this.batteries++; g.ui.toast('🔋 Батарейка (+1). R — заменить'); return; }
    if (it.kind === 'medkit') { this.hp = Math.min(100, this.hp + 40); g.ui.toast('➕ Аптечка: +40 HP'); return; }
    const st = this.stage;
    if (it.kind === 'fragment') {
      const f = this.state.fragments[it.idx];
      f.found = true;
      g.ui.toast(`🧩 Осколок: фигура с ${f.n} вершинами, цифра <b>${f.d}</b>`, '', 4500);
    }
    if (it.kind === 'keypart') {
      const i = it.idx;
      this.state.vkeyParts.push({ i, c: this.state.vkey[i] });
      g.ui.toast(`🔐 Клочок ключа: буква №${i + 1} — <b>${this.state.vkey[i]}</b>`, '', 5000);
    }
    if (it.kind === 'doc') this.showDoc(it.idx);
    if (it.kind === 'page') g.ui.toast('📄 Страница с условиями расписания найдена', '', 3000);
    if (st && st.t === 'collect' && st.item === it.kind) {
      this.collected++;
      if (this.collected >= st.n) this.nextStage();
      else this.setObjective();
    }
  }

  showDoc(i) {
    const g = this.game;
    const el = h('div', { class: 'overlay hz-overlay', onclick: (e) => e.target === el && close() },
      h('div', { class: 'panel hz-panel hz-paper pop' }, h('p', { class: 'hz-hand' }, DOCS[i]), h('button', { class: 'btn red', onclick: () => close() }, 'Убрать')));
    const close = () => g.ui.closeModal('hzdoc');
    el._close = close;
    g.ui.openModal('hzdoc', el);
  }

  updateItems(dt) {
    const t = performance.now() / 1000;
    for (const it of this.items) if (!it.taken) { it.mesh.rotation.y += dt * 0.8; it.mesh.position.y = 0.02 + Math.sin(t * 2 + it.x) * 0.02; }
  }

  // ---------------------------------------------------------------- этапы
  nextStage() {
    if (this.ended) return;
    this.cleanupStage();
    this.stageIdx++;
    // этапы, которые есть только на высокой сложности
    while (this.stageIdx < this.mission.stages.length && this.mission.stages[this.stageIdx].hard > this.diffIndex) this.stageIdx++;
    if (this.stageIdx >= this.mission.stages.length) { this.win(); return; }
    this.setStage(this.mission.stages[this.stageIdx]);
    if (this.stageIdx > 0) { this.audio.play('rightH'); this.fx.message('ЭТАП ПРОЙДЕН', 1500, 'ok'); }
  }

  cleanupStage() {
    if (this.stationIt) { this.stationIt.enabled = () => false; this.stationIt = null; }
    if (this.stationMark) { this.stationMark.removeFromParent(); this.stationMark = null; }
    for (const d of this.decoys) d.remove();
    this.decoys = [];
  }

  setStage(st) {
    const S = this.scene, d = this.diff;
    this.stage = st;
    this.collected = 0;
    this.target = null;
    switch (st.t) {
      case 'collect': {
        let rooms = this.shuffled(ROOMS.filter((r) => r.type !== 'trap'));
        for (let i = 0; i < st.n; i++) {
          let it;
          if (st.where === 'maze' && S.maze) {
            const c = S.maze.cell(Math.floor(Math.random() * S.maze.NX), Math.floor(Math.random() * (S.maze.NZ - 1)));
            it = this.spawnItem(st.item, c.x, c.z);
          } else if (st.where && roomById(st.where)) it = this.spawnItemInRoom(st.item, roomById(st.where));
          else it = this.spawnItemInRoom(st.item, rooms[i % rooms.length]);
          it.idx = i;
        }
        break;
      }
      case 'puzzle': this.makeStation(st); break;
      case 'reach': {
        const r = roomById(st.at);
        this.target = r ? new THREE.Vector3(r.xc, 0, r.zc) : S.points[st.at].clone();
        if (st.at === 'exit' && this.powerOff === false && this.mission.blackout) this.fx.message('СВЕТ ЕСТЬ. БЕГИ!', 2000);
        if (st.at === 'gym' && S.gymDoor) S.gymDoor.locked = false;
        break;
      }
      case 'survive': this.surviveLeft = st.sec + this.diff.extra * 30; this.surviveTick = 60; break;
      case 'stealth': {
        const r = roomById(st.at);
        const front = { x: r.doorX, z: -3.1 }, back = { x: r.backX, z: -10.9 };
        this.stealthStart = st.dir > 0 ? front : back;
        this.stealthGoal = st.dir > 0 ? back : front;
        this.stealthReset = st.dir > 0 ? { x: r.doorX, z: -0.8 } : { x: r.backX, z: -13.4 };
        this.stealthIn = false;
        this.target = new THREE.Vector3(this.stealthStart.x, 0, this.stealthStart.z);
        this.game.ui.tip('В классе-ловушке: <b>пригнись (C)</b> — по стеклу можно идти только так. Красные нити с колокольчиками <b>перепрыгивай (пробел)</b>. Не беги!', null, 10000, '');
        break;
      }
      case 'identify': this.setupIdentify(st); break;
      case 'trail': this.setupTrail(); break;
      case 'exams': this.setupExams(st); break;
      case 'boss': this.setupBoss(); break;
      default: break;
    }
    this.setObjective();
  }

  setObjective() {
    const st = this.stage;
    if (!st) return;
    let text = st.label;
    if (st.t === 'collect') text += ` (${this.collected}/${st.n})`;
    if (st.t === 'exams') text += ` (${this.collected}/${st.n})`;
    if (st.t === 'boss') text = this.bossText();
    this.objective = text;
    this.game.hud.setQuest(this.fake ? this.fake.text : text, '', this.fake ? '❓' : this.mission.icon);
  }

  subText() {
    const st = this.stage;
    if (!st) return '';
    const total = this.mission.stages.filter((x) => !(x.hard > this.diffIndex)).length;
    const cur = this.mission.stages.slice(0, this.stageIdx + 1).filter((x) => !(x.hard > this.diffIndex)).length;
    return `Этап ${cur}/${total}`;
  }

  makeStation(st, pos = null, def = null) {
    const S = this.scene;
    let p;
    if (pos) p = pos;
    else if (st.door) { const r = roomById(st.at); p = { x: r.doorX + 1.3, z: r.side * 0.9, yaw: 0 }; }
    else p = S.stations[st.at];
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0.8 }));
    mark.material.userData.own = true;
    mark.rotation.x = Math.PI / 2;
    mark.position.set(p.x, 0.04, p.z);
    S.dyn.add(mark);
    this.stationMark = mark;
    this.target = new THREE.Vector3(p.x, 0, p.z);
    const P = def || st;
    this.stationIt = S.interact({
      pos: [p.x, 1, p.z], radius: 1.8,
      prompt: () => `🩸 ${PUZZLE_TITLES[P.p]}${st.door ? ' (кодовый замок)' : ''}`,
      action: () => this.openPuzzle(P, st),
    });
  }

  updateStage(dt) {
    const st = this.stage, P = this.game.player, p = P.pos;
    if (!st) return;
    if (this.stationMark) { this.stationMark.rotation.z += dt; this.stationMark.material.opacity = 0.5 + 0.4 * Math.sin(performance.now() / 300); }
    switch (st.t) {
      case 'reach': if (Math.hypot(p.x - this.target.x, p.z - this.target.z) < 2.3) this.nextStage(); break;
      case 'survive': {
        this.surviveTick -= dt;
        if (this.surviveTick <= 0) {
          this.surviveTick = 60;
          const alive = this.scene.lamps.filter((l) => l.state !== 'dead');
          for (let k = 0; k < 3 && alive.length; k++) alive.splice(Math.floor(Math.random() * alive.length), 1)[0].state = 'dead';
          this.fx.message('ЛАМПЫ ГАСНУТ', 1800);
        }
        break;
      }
      case 'stealth': {
        const s = this.stealthStart, gl = this.stealthGoal;
        if (!this.stealthIn && Math.hypot(p.x - s.x, p.z - s.z) < 1.3) { this.stealthIn = true; this.target = new THREE.Vector3(gl.x, 0, gl.z); this.fx.message('ТИШЕ…', 1500); }
        if (this.stealthIn && Math.hypot(p.x - gl.x, p.z - gl.z) < 1.2) { this.stealthIn = false; this.nextStage(); }
        break;
      }
      case 'trail': {
        if (p.x > 44.3 && p.z < -12.2) { this.nextStage(); break; }
        for (const f of this.fakeEnds) if (!f.hit && Math.hypot(p.x - f.x, p.z - f.z) < 1.6) {
          f.hit = true;
          this.fx.screamer('shadow');
          const s = this.shadows.find((x) => x.state === 'dormant');
          if (s) s.spawn(true);
          this.penalty('wrong', 1, 'Ложный след!');
        }
        break;
      }
      default: break;
    }
  }

  // ---------------------------------------------------------------- головоломки
  openPuzzle(P, st) {
    const g = this.game;
    if (this.puzzleOpen || this.ended) return;
    const fn = PUZZLES[P.p];
    this.puzzleOpen = true;
    const status = h('div', { class: 'hz-status' }, '');
    this.puzzleStatus = status;
    const body = h('div', { class: 'hz-pbody' });
    const close = () => this.closePuzzle();
    const el = h('div', { class: 'overlay hz-overlay' },
      h('div', { class: 'panel hz-panel pop' },
        h('div', { class: 'hz-phead' }, h('div', {}, h('h2', {}, PUZZLE_TITLES[P.p]), h('small', {}, st.label || '')), h('button', { class: 'close-x', onclick: close }, '✕')),
        h('div', { class: 'hz-warnline' }, '⚠ Мир не на паузе — монстры продолжают охоту'),
        body, status));
    el._close = close;
    g.ui.openModal('hzp', el);
    const api = {
      mode: this, extra: this.diff.extra, hints: this.diff.hints, seed: this.seed,
      data: (k, f) => (this.cache[k] ??= f()),
      wrong: (msg, n = 1) => this.penalty('wrong', n, msg),
      solve: () => { this.closePuzzle(); this.audio.play('rightH'); (st._onSolve || (() => this.nextStage()))(); },
      status: (t) => (status.textContent = t),
      sound: (n) => this.audio.play(n),
      note: (s) => this.audio.note(s),
    };
    try { fn(body, P.params || {}, api); } catch (e) { console.error(e); }
  }

  closePuzzle() {
    if (!this.puzzleOpen) return;
    this.puzzleOpen = false;
    this.puzzleStatus = null;
    this.game.ui.closeModal('hzp');
  }

  // ---------------------------------------------------------------- «Кто из них»
  setupIdentify(st) {
    const S = this.scene;
    const n = 5 + this.diff.extra;
    let pts = [];
    if (st.at === 'corridor') for (let k = 0; k < n; k++) pts.push([-14 + k * (28 / n) + Math.random(), (k % 2 ? 1 : -1) * (0.9 + Math.random() * 0.4)]);
    else {
      const r = roomById(st.at);
      for (let k = 0; k < n; k++) pts.push([r.xc - 3.6 + (k % 4) * 2.4 + (Math.random() - 0.5) * 0.5, r.zc + (Math.floor(k / 4) - 0.5) * 2.6 * r.side + (Math.random() - 0.5) * 0.5]);
    }
    const realIdx = Math.floor(Math.random() * n);
    this.decoys = pts.map(([x, z], k) => new Silhouette(this, x, z, k === realIdx));
    this.decoys.forEach((s) => {
      s.it = S.interact({
        pos: [s.pos.x, 1, s.pos.z], radius: 1.6,
        prompt: '👁 Это он! (изгнать)',
        enabled: () => this.stage === st && !s.gone,
        action: () => this.chooseSilhouette(s, st),
      });
    });
    const r = roomById(st.at);
    this.target = r ? new THREE.Vector3(r.xc, 0, r.zc) : new THREE.Vector3(0, 0, 0);
    this.game.ui.tip(this.diffIndex < 4 ? 'Настоящий почти не отличается… но <b>следит за тобой головой</b>, а его глаза <b>блестят в луче фонарика</b>.' : 'Настоящий почти не отличается. Смотри внимательно, кто следит за тобой.', null, 9000, '');
  }

  chooseSilhouette(s, st) {
    if (s.real) {
      s.gone = true;
      s.play('Scream', { once: true });
      this.audio.at('scream', s.pos);
      this.fx.smoke(s.pos);
      setTimeout(() => this.nextStage(), 900);
      return;
    }
    // ошибка: настоящий бросается, фигуры меняются местами
    const real = this.decoys.find((x) => x.real);
    real.play('Attack', { once: true });
    this.penalty('wrong', 1, 'Это был манекен. Настоящий бросился на тебя!');
    this.damage(25 * this.diff.damage, real);
    s.gone = true;
    s.root.visible = false;
    const alive = this.decoys.filter((x) => !x.gone && !x.real);
    if (alive.length) {
      const other = alive[Math.floor(Math.random() * alive.length)];
      const a = real.pos.clone();
      real.pos.copy(other.pos);
      other.pos.copy(a);
      real.it.pos.set(real.pos.x, 1, real.pos.z);
      other.it.pos.set(other.pos.x, 1, other.pos.z);
    }
  }

  // ---------------------------------------------------------------- «Кровавый след»
  setupTrail() {
    const S = this.scene;
    const s8 = roomById('s8'), s6 = roomById('s6'), n7 = roomById('n7');
    S.trail([[8, 0.3], [s8.doorX, 0.2], [s8.doorX, -3.3], [s8.xc, -7], [s8.backX, -10.7], [s8.backX, -13.4], [43.5, -13.5], [47, -15.5]]);
    S.trail([[s6.doorX - 2, 0.2], [s6.doorX, 0], [s6.doorX, -3.3], [s6.xc - 1, -8]], true);
    S.trail([[n7.doorX - 3, -0.2], [n7.doorX, 0], [n7.doorX, 3.3], [n7.xc - 2, 8]], true);
    this.fakeEnds = [{ x: s6.xc - 1, z: -8 }, { x: n7.xc - 2, z: 8 }];
    this.target = new THREE.Vector3(8, 0, 0.3);
    this.game.ui.toast('🩸 Следы начинаются в коридоре у Кабинета 4. Не все следы настоящие — у настоящего следа есть капли крови.', 'warn', 6500);
  }

  // ---------------------------------------------------------------- «Ложные задания»
  setupExams(st) {
    const kinds = ['real', 'real', 'real', 'real', 'real', 'num', 'date', 'blue', 'sign'];
    const rooms = this.shuffled(ROOMS.filter((r) => r.type !== 'trap'));
    this.shuffled(kinds).forEach((k, i) => { const it = this.spawnItemInRoom('exam', rooms[i]); it.exam = k; });
    this.game.ui.tip('Настоящий лист: <b>красная</b> печать «Школа №13», существующая дата и подпись Директора. Всё остальное — подделка.', null, 12000, '');
  }

  inspectExam(it) {
    const g = this.game;
    const k = it.exam;
    const num = k === 'num' ? '31' : '13';
    const date = k === 'date' ? '31.11' : ['12.11', '14.11', '13.11', '27.11', '03.12'][Math.floor(it.x * 7 + 100) % 5];
    const stamp = k === 'blue' ? '#1f3f9a' : '#9a1f1f';
    const sign = k === 'sign' ? '' : '<span class="sig">Дир. ⟆⟆⟆</span>';
    const close = () => g.ui.closeModal('hzexam');
    const el = h('div', { class: 'overlay hz-overlay' },
      h('div', { class: 'panel hz-panel hz-paper pop' },
        h('div', { class: 'hz-exam', html: `<h3>ЭКЗАМЕНАЦИОННЫЙ ЛИСТ</h3><p>Дата: <b>${date}</b></p><p>Ученик: ████████</p><p>Оценка: <b>2</b></p><div class="stamp" style="color:${stamp};border-color:${stamp}">ШКОЛА №${num}<br>ПЕЧАТЬ</div>${sign}` }),
        h('div', { class: 'hz-row' },
          h('button', { class: 'btn red', onclick: () => {
            close();
            this.removeItem(it);
            if (k === 'real') { this.collected++; this.audio.play('pickup'); this.setObjective(); if (this.collected >= this.stage.n) this.nextStage(); }
            else {
              this.penalty('fake', 1, 'Подделка! Это была ловушка.');
              this.fx.screamer('shadow');
              const s = this.shadows.find((x) => x.state === 'dormant');
              if (s) s.spawn(true);
            }
          } }, 'Взять'),
          h('button', { class: 'btn white', onclick: close }, 'Оставить'))));
    el._close = close;
    g.ui.openModal('hzexam', el);
  }

  // ---------------------------------------------------------------- босс
  setupBoss() {
    const S = this.scene;
    this.seals = 0;
    const defs = [{ p: 'circuits', params: { n: 6 } }, { p: 'cipher', params: { mode: 'caesar' } }, { p: 'combo', params: { k: 7 } }];
    S.seals.forEach((s, k) => {
      const st = { t: 'seal', label: `Печать ${k + 1}/3`, _onSolve: () => this.breakSeal(s) };
      s.it = S.interact({
        pos: [s.x, 1, s.z], radius: 1.8,
        prompt: () => `🔴 Печать Директора ${k + 1}: ${PUZZLE_TITLES[defs[k].p]}`,
        enabled: () => !s.broken && !this.ended,
        action: () => this.openPuzzle(defs[k], st),
      });
    });
    this.target = new THREE.Vector3(S.seals[0].x, 0, S.seals[0].z);
    this.fx.screamer('headmaster');
    this.fx.message('ДИРЕКТОР ЖДАЛ ТЕБЯ', 2500, 'alert');
  }

  bossText() { return this.seals >= 3 ? 'Сдай финальный экзамен за столом в центре зала' : `Сломай печати Директора (${this.seals}/3)`; }

  breakSeal(s) {
    const S = this.scene;
    s.broken = true;
    s.rune.material.color.set('#222');
    this.seals++;
    this.boss.stage = Math.min(3, this.boss.stage + 1);
    this.boss.roar();
    this.startBlackout(3);
    const next = S.seals.find((x) => !x.broken);
    if (next) this.target = new THREE.Vector3(next.x, 0, next.z);
    if (this.seals >= 3) {
      const st = { t: 'exam', label: 'Финальный экзамен', _onSolve: () => this.bossDefeated() };
      this.makeStation(st, { x: S.examDesk.x, z: S.examDesk.z - 1.2 }, { p: 'exam' });
    }
    this.setObjective();
  }

  bossDefeated() {
    this.boss.die();
    this.fx.message('ЭКЗАМЕН СДАН', 3000, 'ok');
    this.cleanupStage();
    setTimeout(() => this.nextStage(), 3600);
  }

  // ---------------------------------------------------------------- события
  startBlackout(sec) {
    if (this.blackout && !this.blackoutT) return;
    this.blackout = true;
    this.blackoutT = Math.max(this.blackoutT || 0, sec);
    this.audio.play('buzz');
    this.audio.play('thud');
  }

  updateEvents(dt) {
    if (this.blackoutT > 0) {
      this.blackoutT -= dt;
      if (this.blackoutT <= 0) { this.blackoutT = 0; this.blackout = this.powerOff; this.audio.play('switch'); }
    }
    if (this.fake) {
      this.fake.t -= dt;
      const p = this.game.player.pos;
      if (Math.hypot(p.x - this.fake.pos.x, p.z - this.fake.pos.z) < 2.2) {
        this.fx.screamer('shadow');
        this.penalty('fake', 1, 'Ложное задание! Школа солгала.');
        const s = this.shadows.find((x) => x.state === 'dormant');
        if (s) s.spawn(true);
        this.fake = null; this.setObjective();
      } else if (this.fake.t <= 0) { this.fake = null; this.setObjective(); }
    }
    this.evT -= dt * this.diff.events;
    if (this.evT > 0) return;
    this.evT = 16 + Math.random() * 24;
    const w = [
      ['blackout', this.powerOff ? 0 : 3], ['figure', 3], ['door', 4], ['fall', 3], ['behind', 4], ['message', 3], ['lamp', 2], ['writing', 2],
      ['shift', this.scene.barricades.length ? 2 : 0], ['maze', this.scene.maze ? 6 : 0], ['fakeTask', this.mission.falseTasks ? 5 : this.diffIndex >= 2 ? 1 : 0],
      ['screamer', this.puzzleOpen || this.hidden ? 0 : 1], ['ambush', this.teachers.length ? 2 : 0],
    ];
    const total = w.reduce((a, b) => a + b[1], 0);
    let r = Math.random() * total;
    const ev = w.find(([, k]) => (r -= k) < 0)[0];
    this.runEvent(ev);
  }

  runEvent(ev) {
    const g = this.game, S = this.scene, p = g.player.pos;
    switch (ev) {
      case 'blackout': this.startBlackout(6 + Math.random() * 8); if (Math.random() < 0.5) this.fx.message('СВЕТ…', 1200); break;
      case 'figure': {
        const yaw = g.cam.yaw;
        const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        for (let d = 18; d > 9; d -= 1.5) {
          const x = p.x + dir.x * d, z = p.z + dir.z * d;
          if (S.world.pointBlocked(x, 1, z, 0.4) || !S.los(p.x, 1.5, p.z, x, 1.5, z)) continue;
          const sil = new Silhouette(this, x, z, false);
          sil.root.rotation.y = Math.atan2(p.x - x, p.z - z);
          this.temp.push({ obj: sil, t: 3.5, near: 7 });
          this.audio.play('stinger');
          break;
        }
        break;
      }
      case 'door': {
        const ds = S.doors.filter((d) => !d.locked && Math.hypot(d.x - p.x, d.z - p.z) < 16);
        if (ds.length) { const d = ds[Math.floor(Math.random() * ds.length)]; S.setDoor(d, !d.target); this.makeNoise(d.x, d.z, 8, 'door'); }
        break;
      }
      case 'fall': {
        const a = Math.random() * Math.PI * 2, x = p.x + Math.sin(a) * 2.5, z = p.z + Math.cos(a) * 2.5;
        if (S.world.pointBlocked(x, 1, z, 0.2)) break;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: '#3a2a20' }));
        m.material.userData.own = true;
        m.position.set(x, 3, z);
        S.dyn.add(m);
        this.temp.push({ fall: m, v: 0 });
        break;
      }
      case 'behind': {
        const yaw = g.cam.yaw;
        const pos = { x: p.x + Math.sin(yaw) * 2, z: p.z + Math.cos(yaw) * 2 };
        this.audio.at(Math.random() < 0.5 ? 'whisper' : 'mstep', pos, { close: true });
        break;
      }
      case 'message': this.fx.message(SCARY[Math.floor(Math.random() * SCARY.length)], 2400); break;
      case 'lamp': {
        const l = S.lamps.filter((x) => x.state !== 'dead').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        if (l && Math.hypot(l.x - p.x, l.z - p.z) < 14) { l.state = 'dead'; this.audio.at('glass', { x: l.x, z: l.z }); this.audio.at('spark', { x: l.x, z: l.z }); }
        break;
      }
      case 'writing': {
        const n = Math.random() < 0.5;
        const z = n ? 1.88 : -1.88;
        if (Math.abs(p.z) > 2.5) break;
        const m = bloodText(['Я ЗА ТОБОЙ', 'БЕГИ', 'ТЫ ОПОЗДАЛ', 'НЕ ОБОРАЧИВАЙСЯ'][Math.floor(Math.random() * 4)], 2.6, 0.8);
        m.position.set(p.x + (Math.random() - 0.5) * 3, 1.8, z);
        m.rotation.y = n ? Math.PI : 0;
        S.dyn.add(m);
        this.audio.play('whisper');
        break;
      }
      case 'shift': {
        const cur = S.barricades.findIndex((b) => b.on);
        let k = Math.floor(Math.random() * S.barricades.length);
        if (k === cur) k = (k + 1) % S.barricades.length;
        if (Math.abs(S.barricades[k].x - p.x) < 2.5 && Math.abs(p.z) < 2.2) break;
        S.setBarricade(k);
        this.audio.play('thud');
        this.fx.message('ШКОЛА МЕНЯЕТСЯ', 1800);
        for (const t of this.teachers) t.path = [];
        break;
      }
      case 'maze': {
        S.shuffleMaze();
        this.audio.play('roar');
        g.cam.shake = 0.25;
        this.fx.message('ЛАБИРИНТ ПЕРЕСТРОИЛСЯ', 1800);
        break;
      }
      case 'fakeTask': {
        const r = ROOMS[Math.floor(Math.random() * ROOMS.length)];
        this.fake = { text: `Срочно иди в «${r.name}»`, pos: new THREE.Vector3(r.xc, 0, r.zc), t: 14 };
        this.setObjective();
        this.audio.play('click');
        break;
      }
      case 'screamer': this.fx.screamer(['teacher', 'shadow'][Math.floor(Math.random() * 2)]); break;
      case 'ambush': {
        const t = this.teachers.find((x) => x.state === 'patrol' && x.distToPlayer() > 16);
        if (!t) break;
        const rooms = ROOMS.filter((r) => { const dd = Math.hypot(r.doorX - p.x, r.doorZ - p.z); return dd > 6 && dd < 18; });
        if (!rooms.length) break;
        const r = rooms[Math.floor(Math.random() * rooms.length)];
        // только если игрок не видит, как она туда «переходит»
        if (!S.los(p.x, 1.5, p.z, t.pos.x, 1.5, t.pos.z)) t.ambush(r);
        break;
      }
      default: break;
    }
  }

  updateTemp(dt) {
    const p = this.game.player.pos;
    for (let i = this.temp.length - 1; i >= 0; i--) {
      const e = this.temp[i];
      if (e.fall) {
        e.v += 14 * dt;
        e.fall.position.y -= e.v * dt;
        e.fall.rotation.x += dt * 4;
        if (e.fall.position.y <= 0.15) {
          e.fall.position.y = 0.15;
          this.audio.at('thud', e.fall.position);
          this.makeNoise(e.fall.position.x, e.fall.position.z, 12, 'fall', true);
          this.temp.splice(i, 1);
        }
        continue;
      }
      e.t -= dt;
      const d = e.obj.distToPlayer();
      if (e.t <= 0 || d < e.near) { this.fx.smoke(e.obj.pos); e.obj.remove(); this.temp.splice(i, 1); }
    }
    void p;
  }

  // цель для стрелки/маркера (с учётом подсказок)
  targetPoint() {
    if (!this.ready || this.ended || this.diff.hints === 0) return null;
    if (this.fake) return this.fake.pos;
    const st = this.stage;
    if (!st) return null;
    if ((st.t === 'collect' || st.t === 'exams') && this.diff.hints >= 1) {
      const p = this.game.player.pos;
      const kind = st.t === 'exams' ? 'exam' : st.item;
      const left = this.items.filter((it) => !it.taken && it.kind === kind);
      if (!left.length) return null;
      if (this.diff.hints < 2) return null;
      left.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      return new THREE.Vector3(left[0].x, 0, left[0].z);
    }
    return this.target;
  }

  // ---------------------------------------------------------------- финал
  fail(reason) {
    if (this.ended) return;
    this.ended = true;
    this.closePuzzle();
    const g = this.game, H = g.save.data.horror;
    H.deaths = (H.deaths || 0) + 1;
    g.save.log('horror', `Провал миссии «${this.mission.name}» (${this.diff.name}): ${reason}`);
    g.save.save();
    this.audio.play('roar');
    this.fx.message('', 10);
    setTimeout(() => this.endScreen(false, reason), 900);
  }

  win() {
    if (this.ended) return;
    this.ended = true;
    const g = this.game, H = g.save.data.horror, m = this.mission;
    const mult = 1 + this.diffIndex * 0.5;
    const coins = Math.round(m.reward.coins * mult);
    const xp = Math.round(m.reward.xp * mult);
    g.save.addCoins(coins, 'horror');
    g.save.addXp(xp);
    const rec = (H.done[m.id] ||= { best: -1, time: null });
    rec.best = Math.max(rec.best, this.diffIndex);
    rec.time = rec.time ? Math.min(rec.time, Math.round(this.elapsed)) : Math.round(this.elapsed);
    g.save.log('horror', `Пройдена миссия «${m.name}» на ${this.diff.name} за ${Math.round(this.elapsed)} сек (+${coins} монет)`);
    g.save.save();
    this.endScreen(true, '', { coins, xp });
  }

  endScreen(ok, reason, rew = {}) {
    const g = this.game;
    const s = this.stats;
    const m = this.mission;
    const t = Math.round(this.elapsed);
    const el = h('div', { class: `overlay hz-overlay hz-end ${ok ? 'win' : 'lose'}` },
      h('div', { class: 'panel hz-panel pop' },
        h('h1', {}, ok ? 'ТЫ ВЫЖИЛ' : 'ТЫ НЕ ВЫЖИЛ'),
        h('p', { class: 'hz-text' }, ok ? `«${m.name}» пройдена на уровне ${this.diff.name}.` : reason),
        h('div', { class: 'hz-endstats' },
          h('div', {}, h('b', {}, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`), 'время'),
          h('div', {}, h('b', {}, s.wrong), 'ошибок'),
          h('div', {}, h('b', {}, s.damage), 'урона'),
          h('div', {}, h('b', {}, s.hides), 'укрытий'),
          ok ? h('div', {}, h('b', {}, `+${rew.coins}`), 'монет') : null),
        h('div', { class: 'hz-row' },
          h('button', { class: 'btn red', onclick: () => { g.ui.closeModal('hzend'); this.launch(m.id, this.diff.id); } }, ok ? 'Ещё раз' : 'Повторить'),
          h('button', { class: 'btn white', onclick: () => { g.ui.closeModal('hzend'); g.toMainMenu(); openHorrorMenu(g); } }, 'Другая миссия'),
          h('button', { class: 'btn white', onclick: () => { g.ui.closeModal('hzend'); g.toMainMenu(); } }, 'Главное меню'))));
    el._close = () => {}; // экран итогов нельзя закрыть Esc — только кнопками
    g.ui.openModal('hzend', el);
  }

  end() {
    if (!this.active) return;
    const g = this.game;
    this.active = false;
    this.ready = false;
    this.closePuzzle();
    if (this.fx) this.fx.dispose();
    if (this.hudEl) this.hudEl.remove();
    if (this.mobEl) this.mobEl.remove();
    if (this.audio) this.audio.stop();
    const P = g.player;
    P.speedMul = 1;
    P.canRun = true;
    P.frozen = false;
    P.object.visible = true;
    P.model.crouch = false;
    g.cam.override = null;
    g.hud.el.classList.remove('horror', 'nomap');
    document.body.classList.remove('horror-on');
    g.canvas.style.filter = '';
  }

  restart() { this.launch(this.mission.id, this.diff.id); }
}

export { MISSIONS, DIFFICULTIES };
