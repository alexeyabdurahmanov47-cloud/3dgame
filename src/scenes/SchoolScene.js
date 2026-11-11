import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { windowPane, plant, desk, signText, GEO } from './props.js';
import { coin, knowledgeStar, ball, npc, npcLook } from './entities.js';
import { mat, textPlane } from '../core/gfx.js';
import { CONFIG } from '../config.js';

// Школа: 3 этажа, коридор, лестница, кабинеты. Кабинеты с уроками строятся автоматически
// по полю "room" из JSON‑файлов уроков.
const FH = 4; // высота этажа
const XS = [[-20, -6.67], [-6.67, 6.67], [6.67, 20]];
const ROOMS = {
  1: [['S', 0], ['S', 2], ['N', 1], ['N', 2]],
  2: [['S', 0], ['S', 1], ['S', 2], ['N', 1], ['N', 2]],
  3: [['S', 0], ['S', 1], ['S', 2], ['N', 1], ['N', 2]],
};
const SPECIAL = {
  103: { name: 'Столовая', icon: '🍽️', color: '#e17055' },
  104: { name: 'Спортзал', icon: '🏀', color: '#00b894' },
  204: { name: 'Библиотека', icon: '📚', color: '#6c5ce7' },
  205: { name: 'Медкабинет', icon: '🩺', color: '#0984e3' },
  304: { name: 'Актовый зал', icon: '🎭', color: '#e84393' },
  305: { name: 'Учительская', icon: '☕', color: '#636e72' },
};
const LIB_FACTS = [
  'Самая большая книга в мире весит больше 1,5 тонны!',
  'Первые книги писали на глиняных табличках и свитках папируса.',
  'Российская государственная библиотека хранит более 47 миллионов книг и документов.',
  'Слово «библиотека» с греческого — «хранилище книг».',
];

export class SchoolScene extends BaseScene {
  constructor(game) {
    super(game, 'school');
    this.title = '🏫 Школа';
    this.cameraDist = 4.8;
    this.mapZoom = 4.5;
    this.mapFloorH = FH;
    this.mapBg = '#3d3b5c';
    this.indoor = true;
    this.nav = { default: 'exitDoor' };
  }

  build() {
    const g = this.game;
    this.setupLights({ sky: '#bfe8ff', sun: true, hemi: 1.05, ambient: 0.3, shadowSize: 22, sunPos: [15, 30, -12] });
    this.box(0, -0.2, 14, 40.4, 0.2, 28.4, '#e8dff5', { walk: true, map: '#efe8fb' });
    // площадка перед школой
    this.box(0, -0.2, -4, 16, 0.2, 8, '#d1d8e0', { walk: true });

    for (let f = 1; f <= 3; f++) this.buildFloor(f);
    this.buildStairs();
    this.buildLobby();

    this.spawn('start', 0, 0, 2, 0);
    this.spawn('entrance', 0, 0, 2, 0);
    for (let f = 1; f <= 3; f++) {
      const y = (f - 1) * FH;
      this.point(`stairsUp${f}`, -17.4, y, 16.6);
      this.point(`stairsDown${f}`, -10.2, y, 16.6);
    }
  }

  layerFor(f) { this.layer(`f${f}`); }

