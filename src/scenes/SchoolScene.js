import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { windowPane, plant, desk, signText, GEO } from './props.js';
import { coin, knowledgeStar, ball, npc, npcLook } from './entities.js';
import { mat, textPlane } from '../core/gfx.js';
import { CONFIG } from '../config.js';
import { STAGE, SUBJECTS } from '../lessons/curriculum.js';
import { h } from '../ui/dom.js';

// Школа: каждый этаж — отдельная локация. Этаж N = N класс.
// Кабинеты строятся по учебному плану (curriculum.js): у каждого предмета свой кабинет,
// а у лабораторных предметов — своё оборудование. Спортзал и столовая — на 1 этаже.
const W = 9; // ширина кабинета
const H = 3.6; // высота стен
const KIND_NAMES = { chem: 'Лаборатория химии', bio: 'Лаборатория биологии', phys: 'Лаборатория физики', it: 'Компьютерный класс', art: 'Мастерская художника', music: 'Музыкальный класс', tech: 'Мастерская', obzr: 'Кабинет ОБЗР', geo: 'Кабинет географии' };

export class SchoolScene extends BaseScene {
  constructor(game) {
    super(game, 'school');
    this.floor = Math.max(1, Math.min(11, game.save.progress.schoolFloor || 1));
    this.title = `🏫 ${this.floor} этаж · ${this.floor} класс`;
    this.cameraDist = 4.8;
    this.mapZoom = 3.2;
    this.mapBg = '#3d3b5c';
    this.indoor = true;
    this.nav = { default: this.floor === 1 ? 'exitDoor' : 'lift' };
    this.lazy = []; // объекты, которые показываются только рядом с игроком
  }

  build() {
    const g = this.game;
    const F = this.floor;
    this.setupLights({ sky: '#bfe8ff', sun: true, hemi: 1.05, ambient: 0.3, shadowSize: 22, sunPos: [15, 30, -12] });
    const lessons = g.lessons.forGrade(F).filter((L) => L.subjectId !== 'pe');
    const rooms = lessons.map((L) => ({ L }));
    if (F === 1) rooms.push({ special: 'canteen' });
    if (rooms.length % 2) rooms.push({ special: 'lounge' });
    const perSide = Math.max(2, rooms.length / 2);
    const X = perSide * W;
    this.X = X;
    const XE = X + (F === 1 ? 24 : 0);
    this.XE = XE;

    // пол
    this.box((XE - 14) / 2, -0.2, 13, XE + 14.4, 0.2, 26.4, '#e8dff5', { walk: true, map: '#efe8fb' });
    this.box(X / 2, 0, 5, X, 0.02, 9.8, '#f3d9b1', { cast: false, map: '#f3e2c3' });
    this.box(X / 2, 0, 21, X, 0.02, 9.8, '#f3d9b1', { cast: false, map: '#f3e2c3' });
    for (let x = 1; x < X; x += 2) this.box(x, 0.02, 13, 1, 0.01, 5.8, '#ddd0f0', { cast: false });

    // наружные стены
    const ext = '#ffd59e', inner = '#fff5e1';
    this.wallX(0, -14, XE, 0, H, ext, F === 1 ? [[-9.5, -5.5]] : [], { gapH: 3 });
    this.wallX(26, -14, XE, 0, H, ext);
    this.wallZ(-14, 0, 26, 0, H, ext);
    this.wallZ(XE, 0, 26, 0, H, ext);

    // кабинеты
    rooms.forEach((r, i) => {
      r.side = i % 2 === 0 ? 'S' : 'N';
      r.col = Math.floor(i / 2);
      r.x0 = r.col * W;
      r.cx = r.x0 + W / 2;
      r.doorX = r.x0 + W - 1.7;
    });
    const gaps = (side) => rooms.filter((r) => r.side === side).map((r) => [r.doorX - 0.9, r.doorX + 0.9]);
    this.wallX(10, 0, X, 0, H, inner, gaps('S'));
    this.wallX(16, 0, X, 0, H, inner, gaps('N'));
    for (let c = 0; c < perSide; c++) {
      this.wallZ(c * W, 0, 10, 0, H, inner);
      this.wallZ(c * W, 16, 26, 0, H, inner);
    }
    if (F === 1) this.wallZ(X, 0, 26, 0, H, inner, [[10, 16]], { gapH: 3 });
    // окна
    rooms.forEach((r) => {
      const z = r.side === 'S' ? 0 : 26;
      windowPane(this, r.x0 + 1.3, 1, z, 1.6, 1.5, 'x');
      windowPane(this, r.x0 + W - 1.3, 1, z, 1.6, 1.5, 'x');
    });

    this.buildHall();
    rooms.forEach((r) => {
      if (r.special === 'canteen') this.buildCanteen(r);
      else if (r.special === 'lounge') this.buildLounge(r);
      else this.buildRoom(r);
    });
    if (F === 1) this.buildGym(X);

    // монетки в коридоре
    for (let x = 4, k = 0; x < X; x += 12, k++) coin(this, `f${F}c${k}`, x, 0, 13);
    // видимость тяжёлых объектов только рядом с игроком
    this.onUpdate(() => {
      const p = g.player.pos;
      for (const o of this.lazy) o.obj.visible = Math.abs(o.x - p.x) < 15;
    });

    this.game.raid.populate(this);
    this.spawn('entrance', -7.5, 0, 2, 0);
    this.spawn('lift', -5.5, 0, 23.4, Math.PI);
    this.spawn('stairsUp', -10.5, 0, 15.2, Math.PI / 2);
    this.spawn('stairsDown', -10.5, 0, 15.2, Math.PI / 2);
    this.spawn('start', ...(F === 1 ? [-7.5, 0, 2, 0] : [-5.5, 0, 23.4, Math.PI]));
  }