  buildFloor(f) {
    const y = (f - 1) * FH;
    const H = FH - 0.2;
    this.layerFor(f);
    if (f > 1) {
      const slab = '#d6c8ff';
      this.box(0, y - 0.2, 5, 40, 0.2, 10, slab, { walk: true, collide: true, map: '#f3e2c3' });
      this.box(0, y - 0.2, 13, 40, 0.2, 6, slab, { walk: true, collide: true, map: '#efe8fb' });
      this.box(-13.33, y - 0.2, 16.25, 13.33, 0.2, 0.5, slab, { walk: true, collide: true, map: '#efe8fb' });
      this.box(6.67, y - 0.2, 22, 26.67, 0.2, 12, slab, { walk: true, collide: true, map: '#f3e2c3' });
    }
    // пол кабинетов (дерево) и коридора
    this.box(0, y, 5, 39.6, 0.02, 9.8, '#f3d9b1', { cast: false });
    this.box(6.67, y, 22, 26.4, 0.02, 11.8, '#f3d9b1', { cast: false });
    for (let x = -19; x < 20; x += 2) this.box(x, y + 0.02, 13, 1, 0.01, 5.8, '#ddd0f0', { cast: false });

    const ext = '#ffd59e', inner = '#fff5e1';
    // наружные стены
    this.wallX(0, -20, 20, y, H, ext, f === 1 ? [[-2, 2]] : [], { gapH: 3 });
    this.wallX(28, -20, 20, y, H, ext);
    this.wallZ(-20, 0, 28, y, H, ext);
    this.wallZ(20, 0, 28, y, H, ext);
    // комнаты
    const rooms = ROOMS[f].map(([side, i], k) => ({ side, i, no: f * 100 + k + 1 }));
    const southGaps = [], northGaps = [];
    for (const r of rooms) {
      const [x1, x2] = XS[r.i];
      r.cx = (x1 + x2) / 2;
      r.doorX = r.cx + 4.2;
      (r.side === 'S' ? southGaps : northGaps).push([r.doorX - 1.1, r.doorX + 1.1]);
    }
    if (f === 1) southGaps.push([-6.67, 6.67]); // холл открыт в коридор
    this.wallX(10, -20, 20, y, H, inner, southGaps);
    this.wallX(16, -6.67, 20, y, H, inner, northGaps);
    this.wallZ(-6.67, 0, 10, y, H, inner);
    this.wallZ(6.67, 0, 10, y, H, inner);
    this.wallZ(-6.67, 16, 28, y, H, inner);
    this.wallZ(6.67, 16, 28, y, H, inner);
    // окна наружу
    [-16, -10.5, 10.5, 16].forEach((x) => windowPane(this, x, y + 1, 28, 2.2, 1.6, 'x'));
    [4, 23].forEach((z) => { windowPane(this, -20, y + 1, z, 2.2, 1.6, 'z'); windowPane(this, 20, y + 1, z, 2.2, 1.6, 'z'); });
    // коридор: шкафчики, растения, скамейки
    for (let x = 8; x < 19; x += 0.9) this.box(x, y, 15.6, 0.8, 1.9, 0.5, ['#74b9ff', '#55efc4', '#ffeaa7', '#fab1a0'][Math.floor(x) % 4], { collide: x < 8.5 || x > 18 });
    this.world.addBox(7.6, 19.2, y, y + 1.9, 15.3, 15.9, { camera: false });
    plant(this, 19.3, y, 10.6);
    plant(this, -5.5, y, 15.4, 0.9);
    this.box(-1, y, 10.5, 2, 0.45, 0.5, '#b07d4f', { collide: true });
    signText(this, `${f} этаж`, -6.0, y + 2.9, 15.88, 1.6, 0.5, Math.PI, { bg: '#6c5ce7', fg: '#ffffff' });

    for (const r of rooms) this.buildRoom(r, y, f);
    // бонусы на этаже
    coin(this, `f${f}c1`, -2, y, 13);
    coin(this, `f${f}c2`, 4, y, 13);
    coin(this, `f${f}c3`, 12, y, 13);
    this.layer(null);
  }