  // ---------- холл: лестница, лифт, расписание ----------
  buildHall() {
    const g = this.game;
    const F = this.floor;
    // лестница вверх (северо‑запад)
    if (F < 11) {
      for (let i = 0; i < 9; i++) this.box(-12.7, 0, 17.2 + i * 0.9, 2.2, 0.35 * (i + 1), 0.9, '#c8a2ff');
      this.world.addBox(-13.8, -11.6, 0, 3.5, 17, 25.8);
      signText(this, `⬆ ${F + 1} этаж`, -12.7, 2.6, 16.6, 2, 0.5, Math.PI, { bg: '#2ed573', fg: '#ffffff', res: 0.5 });
      this.interact({ pos: [-12.7, 1, 16.2], radius: 1.8, prompt: `⬆ Подняться по лестнице на ${F + 1} этаж`, action: () => this.changeFloor(F + 1, 'stairsUp') });
    }
    // лестница вниз — проём в полу
    if (F > 1) {
      this.box(-10, 0, 21, 2.2, 0.02, 8.4, '#1e1b33', { cast: false });
      for (let i = 0; i < 6; i++) this.box(-10, 0.02, 17.4 + i * 1.3, 2.1, 0.01, 0.5, ['#6b6590', '#59547d', '#48436a', '#37335a', '#29264a', '#1f1c3d'][i], { cast: false });
      this.box(-8.85, 0, 21, 0.1, 1, 8.4, '#8e6cef', { collide: true });
      this.world.addBox(-11.1, -8.9, 0, 3, 17.6, 25.8);
      signText(this, `⬇ ${F - 1} этаж`, -10, 2.6, 16.6, 2, 0.5, Math.PI, { bg: '#ff9f43', fg: '#ffffff', res: 0.5 });
      this.interact({ pos: [-10, 1, 16.2], radius: 1.6, prompt: `⬇ Спуститься по лестнице на ${F - 1} этаж`, action: () => this.changeFloor(F - 1, 'stairsDown') });
    }
    this.label([-11.3, 3.2, 17], '🪜 Лестница', { maxDist: 14 });
    // лифт
    this.box(-5.5, 0, 25.85, 3, 2.6, 0.12, '#95a5a6');
    this.box(-6.2, 0, 25.75, 1.3, 2.4, 0.1, '#c8d0d8');
    this.box(-4.8, 0, 25.75, 1.3, 2.4, 0.1, '#c8d0d8');
    this.box(-3.6, 1, 25.8, 0.3, 0.5, 0.1, '#636e72');
    signText(this, String(F), -5.5, 2.9, 25.78, 0.6, 0.4, Math.PI, { bg: '#111111', fg: '#ff4d4d', res: 0.3 });
    this.point('lift', -5.5, 0, 24.4);
    this.label([-5.5, 3.3, 25.4], '🛗 Школьный лифт', { maxDist: 16 });
    this.interact({ pos: [-5.5, 1, 24.4], radius: 1.8, prompt: '🛗 Вызвать лифт и выбрать этаж', action: () => this.openLift() });
    // табличка этажа
    signText(this, [`${F} ЭТАЖ`, `${F} класс · ${STAGE(F)}`], -1.8, 2.3, 25.85, 3, 1.3, Math.PI, { bg: '#6c5ce7', fg: '#ffffff', sub: '#ffeaa7', res: 0.6 });
    // расписание и список кабинетов
    this.box(-2.5, 1, 0.15, 2.6, 1.6, 0.1, '#ffffff');
    signText(this, ['📅 Расписание', 'и кабинеты'], -2.5, 1.8, 0.22, 2.4, 1.3, 0, { bg: '#ffeaa7', fg: '#2d3436', res: 0.5 });
    this.label([-2.5, 3, 0.4], '📅 Расписание и кабинеты', { maxDist: 12 });
    this.interact({ pos: [-2.5, 1, 1.1], radius: 1.8, prompt: 'Посмотреть расписание и кабинеты 📅', action: () => this.showSchedule() });
    plant(this, -13.3, 0, 15.2);
    plant(this, -0.7, 0, 24.8, 0.9);
    this.box(-7, 0, 13, 2, 0.45, 0.5, '#b07d4f', { collide: true });

    if (F === 1) this.buildLobby();
    if (F === 11) knowledgeStar(this, 'star_school2', -13, 0, 1.2);
  }