  buildRoom(r, y, f) {
    const g = this.game;
    const L = g.lessons.byRoom[String(r.no)];
    const S = SPECIAL[r.no];
    const south = r.side === 'S';
    const zBoard = south ? 0.2 : 27.8;
    const dir = south ? -1 : 1; // направление взгляда учеников
    const corridorZ = south ? 10 : 16;
    const plateZ = south ? 10.12 : 15.88;
    const name = L ? L.subject : S ? S.name : 'Кабинет';
    const icon = L ? L.icon : S ? S.icon : '🚪';
    const color = L ? L.color : S ? S.color : '#636e72';
    // табличка у двери
    signText(this, [`${r.no}`, name], r.doorX - 2.1, y + 1.8, plateZ, 1.6, 0.9, south ? 0 : Math.PI, { bg: color, fg: '#ffffff', sub: '#ffffff' });
    this.label([r.doorX, y + 2.9, corridorZ], `${icon} ${r.no} · ${name}`, { maxDist: 13, cls: 'room' });
    const cz = south ? 5 : 22;

    if (L) {
      // доска
      this.box(r.cx, y + 0.9, zBoard - dir * 0.05, 5, 1.8, 0.1, '#6d4c41');
      const board = textPlane([L.title, `${L.icon} ${L.subject}`], 4.7, 1.5, { bg: '#2d6a4f', fg: '#ffffff', sub: '#ffeaa7' });
      board.position.set(r.cx, y + 1.8, zBoard - dir * 0.12);
      board.rotation.y = south ? 0 : Math.PI;
      this.addObj(board);
      // постеры
      signText(this, L.poster || `${L.icon}`, r.cx + 4.6, y + 2, zBoard - dir * 0.12, 1.4, 1.4, south ? 0 : Math.PI, { bg: '#ffffff', fg: color });
      // парты 3×3
      const rows = [4.2, 6.0, 7.8].map((d) => (south ? d : 28 - d));
      let seat = null;
      rows.forEach((z, ri) => [-3.2, 0, 3.2].forEach((dx, ci) => {
        const mine = ri === 0 && ci === 1;
        const d = desk(this, r.cx + dx, y, z, dir, mine ? '#ffd32a' : '#e8c18f');
        if (mine) seat = d.seat;
      }));
      // стол учителя
      this.box(r.cx - 3.5, y, zBoard - dir * 1.8, 1.8, 0.8, 0.8, '#b07d4f', { collide: true });
      this.box(r.cx - 3.8, y + 0.8, zBoard - dir * 1.8, 0.4, 0.06, 0.3, color);
      const teacher = npc(this, {
        x: r.cx + 1.5, y, z: zBoard - dir * 1.6, yaw: south ? 0 : Math.PI, name: L.teacher || 'Учитель', avatar: L.teacherAvatar || '👩‍🏫',
        look: npcLook(L.teacherColor || color, '#2d3436', '#5d4037', { shape: 'tall', acc: { glasses: { model: 'round', color: '#2d3436' } } }),
        lines: () => this.teacherLines(L),
      });
      this.point(`desk_${r.no}`, r.cx, y, rows[0] - dir * 1.2);
      this.interact({
        pos: [r.cx, y + 1, rows[0] - dir * 1.0], radius: 1.4,
        prompt: () => {
          const cur = g.quests.currentLesson();
          if (cur && cur.lesson === L.id) return `Сесть за парту — начать урок «${L.subject}» 📖`;
          return `Сесть за парту (свободная практика: ${L.subject}) ✏️`;
        },
        action: () => this.startLesson(L, seat, dir, r, y, teacher),
      });
      this.label([r.cx, y + 1.9, rows[0]], '⭐ Твоя парта', { maxDist: 7, visible: () => g.quests.currentLesson()?.lesson === L.id });
    } else if (S) {
      this.buildSpecial(r, y, S, cz, south, dir);
    }
  }

  teacherLines(L) {
    const g = this.game;
    const cur = g.quests.currentLesson();
    const res = g.save.data.lessons[L.id];
    if (cur && cur.lesson === L.id) return [`Здравствуй! Сегодня у нас тема «${L.title}». Садись за жёлтую парту в первом ряду!`];
    if (res) return [`Ты уже получил «${res.best}» по предмету «${L.subject}». Хочешь улучшить результат? Садись за парту!`];
    return [`Это кабинет «${L.subject}». Можешь сесть за парту и потренироваться в любое время!`];
  }