  buildLobby() {
    const g = this.game;
    // выход
    this.box(-7.5, 0, 0.05, 4, 3, 0.1, '#55efc4', { emissive: '#1a6b55' });
    this.point('exitDoor', -7.5, 0, 0.9);
    this.label([-7.5, 3.3, 0.5], '🚪 Выход на улицу', { maxDist: 12 });
    this.interact({
      pos: [-7.5, 1, 0.9], radius: 1.8, prompt: 'Выйти на улицу 🌳',
      action: () => {
        if (g.quests.currentLesson()) {
          g.ui.dialog.show([{ name: 'Сова Соня', avatar: '🦉', text: 'Уроки ещё не закончились! Посмотри задание сверху — тебе нужно в кабинет.' }]);
          return;
        }
        g.audio.play('door');
        g.goTo('street', 'fromSchool');
      },
    });
    // гардероб
    for (let i = 0; i < 6; i++) {
      this.geo(GEO.cyl, '#636e72', -13.6, 1, 2 + i * 1.2, { sx: 0.05, sy: 2, sz: 0.05 });
      this.geo(GEO.box, ['#e17055', '#0984e3', '#00b894', '#fdcb6e', '#a29bfe', '#fd79a8'][i], -13.55, 1.3, 2 + i * 1.2, { sx: 0.3, sy: 0.8, sz: 0.5 });
    }
    this.box(-12.8, 0, 5, 0.6, 1, 7, '#b07d4f', { collide: true });
    this.point('coatRack', -11.8, 0, 5);
    this.label([-12.8, 2.8, 5], '🧥 Гардероб', { maxDist: 14 });
    npc(this, { x: -13.2, z: 9.3, yaw: Math.PI / 2, name: 'Гардеробщица Нина', avatar: '👵', look: npcLook('#fd79a8', '#2d3436', '#dfe6e9', { shape: 'round' }), lines: ['Давай курточку, повешу на крючок! Номерок не потеряй!'] });
    this.interact({
      pos: [-11.8, 1, 5], radius: 1.8, prompt: () => (g.quests.isDone('wardrobe') ? 'Гардероб (куртка уже сдана ✓)' : 'Сдать куртку в гардероб 🧥'),
      action: () => {
        if (g.quests.isDone('wardrobe')) { g.ui.toast('🧥 Твоя куртка висит на крючке №12'); return; }
        g.quests.complete('wardrobe');
        g.ui.toast('🎫 Ты получил номерок №12');
        setTimeout(() => this.bellNext(true), 900);
      },
    });
    npc(this, {
      x: -3.5, z: 4, yaw: -Math.PI / 2, name: 'Охранник Сергей', avatar: '💂', look: npcLook('#2d3436', '#2d3436', '#2d3436', { shape: 'tall' }),
      lines: () => {
        const c = g.quests.currentLesson();
        if (c) { const L = g.lessons.byId[c.lesson]; return [`Тебе на урок «${L.subject}» — ${L.roomName}${L.floor > 1 ? `, это ${L.floor} этаж. Лифт и лестница — в конце холла` : ''}.`]; }
        return ['В нашей школе 11 этажей: на каждом этаже учится свой класс. А спортзал и столовая — здесь, на первом!'];
      },
    });
    // кубки
    this.box(-1, 0, 6, 0.8, 2, 2.4, '#dfe6e9', { collide: true });
    [5.2, 6, 6.8].forEach((z, i) => this.geo(GEO.cone, '#f9ca24', -1, 1.2 + (i % 2) * 0.4, z, { sx: 0.18, sy: 0.4, sz: 0.18, emissive: '#6b5200' }));
  }

  changeFloor(n, spawn) {
    const g = this.game;
    g.save.progress.schoolFloor = n;
    g.audio.play(spawn === 'lift' ? 'ding' : 'step');
    g.goTo('school', spawn, `🏫 ${n} этаж · ${n} класс`);
  }

  openLift() {
    const g = this.game;
    const F = this.floor;
    const btns = h('div', { class: 'btns lift-btns' });
    for (let n = 11; n >= 1; n--) {
      const cur = g.quests.currentLesson();
      const need = cur && g.lessons.byId[cur.lesson].floor === n;
      btns.append(h('button', { class: `elev-btn ${n === F ? 'lit' : ''} ${need ? 'need' : ''}`, title: `${n} класс`, onclick: () => {
        g.audio.play('click');
        g.ui.closeModal('lift');
        if (n !== F) this.changeFloor(n, 'lift');
      } }, n));
    }
    const el = h('div', { class: 'overlay', onclick: (e) => e.target === el && g.ui.closeModal('lift') },
      h('div', { class: 'elev-panel pop', style: { width: '300px' } },
        h('div', { class: 'disp' }, String(F)), btns,
        h('div', { style: { marginTop: '12px', fontWeight: 800, color: '#2d3436' } }, 'Этаж = класс. Жёлтая обводка — твой урок')));
    el._close = () => g.ui.closeModal('lift');
    g.ui.openModal('lift', el);
  }

  showSchedule() {
    const g = this.game;
    const ids = g.quests.dayLessons();
    const sched = ids.map((id, i) => {
      const L = g.lessons.byId[id];
      return `${g.quests.isDone(`lesson_${id}`) ? '✅' : '⬜'} ${i + 1}. ${L.icon} ${L.subject} (${L.grade} кл.) — ${L.roomName}${L.floor !== this.floor ? `, ${L.floor} этаж` : ''}`;
    });
    const rooms = g.lessons.forGrade(this.floor).map((L) => `${L.icon} ${L.subject} — ${L.room === 'gym' ? 'спортзал, 1 этаж' : L.room}`);
    g.ui.dialog.show([
      { name: `Расписание · день ${g.save.progress.day} · ${g.save.data.grade} класс`, avatar: '📅', text: sched.join('   ') },
      { name: `Кабинеты ${this.floor} этажа (${this.floor} класс)`, avatar: '📋', text: rooms.join(' · ') },
    ]);
  }