  buildSpecial(r, y, S, cz, south, dir) {
    const g = this.game;
    const flags = g.save.progress.flags;
    const cx = r.cx;
    if (r.no === 103) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        this.box(cx - 4 + i * 4, y, 20 + j * 4, 2.6, 0.75, 1.2, '#fab1a0', { collide: true });
      }
      this.box(cx, y, 26.8, 10, 1.1, 1, '#dfe6e9', { collide: true });
      ['#e17055', '#fdcb6e', '#00b894'].forEach((c, i) => this.geo(GEO.sphere, c, cx - 2 + i * 2, y + 1.3, 26.8, { sx: 0.25, sy: 0.2, sz: 0.25 }));
      npc(this, { x: cx + 3, y, z: 27.3, yaw: Math.PI, name: 'Повар тётя Маша', avatar: '👩‍🍳', look: npcLook('#ffffff', '#dfe6e9', '#6d4c41', { shape: 'round' }),
        lines: () => (flags.lunch ? ['Приходи завтра, будут пирожки с яблоком!'] : ['Проголодался? Подойди к прилавку и возьми булочку с компотом!']) });
      this.interact({
        pos: [cx, y + 1, 25.6], radius: 2, prompt: 'Взять булочку и компот 🥐', enabled: () => !flags.lunch,
        action: () => { flags.lunch = true; g.audio.play('pop'); g.save.addXp(10); g.ui.toast('🥐 Ням! Силы восстановлены! +10 XP'); },
      });
    } else if (r.no === 104) {
      this.box(cx, y, 22, 12.4, 0.02, 11.6, '#f6b26b', { cast: false });
      this.box(cx, y + 0.01, 22, 0.1, 0.02, 11.6, '#ffffff', { cast: false });
      this.box(cx + 5.5, y, 22, 0.15, 3, 0.15, '#636e72', { collide: true });
      this.box(cx + 5.3, y + 2.6, 22, 0.1, 1, 1.4, '#ffffff');
      this.geo(new THREE.TorusGeometry(0.3, 0.04, 6, 14), '#e17055', cx + 4.95, y + 2.7, 22, { rx: Math.PI / 2 });
      ball(this, cx, y, 22);
      knowledgeStar(this, 'star_school1', cx - 5.5, y, 27);
      this.interact({
        pos: [cx + 4.2, y + 1, 22], radius: 1.8, prompt: 'Бросить мяч в кольцо 🏀',
        action: () => {
          if (Math.random() < 0.45) { g.audio.play('correct'); g.save.addCoins(2, 'hoop'); g.ui.toast('🏀 Попал! +2 🪙'); g.fx.burst(new THREE.Vector3(cx + 4.95, y + 2.7, 22), '#e17055', 15); }
          else { g.audio.play('kick'); g.ui.toast('🏀 Мимо! Попробуй ещё раз.'); }
        },
      });
    } else if (r.no === 204) {
      for (let i = 0; i < 4; i++) {
        this.box(cx - 5 + i * 3.3, y, 27.3, 2.6, 2.6, 0.6, '#b07d4f', { collide: true });
        for (let s = 0; s < 3; s++) for (let b = 0; b < 6; b++) this.box(cx - 6 + i * 3.3 + b * 0.4, y + 0.3 + s * 0.8, 27.0, 0.3, 0.55, 0.3, ['#ff6b6b', '#3fa7ff', '#2ed573', '#ffc93c', '#a29bfe'][(b + s + i) % 5], { cast: false });
      }
      this.box(cx, y, 21, 4, 0.75, 1.6, '#e8c18f', { collide: true });
      let n = 0;
      this.interact({
        pos: [cx, y + 1, 19.6], radius: 1.8, prompt: 'Почитать энциклопедию 📚',
        action: () => {
          g.ui.dialog.show([{ name: 'Энциклопедия', avatar: '📚', text: LIB_FACTS[n++ % LIB_FACTS.length] }]);
          if (!flags.library) { flags.library = true; g.save.addXp(10); }
        },
      });
      npc(this, { x: cx - 3, y, z: 21, yaw: Math.PI, name: 'Библиотекарь Софья', avatar: '👩‍💼', look: npcLook('#6c5ce7', '#2d3436', '#2d3436', { shape: 'tall', acc: { glasses: { model: 'round', color: '#111' } } }),
        lines: ['Тсс! В библиотеке тихо. Возьми энциклопедию на столе — там много интересного!'] });
    } else if (r.no === 205) {
      this.box(cx - 3, y, 26, 2.2, 0.7, 1, '#ffffff', { collide: true });
      this.box(cx + 4, y, 27.5, 0.6, 2.2, 0.3, '#74b9ff', { collide: true });
      this.interact({
        pos: [cx + 4, y + 1, 26.6], radius: 1.6, prompt: 'Измерить рост 📏',
        action: () => { const cm = 128 + Math.floor(Math.random() * 25); g.ui.toast(`📏 Твой рост: ${cm} см. Ты растёшь не по дням, а по часам!`); },
      });
      npc(this, { x: cx, y, z: 24, yaw: Math.PI, name: 'Доктор Айболитова', avatar: '👩‍⚕️', look: npcLook('#ffffff', '#ffffff', '#d63031', { shape: 'tall' }),
        lines: ['Чтобы быть здоровым: спи 9 часов, ешь фрукты, гуляй на свежем воздухе и мой руки!'] });
    } else if (r.no === 304) {
      this.box(cx, y, 25.5, 12, 0.6, 4.6, '#a55eea', { walk: true, collide: false });
      this.world.addBox(cx - 6, cx + 6, y, y + 0.55, 23.2, 27.8, { camera: false });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) this.box(cx - 4 + j * 2, y, 17.5 + i * 1.3, 0.8, 0.5, 0.6, '#d63031');
      this.box(cx - 3, y + 0.6, 25.5, 1.8, 1, 0.8, '#2d3436', { collide: true });
      const notes = [60, 62, 64, 65, 67, 69, 71, 72];
      let k = 0;
      this.interact({
        pos: [cx - 3, y + 1.6, 24.4], radius: 1.6, prompt: 'Сыграть на пианино 🎹',
        action: () => {
          const mel = [0, 2, 4, 0, 0, 2, 4, 0, 4, 5, 7];
          mel.forEach((n, i) => g.audio.tone(440 * Math.pow(2, (notes[n % 8] + (n >= 7 ? 12 : 0) - 69) / 12), 0.3, { type: 'triangle', vol: 0.15, delay: i * 0.22 }));
          if (k++ === 0) g.ui.toast('🎹 Браво! Настоящий музыкант!');
        },
      });
      knowledgeStar(this, 'star_school2', cx + 4.5, y + 0.6, 26.5);
    } else if (r.no === 305) {
      this.box(cx, y, 22, 5, 0.75, 2, '#b07d4f', { collide: true });
      npc(this, { x: cx, y, z: 24.3, yaw: Math.PI, name: 'Директор Иван Петрович', avatar: '👨‍💼', look: npcLook('#2d3436', '#2d3436', '#b2bec3', { shape: 'tall', extra: 'tie' }),
        lines: () => [`Здравствуй! Я горжусь нашими учениками. У тебя уже ${Object.keys(g.save.data.achievements).length} достижений!`, 'Учись с удовольствием: читай внимательно, а потом закрепляй практикой. Read & Practice!'] });
    }
  }

  buildStairs() {
    // лестничная клетка в северо‑западном блоке: x -20..-6.67, z 16..28
    for (let f = 1; f <= 3; f++) {
      const y = (f - 1) * FH;
      this.layerFor(f);
      this.box(-14.25, y, 19.75, 1.5, FH - 0.2, 6.5, '#ffe8cc', { collide: true });
      if (f < 3) {
        this.stairsZ(-19.8, -15, 16.5, 23, y, y + FH / 2, '#c8a2ff', 10);
        this.box(-13.4, y + FH / 2 - 0.2, 25.4, 12.8, 0.2, 4.8, '#c8a2ff', { walk: true, collide: true, map: '#e1b382' });
        this.stairsZ(-13.5, -7, 23, 16.5, y + FH / 2, y + FH, '#c8a2ff', 10);
        signText(this, `⬆ на ${f + 1} этаж`, -17.4, y + 2.6, 16.2, 1.6, 0.45, Math.PI, { bg: '#2ed573', fg: '#ffffff' });
      } else {
        this.box(-17.4, y, 16.6, 4.8, 1.1, 0.15, '#8e6cef', { collide: true });
      }
      if (f > 1) signText(this, `⬇ на ${f - 1} этаж`, -10.2, y + 2.6, 16.2, 1.6, 0.45, Math.PI, { bg: '#ff9f43', fg: '#ffffff' });
      if (f === 1) this.box(-10.25, 0, 16.6, 6.5, 1.9, 0.2, '#ffe8cc', { collide: true });
      this.label([-14.25, y + 3.2, 16.3], '🪜 Лестница', { maxDist: 14 });
    }
    this.layer(null);
  }

  buildLobby() {
    const g = this.game;
    // гардероб у левой стены холла
    for (let i = 0; i < 6; i++) {
      this.geo(GEO.cyl, '#636e72', -6.2, 1, 2 + i * 1.3, { sx: 0.05, sy: 2, sz: 0.05 });
      this.geo(GEO.box, ['#e17055', '#0984e3', '#00b894', '#fdcb6e', '#a29bfe', '#fd79a8'][i], -6.25, 1.3, 2 + i * 1.3, { sx: 0.3, sy: 0.8, sz: 0.5 });
    }
    this.box(-5.6, 0, 5.2, 0.6, 1, 7.6, '#b07d4f', { collide: true });
    this.point('coatRack', -4.6, 0, 5);
    this.label([-5.5, 2.8, 5], '🧥 Гардероб', { maxDist: 14 });
    npc(this, { x: -6.0, z: 9.2, yaw: Math.PI / 2, name: 'Гардеробщица Нина', avatar: '👵', look: npcLook('#fd79a8', '#2d3436', '#dfe6e9', { shape: 'round' }),
      lines: ['Давай курточку, повешу на крючок! Номерок не потеряй!'] });
    this.interact({
      pos: [-4.6, 1, 5], radius: 1.8, prompt: () => (g.quests.isDone('wardrobe') ? 'Гардероб (куртка уже сдана ✓)' : 'Сдать куртку в гардероб 🧥'),
      action: () => {
        if (g.quests.isDone('wardrobe')) { g.ui.toast('🧥 Твоя куртка висит на крючке №12'); return; }
        g.quests.complete('wardrobe');
        g.ui.toast('🎫 Ты получил номерок №12');
        setTimeout(() => this.bellNext(true), 900);
      },
    });
    // расписание
    this.box(5.4, 1, 9.85, 2.6, 1.6, 0.1, '#ffffff');
    signText(this, ['📅 Расписание', 'нажми E'], 5.4, 1.8, 9.78, 2.4, 1.3, Math.PI, { bg: '#ffeaa7', fg: '#2d3436' });
    this.label([5.4, 3, 9.6], '📅 Расписание уроков', { maxDist: 12 });
    this.interact({ pos: [5.4, 1, 9], radius: 1.8, prompt: 'Посмотреть расписание 📅', action: () => this.showSchedule() });
    // кубки
    this.box(5.8, 0, 3, 0.8, 2, 2.4, '#dfe6e9', { collide: true });
    [2.2, 3, 3.8].forEach((z, i) => this.geo(GEO.cone, '#f9ca24', 5.8, 1.2 + (i % 2) * 0.4, z, { sx: 0.18, sy: 0.4, sz: 0.18, emissive: '#6b5200' }));
    signText(this, ['Добро пожаловать!', 'Читай · Практикуй · Побеждай'], 0, 3.1, 9.85, 6, 0.9, Math.PI, { bg: '#6c5ce7', fg: '#ffffff', sub: '#ffeaa7' });
    plant(this, -5.6, 0, 0.8);
    plant(this, 5.6, 0, 0.8);
    // выход
    this.point('exitDoor', 0, 0, 0.8);
    this.label([0, 3.2, 0.5], '🚪 Выход на улицу', { maxDist: 10 });
    this.interact({
      pos: [0, 1, 0.6], radius: 1.6, prompt: 'Выйти на улицу 🌳',
      action: () => {
        if (g.quests.currentLesson()) {
          g.ui.dialog.show([{ name: 'Сова Соня', avatar: '🦉', text: 'Уроки ещё не закончились! Посмотри задание сверху — тебе нужно в кабинет.' }],);
          return;
        }
        g.audio.play('door');
        g.goTo('street', 'fromSchool');
      },
    });
    npc(this, { x: 3.2, z: 6.5, yaw: -Math.PI / 2, name: 'Охранник Сергей', avatar: '💂', look: npcLook('#2d3436', '#2d3436', '#2d3436', { shape: 'tall' }),
      lines: () => {
        const c = g.quests.currentLesson();
        if (c) {
          const L = g.lessons.byId[c.lesson];
          return [`Тебе в кабинет ${L.room} — это ${Math.floor(L.room / 100)} этаж. Лестница в конце коридора слева!`];
        }
        return ['Хорошего дня! Береги себя по дороге домой.'];
      } });
  }

  showSchedule() {
    const g = this.game;
    const ids = g.quests.dayLessons();
    const lines = ids.map((id, i) => {
      const L = g.lessons.byId[id];
      const done = g.quests.isDone(`lesson_${id}`);
      return `${done ? '✅' : '⬜'} ${i + 1}. ${L.icon} ${L.subject} — каб. ${L.room} (${Math.floor(L.room / 100)} этаж)`;
    });
    g.ui.dialog.show([{ name: `Расписание на день ${g.save.progress.day}`, avatar: '📅', text: lines.join('   ') }]);
  }

  // звонок на следующий урок
  bellNext(first = false) {
    const g = this.game;
    const c = g.quests.currentLesson();
    if (!c) return;
    const L = g.lessons.byId[c.lesson];
    const start = CONFIG.lesson.firstLessonStart + (c.no - 1) * (CONFIG.lesson.gameMinutes + CONFIG.lesson.breakMinutes);
    g.setClockAtLeast(start - (first ? 5 : 2));
    g.ringBell(`Урок ${c.no}: ${L.icon} ${L.subject} — кабинет ${L.room}`);
    g.ui.tip(`Иди в кабинет <b>${L.room}</b> (${Math.floor(L.room / 100)} этаж). Следуй за стрелкой цели и смотри на таблички у дверей!`);
  }

  // ---------- урок ----------
  startLesson(L, seat, dir, room, y, teacher) {
    const g = this.game;
    const cur = g.quests.currentLesson();
    const scheduled = !!(cur && cur.lesson === L.id);
    const p = g.player;
    p.place(seat.x, seat.y, seat.z, dir > 0 ? 0 : Math.PI);
    p.frozen = true;
    p.model.pose = 'sit';
    g.cam.override = {
      pos: new THREE.Vector3(seat.x + 1.2, seat.y + 2.4, seat.z - dir * 2.6),
      look: new THREE.Vector3(room.cx, y + 1.6, dir < 0 ? 0.2 : 27.8),
    };
    if (scheduled) {
      const start = CONFIG.lesson.firstLessonStart + (cur.no - 1) * (CONFIG.lesson.gameMinutes + CONFIG.lesson.breakMinutes);
      g.setClockAtLeast(start);
    }
    teacher.wave = 2;
    g.ui.dialog.show([{ name: L.teacher || 'Учитель', avatar: L.teacherAvatar || '👩‍🏫', text: L.intro || `Здравствуйте, ребята! Тема урока: «${L.title}». Сначала читаем, потом практикуемся!` }], () => {
      g.lesson.start(L, {
        scheduled,
        onFinish: (res) => this.finishLesson(L, res, scheduled, teacher),
      });
    });
  }

  finishLesson(L, res, scheduled) {
    const g = this.game;
    const p = g.player;
    p.frozen = false;
    p.model.pose = 'stand';
    p.pos.z += p.facing === 0 ? -1.2 : 1.2;
    g.cam.override = null;
    g.cam.snap(p.pos);
    if (scheduled) {
      g.quests.complete(`lesson_${L.id}`, true);
      const next = g.quests.currentLesson();
      if (next) {
        setTimeout(() => {
          g.ringBell('Перемена! 🎉');
          setTimeout(() => this.bellNext(), 3500);
        }, 500);
      } else {
        g.ringBell('Уроки окончены! 🎉');
        g.ui.tip('Ура! Все уроки на сегодня пройдены. Теперь можно идти <b>домой</b>, а можно ещё потренироваться в любом кабинете.');
        g.achievements.unlock('day1');
      }
    }
  }

  // если цель на другом этаже — ведём по лестнице
  route(p) {
    const py = this.game.player.pos.y;
    const pl = this.game.player.pos;
    const tf = Math.round(p.y / FH);
    const pf = Math.round(py / FH);
    const inWell = pl.x < -6.8 && pl.z > 16.3;
    if (Math.abs(p.y - py) < 1 && !inWell) return p;
    if (inWell) {
      const base = Math.floor((py + 0.05) / FH) * FH;
      if (Math.abs(p.y - py) < 0.6) return p;
      if (p.y > py) return py < base + FH / 2 - 0.1 ? new THREE.Vector3(-17.4, base + FH / 2, 25.4) : new THREE.Vector3(-10.2, base + FH, 16.4);
      const b2 = Math.floor((py - 0.05) / FH) * FH;
      return py > b2 + FH / 2 + 0.1 ? new THREE.Vector3(-10.2, b2 + FH / 2, 25.4) : new THREE.Vector3(-17.4, b2, 16.4);
    }
    if (tf > pf) return this.points[`stairsUp${pf + 1}`];
    if (tf < pf) return this.points[`stairsDown${pf + 1}`];
    return p;
  }

  update(dt) {
    const py = this.game.player.pos.y;
    const vf = Math.floor((py + 1.3) / FH) + 1; // видимые этажи: до текущего
    for (let f = 1; f <= 3; f++) this.setLayerVisible(`f${f}`, f <= vf);
    super.update(dt);
  }

  enter() {
    const g = this.game;
    if (!g.quests.isDone('wardrobe') && g.quests.isDone('go_school')) {
      g.ui.tip('Добро пожаловать в школу! Сначала сдай куртку в <b>гардероб</b> — он слева в холле.', 'tip_school');
    } else if (g.quests.currentLesson()) {
      setTimeout(() => this.bellNext(), 800);
    }
  }
}