  // ---------- кабинет ----------
  buildRoom(r) {
    const g = this.game;
    const L = r.L;
    const south = r.side === 'S';
    const dir = south ? -1 : 1; // куда смотрят ученики
    const zB = south ? 0.2 : 25.8; // доска
    const Z = (d) => (south ? d : 26 - d); // расстояние от доски → координата
    const rot = south ? 0 : Math.PI;
    const kind = L.kind;
    const cx = r.cx;
    // табличка у двери и метка
    signText(this, [L.room, L.subject], r.doorX - 2.1, 1.8, south ? 10.12 : 15.88, 1.7, 0.9, rot, { bg: L.color, fg: '#ffffff', sub: '#ffffff', res: 0.4 });
    this.label([r.doorX, 2.9, south ? 10 : 16], `${L.icon} ${L.room} · ${L.subject}`, { maxDist: 13, cls: 'room' });
    // доска
    this.box(cx, 0.9, zB - dir * 0.05, 4.4, 1.8, 0.1, '#6d4c41');
    const board = textPlane([L.title, `${L.icon} ${L.subject} · ${L.grade} класс`], 4.2, 1.5, { bg: '#2d6a4f', fg: '#ffffff', sub: '#ffeaa7', res: 0.45 });
    board.position.set(cx, 1.8, zB - dir * 0.12);
    board.rotation.y = rot;
    this.addObj(board);
    // учитель и его стол
    this.box(cx - 3, 0, Z(1.6), 1.6, 0.8, 0.8, '#b07d4f', { collide: true });
    const teacher = npc(this, {
      x: cx + 1.8, z: Z(1.4), yaw: rot, name: L.teacher, avatar: L.teacherAvatar,
      look: npcLook(L.color, '#2d3436', '#5d4037', { shape: 'tall', acc: { glasses: { model: 'round', color: '#2d3436' } } }),
      lines: () => this.teacherLines(L),
    });
    this.lazy.push({ obj: teacher.root, x: cx });
    // первый ряд — парты (центральная — твоя)
    let seat = null;
    [-2.6, 0, 2.6].forEach((dx) => {
      const d = desk(this, cx + dx, 0, Z(3.6), dir, dx === 0 ? '#ffd32a' : kind === 'class' || kind === 'geo' || kind === 'obzr' ? '#e8c18f' : '#dfe6e9');
      if (dx === 0) seat = d.seat;
    });
    // оборудование кабинета
    const practical = (L.practice || []).find((t) => ['chem', 'microscope', 'circuit', 'robot', 'paint', 'melody', 'map', 'angle'].includes(t.type));
    this.equip(kind, cx, Z, dir, rot, L, practical);
    // место ученика
    this.point(`desk_${L.room}`, cx, 0, Z(3.6) - dir * 1.5);
    this.interact({
      pos: [cx, 1, Z(3.6) - dir * 1.1], radius: 1.4,
      prompt: () => {
        const cur = g.quests.currentLesson();
        if (cur && cur.lesson === L.id) return `Сесть за парту — начать урок «${L.subject}» 📖`;
        return `Сесть за парту (свободная практика: ${L.subject}, ${L.grade} кл.) ✏️`;
      },
      action: () => this.startLesson(L, seat, dir, r, teacher),
    });
    this.label([cx, 1.9, Z(3.6)], '⭐ Твоё место', { maxDist: 7, visible: () => g.quests.currentLesson()?.lesson === L.id });
  }

  // Оборудование для каждого типа кабинета. Практические приборы можно попробовать и вне урока.
  equip(kind, cx, Z, dir, rot, L, practical) {
    const g = this.game;
    const station = (x, z, label, prompt) => {
      if (!practical) return;
      this.label([x, 1.8, z], label, { maxDist: 8 });
      this.interact({ pos: [x, 1, z - dir * 0.6], radius: 1.4, prompt, action: () => g.lesson.start(L, { only: practical, onFinish: () => {} }) });
    };
    const rows = [5.4, 7.2];
    if (kind === 'class' || kind === 'geo' || kind === 'obzr') {
      rows.forEach((d) => [-2.6, 0, 2.6].forEach((dx) => desk(this, cx + dx, 0, Z(d), dir)));
      if (kind === 'geo') {
        this.box(cx + 3.6, 0, Z(1.6), 0.6, 0.9, 0.6, '#8d5524', { collide: true });
        const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 2), mat('#3fa7ff'));
        const land = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), mat('#2ecc71', { transparent: true, opacity: 0.85 }));
        land.scale.set(1, 0.7, 0.8);
        globe.add(land);
        globe.position.set(cx + 3.6, 1.4, Z(1.6));
        globe.castShadow = true;
        this.addObj(globe);
        this.onUpdate((dt) => (globe.rotation.y += dt * 0.6));
        signText(this, ['🗺️ Карта мира', 'материки и океаны'], cx - 3.6, 2.1, Z(0.25), 1.6, 1.1, rot, { bg: '#74b9ff', fg: '#ffffff', res: 0.4 });
        station(cx + 3.6, Z(2.4), '🌍 Глобус и карта', 'Поработать с картой (практика) 🗺️');
      }
      if (kind === 'obzr') {
        [1.2, 2.2].forEach((d) => this.geo(GEO.cyl, '#d63031', cx + 4.1, 0.4, Z(d), { sx: 0.15, sy: 0.8, sz: 0.15 }));
        this.box(cx - 3.2, 0, Z(8.8), 1.8, 0.25, 0.6, '#636e72');
        this.box(cx - 3.2, 0.25, Z(8.8), 1.5, 0.25, 0.4, '#ffd3b0');
        signText(this, ['☎️ 112', 'единый номер'], cx - 3.6, 2.1, Z(0.25), 1.6, 1.1, rot, { bg: '#d63031', fg: '#ffffff', res: 0.4 });
        station(cx + 4.1, Z(2.8), '🧯 Учебный тренажёр', 'Тренировка: эвакуация (практика) 🚨');
      }
      return;
    }
    // лабораторные столы
    rows.forEach((d) => {
      this.box(cx, 0, Z(d), 7.4, 0.8, 0.9, kind === 'tech' ? '#a0522d' : kind === 'art' ? '#f5f6fa' : '#dfe6e9', { collide: true });
      [-2.6, 0, 2.6].forEach((dx) => this.box(cx + dx, 0, Z(d) - dir * 0.75, 0.4, 0.5, 0.4, '#3498db'));
    });
    if (kind === 'chem') {
      const cols = ['#ff6b6b', '#54a0ff', '#1dd1a1', '#feca57', '#ff9ff3'];
      rows.forEach((d, ri) => { for (let i = 0; i < 6; i++) this.geo(GEO.cyl, cols[(i + ri) % 5], cx - 3 + i * 1.2, 0.95, Z(d), { sx: 0.08, sy: 0.3, sz: 0.08, emissive: cols[(i + ri) % 5] }); });
      this.box(cx + 3.6, 0, Z(1.2), 1.2, 2.4, 1, '#b2bec3', { collide: true }); // вытяжной шкаф
      this.box(cx + 3.6, 1, Z(1.2) - dir * 0.52, 1, 1, 0.04, '#c7ecff', { emissive: '#4a6a7a' });
      signText(this, ['H He Li Be B C N O', 'Таблица Менделеева'], cx - 3.5, 2.1, Z(0.25), 1.8, 1.1, rot, { bg: '#ffffff', fg: '#eb3b5a', res: 0.4 });
      station(cx, Z(5.4), '⚗️ Лабораторный стол', 'Провести опыт (практика) ⚗️');
    } else if (kind === 'bio') {
      rows.forEach((d) => [-2.6, 0, 2.6].forEach((dx) => {
        this.geo(GEO.cyl, '#2d3436', cx + dx, 0.85, Z(d), { sx: 0.18, sy: 0.1, sz: 0.18 });
        this.geo(GEO.cyl, '#636e72', cx + dx, 1.1, Z(d), { sx: 0.05, sy: 0.45, sz: 0.05, rx: 0.3 });
      }));
      this.box(cx + 3.6, 0.8, Z(1.2), 1.4, 0.8, 0.6, '#74b9ff', { emissive: '#1d5e9a' }); // аквариум
      this.box(cx + 3.6, 0, Z(1.2), 1.4, 0.8, 0.6, '#8d5524', { collide: true });
      plant(this, cx - 4, 0, Z(8.9));
      plant(this, cx + 4, 0, Z(8.9), 0.8);
      station(cx, Z(5.4), '🔬 Микроскопы', 'Посмотреть в микроскоп (практика) 🔬');
    } else if (kind === 'phys') {
      rows.forEach((d) => [-2.6, 0, 2.6].forEach((dx) => {
        this.box(cx + dx - 0.25, 0.8, Z(d), 0.3, 0.2, 0.15, '#2d3436');
        this.geo(GEO.sphere, '#fff7d6', cx + dx + 0.3, 0.95, Z(d), { sx: 0.1, sy: 0.12, sz: 0.1, emissive: '#998844' });
      }));
      this.box(cx + 3.7, 0, Z(1.4), 0.1, 2, 0.1, '#636e72');
      this.box(cx + 3.7, 2, Z(1.4), 0.8, 0.08, 0.1, '#636e72');
      const pend = new THREE.Group();
      pend.position.set(cx + 4, 2, Z(1.4));
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.02), mat('#2d3436'));
      str.position.y = -0.6;
      const bob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), mat('#f9ca24'));
      bob.position.y = -1.2;
      pend.add(str, bob);
      this.addObj(pend);
      let t = 0;
      this.onUpdate((dt) => { t += dt; pend.rotation.z = Math.sin(t * 2.86) * 0.4; });
      signText(this, ['F = m · a', 'I = U / R'], cx - 3.5, 2.1, Z(0.25), 1.6, 1.1, rot, { bg: '#4b7bec', fg: '#ffffff', res: 0.4 });
      station(cx, Z(5.4), '⚡ Стенд «Электричество»', 'Собрать электрическую цепь (практика) ⚡');
    } else if (kind === 'it') {
      rows.forEach((d) => [-2.6, 0, 2.6].forEach((dx) => {
        this.box(cx + dx, 0.8, Z(d) + dir * 0.15, 0.9, 0.6, 0.06, '#2d3436');
        this.box(cx + dx, 0.85, Z(d) + dir * 0.12, 0.8, 0.48, 0.02, '#74b9ff', { emissive: '#2a6fb0', cast: false });
        this.box(cx + dx, 0.8, Z(d) - dir * 0.2, 0.7, 0.03, 0.25, '#636e72');
      }));
      station(cx, Z(5.4), '💻 Компьютер', 'Запрограммировать робота (практика) 🤖');
    } else if (kind === 'art') {
      for (let i = 0; i < 3; i++) {
        const x = cx - 3 + i * 3;
        this.geo(GEO.box, '#8d5524', x, 0.9, Z(8.8), { sx: 0.06, sy: 1.8, sz: 0.06, rx: 0.15 * dir });
        this.box(x, 1, Z(8.7), 1, 0.8, 0.05, ['#ffeaa7', '#fab1a0', '#81ecec'][i]);
      }
      ['#ff3b30', '#ffcc00', '#007aff', '#34c759'].forEach((c, i) => this.geo(GEO.cyl, c, cx - 1.5 + i, 0.92, Z(5.4), { sx: 0.12, sy: 0.25, sz: 0.12 }));
      station(cx, Z(5.4), '🎨 Мольберт и краски', 'Порисовать (практика) 🎨');
    } else if (kind === 'music') {
      this.box(cx - 3.2, 0, Z(1.8), 1.8, 1, 0.7, '#111111', { collide: true });
      this.box(cx - 3.2, 0.75, Z(1.8) - dir * 0.36, 1.6, 0.06, 0.2, '#ffffff');
      this.geo(GEO.cyl12, '#e17055', cx + 3.5, 0.35, Z(2), { sx: 0.4, sy: 0.7, sz: 0.4 });
      signText(this, ['♪ ♫ до ре ми', 'фа соль ля си'], cx + 3.5, 2.1, Z(0.25), 1.6, 1.1, rot, { bg: '#e84393', fg: '#ffffff', res: 0.4 });
      this.label([cx - 3.2, 1.6, Z(1.8)], '🎹 Пианино', { maxDist: 8 });
      this.interact({ pos: [cx - 3.2, 1, Z(2.6)], radius: 1.3, prompt: 'Сыграть мелодию на пианино 🎹', action: () => g.lesson.start(L, { only: practical || { type: 'melody', q: 'Повтори мелодию', length: 4 }, onFinish: () => {} }) });
    } else if (kind === 'tech') {
      this.box(cx + 3.4, 0, Z(1.4), 1.8, 1.8, 0.2, '#b07d4f');
      this.box(cx - 2.6, 0.8, Z(5.4), 0.6, 0.5, 0.5, '#e17055');
      this.geo(GEO.cone, '#6d4c41', cx - 2.6, 1.45, Z(5.4), { sx: 0.5, sy: 0.3, sz: 0.5, ry: Math.PI / 4 });
      signText(this, ['🔨 Техника', 'безопасности'], cx - 3.5, 2.1, Z(0.25), 1.6, 1.1, rot, { bg: '#a0522d', fg: '#ffffff', res: 0.4 });
    }
  }

  teacherLines(L) {
    const g = this.game;
    const cur = g.quests.currentLesson();
    const res = g.save.data.lessons[L.id];
    const room = KIND_NAMES[L.kind] ? ` Это ${KIND_NAMES[L.kind].toLowerCase()} — здесь мы проводим настоящую практику!` : '';
    if (cur && cur.lesson === L.id) return [`Здравствуй! Сегодня тема «${L.title}». Садись за жёлтую парту в первом ряду!${room}`];
    if (res) return [`Ты уже получил «${res.best}» по предмету «${L.subject}» (${L.grade} класс). Хочешь улучшить результат? Садись за парту!`];
    return [`Это кабинет «${SUBJECTS[L.subjectId].full || L.subject}» для ${L.grade} класса.${room} Можешь потренироваться в любое время!`];
  }

  buildCanteen(r) {
    const g = this.game;
    const flags = g.save.progress.flags;
    const south = r.side === 'S';
    const Z = (d) => (south ? d : 26 - d);
    signText(this, ['🍽️', 'Столовая'], r.doorX - 2.1, 1.8, south ? 10.12 : 15.88, 1.7, 0.9, south ? 0 : Math.PI, { bg: '#e17055', fg: '#ffffff', res: 0.4 });
    this.label([r.doorX, 2.9, south ? 10 : 16], '🍽️ Столовая', { maxDist: 13, cls: 'room' });
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) this.box(r.cx - 2.2 + i * 4.4, 0, Z(4 + j * 3), 2.6, 0.75, 1.2, '#fab1a0', { collide: true });
    this.box(r.cx, 0, Z(1), 7, 1.1, 1, '#dfe6e9', { collide: true });
    ['#e17055', '#fdcb6e', '#00b894'].forEach((c, i) => this.geo(GEO.sphere, c, r.cx - 2 + i * 2, 1.3, Z(1), { sx: 0.25, sy: 0.2, sz: 0.25 }));
    const cook = npc(this, { x: r.cx + 2.5, z: Z(0.5), yaw: south ? 0 : Math.PI, name: 'Повар тётя Маша', avatar: '👩‍🍳', look: npcLook('#ffffff', '#dfe6e9', '#6d4c41', { shape: 'round' }),
      lines: () => (flags.lunch ? ['Приходи завтра, будут пирожки с яблоком!'] : ['Проголодался? Подойди к прилавку и возьми булочку с компотом!']) });
    this.lazy.push({ obj: cook.root, x: r.cx });
    this.interact({
      pos: [r.cx, 1, Z(2)], radius: 2, prompt: 'Взять булочку и компот 🥐', enabled: () => !flags.lunch,
      action: () => { flags.lunch = true; g.audio.play('pop'); g.save.addXp(10); g.ui.toast('🥐 Ням! Силы восстановлены! +10 XP'); },
    });
  }

  buildLounge(r) {
    const south = r.side === 'S';
    const Z = (d) => (south ? d : 26 - d);
    this.label([r.doorX, 2.9, south ? 10 : 16], '🛋️ Рекреация', { maxDist: 12, cls: 'room' });
    this.box(r.cx, 0, Z(2), 3, 0.5, 1, '#6c5ce7', { collide: true });
    this.box(r.cx, 0.5, Z(1.6), 3, 0.6, 0.25, '#5f4dd6');
    plant(this, r.cx - 3.5, 0, Z(1));
    plant(this, r.cx + 3.5, 0, Z(1));
    this.box(r.cx, 0, Z(6), 2, 0.4, 1, '#ffeaa7', { collide: true });
  }

  // ---------- спортзал (1 этаж) ----------
  buildGym(X) {
    const g = this.game;
    const gx = X + 12;
    this.gymX = gx;
    this.box(gx, 0, 13, 23.6, 0.02, 25.6, '#f6b26b', { cast: false, map: '#f6c58f' });
    this.box(gx, 0.02, 13, 0.1, 0.01, 25, '#ffffff', { cast: false });
    this.geo(new THREE.TorusGeometry(3, 0.06, 4, 32), '#ffffff', gx, 0.03, 13, { rx: Math.PI / 2, cast: false });
    [X + 0.6, X + 23.4].forEach((x, i) => {
      this.box(x, 0, 13, 0.15, 3, 0.15, '#636e72', { collide: true });
      this.box(x + (i ? -0.15 : 0.15), 2.6, 13, 0.1, 1, 1.4, '#ffffff');
      this.geo(new THREE.TorusGeometry(0.3, 0.04, 6, 14), '#e17055', x + (i ? -0.55 : 0.55), 2.7, 13, { rx: Math.PI / 2 });
    });
    for (let i = 0; i < 8; i++) this.box(X + 4 + i * 2, 0, 25.6, 0.1, 3, 0.3, '#b07d4f'); // шведская стенка
    for (let i = 0; i < 5; i++) this.box(X + 4 + i * 4, 1 + (i % 2) * 0.01, 25.55, 3.9, 0.06, 0.2, '#b07d4f');
    this.box(X + 6, 0, 2, 3, 0.15, 2, '#0984e3'); // маты
    this.box(X + 18, 0, 2, 3, 0.15, 2, '#0984e3');
    signText(this, ['⚽ СПОРТЗАЛ', 'Быстрее · Выше · Сильнее'], gx, 2.7, 0.12, 5, 1.2, 0, { bg: '#10ac84', fg: '#ffffff', sub: '#ffeaa7', res: 0.5 });
    this.label([X + 0.4, 3.2, 13], '⚽ Спортзал', { maxDist: 18, cls: 'room' });
    ball(this, gx + 3, 0, 9);
    knowledgeStar(this, 'star_school1', X + 22.5, 0, 24.5);
    const coach = npc(this, { x: gx, z: 18, yaw: Math.PI, name: 'Тренер Алексей', avatar: '🏋️', look: npcLook('#10ac84', '#2d3436', '#2d3436', { shape: 'tall', extra: 'stripes' }),
      lines: () => [`Физкультура для всех классов проходит здесь! Встань в центр зала и начинай урок. ${g.save.data.grade} класс, на разминку!`] });
    this.lazy.push({ obj: coach.root, x: gx });
    this.point('desk_gym', gx, 0, 13);
    this.label([gx, 1.4, 13], '⭐ Центр зала — начать урок', { maxDist: 14, visible: () => g.lessons.byId[g.quests.currentLesson()?.lesson]?.subjectId === 'pe' });
    this.interact({
      pos: [gx, 1, 13], radius: 2,
      prompt: () => {
        const L = this.peLesson();
        return L ? `Начать урок физкультуры (${L.grade} класс) ⚽` : 'Урок физкультуры';
      },
      action: () => { const L = this.peLesson(); if (L) this.startLesson(L, null, 1, { cx: gx }, coach); },
    });
    this.interact({
      pos: [X + 2.2, 1, 13], radius: 1.8, prompt: 'Бросить мяч в кольцо 🏀',
      action: () => {
        if (Math.random() < 0.45) { g.audio.play('correct'); g.save.addCoins(2, 'hoop'); g.ui.toast('🏀 Попал! +2 🪙'); }
        else { g.audio.play('kick'); g.ui.toast('🏀 Мимо! Попробуй ещё раз.'); }
      },
    });
  }

  peLesson() {
    const g = this.game;
    const cur = g.quests.currentLesson();
    if (cur && g.lessons.byId[cur.lesson].subjectId === 'pe') return g.lessons.byId[cur.lesson];
    return g.lessons.get('pe', g.save.data.grade) || g.lessons.get('pe', 1);
  }

  // 3D‑практика на физкультуре: пробежать через кольца (некоторые — с прыжком)
  sportActivity(task) {
    const g = this.game;
    return new Promise((resolve) => {
      const X = this.X;
      const pts = [[X + 4, 4], [X + 20, 4], [X + 21, 22], [X + 12, 13], [X + 3, 22], [X + 12, 5], [X + 20, 13], [X + 4, 13]];
      const n = Math.min(pts.length, task.rings || 6);
      const jumps = new Set();
      for (let i = 0; i < (task.jumps || 0); i++) jumps.add(1 + i * 2);
      const rings = pts.slice(0, n).map(([x, z], i) => {
        const jump = jumps.has(i);
        const m = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 24), mat(jump ? '#ff9f43' : '#2ed573', { emissive: jump ? '#a05000' : '#0a7a3a' }));
        m.position.set(x, jump ? 1.3 : 1.2, z);
        this.scene.add(m);
        return { m, x, z, jump };
      });
      const hud = h('div', { class: 'sport-hud' });
      g.ui.root.append(hud);
      let k = 0, t = 0, started = false;
      g.ui.bigMessage(`🏃 На старт!<small>${task.jumps ? 'Оранжевые кольца — с прыжком (Пробел)!' : 'Беги через зелёные кольца!'}</small>`, 1800);
      setTimeout(() => { started = true; g.audio.play('ding'); }, 1600);
      const upd = (dt) => {
        if (!started || k >= rings.length) return;
        t += dt;
        const r = rings[k];
        r.m.rotation.y += dt * 2;
        rings.forEach((o, i) => (o.m.scale.setScalar(i === k ? 1 + Math.sin(t * 8) * 0.08 : 0.6)));
        hud.innerHTML = `⏱ ${t.toFixed(1)} с · кольцо ${k + 1}/${rings.length}${r.jump ? ' · 🦘 ПРЫЖОК!' : ''}`;
        const p = g.player.pos;
        if (Math.hypot(p.x - r.x, p.z - r.z) < 1.3 && (!r.jump || p.y > 0.45)) {
          g.audio.play('coin');
          g.fx.burst(r.m.position.clone(), r.jump ? '#ff9f43' : '#2ed573', 14);
          r.m.removeFromParent();
          k++;
          if (k >= rings.length) {
            const limit = task.limit || 30;
            const frac = t <= limit ? 1 : t <= limit * 1.5 ? 0.7 : 0.4;
            hud.remove();
            g.ui.bigMessage(`🏁 Финиш!<small>${t.toFixed(1)} с ${t <= limit ? '— норматив сдан! 🥇' : '— попробуй быстрее!'}</small>`, 2200);
            g.audio.play(t <= limit ? 'levelup' : 'pop');
            this.updaters.splice(this.updaters.indexOf(upd), 1);
            setTimeout(() => resolve({ frac, answer: `${t.toFixed(1)} с (норматив ${limit} с)` }), 1200);
          }
        }
      };
      this.onUpdate(upd);
    });
  }

  // звонок на следующий урок
  bellNext(first = false) {
    const g = this.game;
    const c = g.quests.currentLesson();
    if (!c) return;
    const L = g.lessons.byId[c.lesson];
    const start = CONFIG.lesson.firstLessonStart + (c.no - 1) * (CONFIG.lesson.gameMinutes + CONFIG.lesson.breakMinutes);
    g.setClockAtLeast(start - (first ? 5 : 2));
    g.ringBell(`Урок ${c.no}: ${L.icon} ${L.subject} — ${L.roomName}${L.floor !== this.floor ? `, ${L.floor} этаж` : ''}`);
    g.ui.tip(L.floor !== this.floor
      ? `Урок «${L.subject}» — на <b>${L.floor} этаже</b>. Поднимись на <b>лифте</b> или по <b>лестнице</b> в конце холла!`
      : `Иди в <b>${L.roomName}</b>. Следуй за стрелкой цели и смотри на таблички у дверей!`);
  }

  // ---------- урок ----------
  startLesson(L, seat, dir, room, teacher) {
    const g = this.game;
    if (g.raid.active()) {
      g.ui.dialog.show([{ name: 'Майор Орлов (рация)', avatar: '👮', text: 'Сейчас не до уроков! Сначала помоги полиции — задание сверху.' }]);
      return;
    }
    const cur = g.quests.currentLesson();
    const scheduled = !!(cur && cur.lesson === L.id);
    const p = g.player;
    if (seat) {
      p.place(seat.x, seat.y, seat.z, dir > 0 ? 0 : Math.PI);
      p.frozen = true;
      p.model.pose = 'sit';
      g.cam.override = {
        pos: new THREE.Vector3(seat.x + 1.2, 2.4, seat.z - dir * 2.6),
        look: new THREE.Vector3(room.cx, 1.6, dir < 0 ? 0.2 : 25.8),
      };
    } else {
      p.frozen = true;
    }
    if (scheduled) {
      const start = CONFIG.lesson.firstLessonStart + (cur.no - 1) * (CONFIG.lesson.gameMinutes + CONFIG.lesson.breakMinutes);
      g.setClockAtLeast(start);
    }
    teacher.wave = 2;
    g.ui.dialog.show([{ name: L.teacher, avatar: L.teacherAvatar, text: L.intro || `Здравствуйте, ${L.grade} класс! Тема урока: «${L.title}». Сначала читаем, потом практикуемся!` }], () => {
      g.lesson.start(L, { scheduled, onFinish: (res) => this.finishLesson(L, res, scheduled, !!seat) });
    });
  }

  finishLesson(L, res, scheduled, seated) {
    const g = this.game;
    const p = g.player;
    p.frozen = false;
    p.model.pose = 'stand';
    if (seated) p.pos.z += p.facing === 0 ? -1.2 : 1.2;
    g.cam.override = null;
    g.cam.snap(p.pos);
    if (scheduled) {
      const stepNo = g.quests.steps.find((s) => s.id === `lesson_${L.id}`)?.no;
      g.quests.complete(`lesson_${L.id}`, true);
      const next = g.quests.currentLesson();
      if (stepNo === 3 && !g.raid.happenedToday()) {
        setTimeout(() => g.raid.start(this.floor), 700);
      } else if (next) {
        setTimeout(() => {
          g.ringBell('Перемена! 🎉');
          setTimeout(() => this.bellNext(), 3500);
        }, 500);
      } else {
        g.ringBell('Уроки окончены! 🎉');
        g.ui.tip('Ура! Все уроки на сегодня пройдены. Спускайся на <b>1 этаж</b> и иди <b>домой</b> — или потренируйся в любом кабинете.');
        g.achievements.unlock('day1');
      }
    }
  }

  enter() {
    const g = this.game;
    if (!g.quests.isDone('wardrobe') && g.quests.isDone('go_school') && this.floor === 1) {
      g.ui.tip('Добро пожаловать в школу! Здесь <b>11 этажей</b>: этаж = класс. Сначала сдай куртку в <b>гардероб</b> (слева в холле).', 'tip_school');
    } else if (g.quests.currentLesson() && g.quests.isDone('wardrobe')) {
      const L = g.lessons.byId[g.quests.currentLesson().lesson];
      if (L.floor === this.floor) g.ui.tip(`Ты на ${this.floor} этаже. Урок «${L.subject}» — <b>${L.roomName}</b>.`);
    }
  }
}
