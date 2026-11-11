import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { windowPane, plant, signText, GEO } from './props.js';
import { coin, knowledgeStar, ball, npc, npcLook } from './entities.js';
import { mat } from '../core/gfx.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { itemById } from '../shop/items.js';

// Квартира‑дуплекс (3–4 этаж дома). Внизу — кухня и гостиная, наверху — спальня и ванная.
const UP = 3; // высота второго уровня

export class HomeScene extends BaseScene {
  constructor(game) {
    super(game, 'home');
    this.title = '🏠 Квартира';
    this.cameraDist = 4.2;
    this.mapZoom = 9;
    this.mapFloorH = UP;
    this.mapBg = '#3d3b5c';
    this.indoor = true;
    this.nav = { default: 'door' };
  }

  build() {
    const g = this.game;
    const flags = g.save.progress.flags;
    this.setupLights({ sky: '#bfe8ff', sun: true, hemi: 1.0, shadowSize: 14, sunPos: [-12, 20, 10], ambient: 0.35 });

    // ---------- полы ----------
    this.box(0, -0.2, 0, 16.4, 0.2, 12.4, '#d9a066', { walk: true, map: '#f1d9b5' });
    this.box(-4.5, 0, 0, 6.8, 0.02, 11.8, '#e9eef5', { cast: false, map: '#dfe6e9' }); // плитка на кухне
    // перекрытие второго уровня с проёмом для лестницы
    this.layer('up');
    const slab = '#e3c08f';
    this.box(-3.5, UP - 0.2, 0, 9, 0.2, 12, slab, { walk: true, collide: true, map: '#f6e3c3' });
    this.box(7, UP - 0.2, 0, 2, 0.2, 12, slab, { walk: true, collide: true, map: '#f6e3c3' });
    this.box(3.5, UP - 0.2, 0.7, 5, 0.2, 10.6, slab, { walk: true, collide: true, map: '#f6e3c3' });
    this.box(4, UP, 1.5, 7.8, 0.02, 8.8, '#cfe9ff', { cast: false }); // плитка в ванной/игровой
    this.box(-4, UP, 1, 7.6, 0.02, 9.6, '#c9b3ff', { cast: false }); // ковёр в спальне
    this.layer(null);

    // ---------- стены ----------
    const wallLow = '#fff1d6', wallUp = '#e8f4ff', H = UP - 0.2;
    this.wallX(-6, -8, 8, 0, H, wallLow);
    this.wallX(6, -8, 8, 0, H, wallLow, [[4.2, 5.8]]);
    this.wallZ(-8, -6, 6, 0, H, wallLow);
    this.wallZ(8, -6, 6, 0, H, wallLow);
    this.wallZ(-1, -6, 6, 0, H, '#ffe0b3', [[-0.5, 1.8]]); // кухня | гостиная
    this.layer('up');
    this.wallX(-6, -8, 8, UP, 2.8, wallUp);
    this.wallX(6, -8, 8, UP, 2.8, wallUp);
    this.wallZ(-8, -6, 6, UP, 2.8, wallUp);
    this.wallZ(8, -6, 6, UP, 2.8, wallUp);
    this.wallZ(0, -3, 6, UP, 2.8, '#d6c8ff');
    this.wallZ(0, -6, -3, UP, 2.8, '#d6c8ff', [[-4.5, -3.1]]);
    this.wallX(-3, 0, 8, UP, 2.8, '#d6f0ff', [[2.6, 4.2]]);
    // перила у лестничного проёма
    this.box(3.5, UP, -4.55, 5, 1, 0.1, '#8e6cef', { collide: true });
    this.box(1, UP, -5.3, 0.1, 1, 1.4, '#8e6cef', { collide: true });
    [-5, -2, 5].forEach((x) => windowPane(this, x, UP + 0.9, 6, 1.6, 1.3, 'x'));
    windowPane(this, -8, UP + 0.9, -1, 1.6, 1.3, 'z');
    this.layer(null);
    [-6, -3, 3].forEach((x) => windowPane(this, x, 0.9, 6, 1.6, 1.3, 'x'));
    windowPane(this, -8, 0.9, 2, 1.6, 1.3, 'z');

    // ---------- лестница ----------
    this.stairsX(1, 6, -5.95, -4.7, 0, UP, '#c8925a', 10);
    this.point('stairsBottom', 0.4, 0, -5.3);
    this.point('stairsTop', 7, UP, -5.3);
    this.label([3.5, 2.2, -5.3], '🪜 Лестница', { maxDist: 9 });

    // ---------- кухня ----------
    this.box(-7.4, 0, -5.2, 1, 2.1, 1, '#f5f6fa', { collide: true }); // холодильник
    this.box(-6.86, 1.2, -5.2, 0.05, 0.5, 0.08, '#b2bec3');
    for (let x = -6.3; x < -2; x += 1) this.box(x + 0.5, 0, -5.55, 1, 0.9, 0.8, '#74b9ff', { collide: true });
    this.box(-3.8, 0.9, -5.55, 5.1, 0.06, 0.85, '#dfe6e9');
    this.box(-5.3, 0.96, -5.55, 0.9, 0.04, 0.6, '#2d3436'); // плита
    this.box(-3.2, 0.96, -5.6, 0.7, 0.15, 0.5, '#b2bec3'); // мойка
    // стол и завтрак
    this.box(-4.5, 0, 1.5, 2.2, 0.75, 1.3, '#e17055', { collide: true });
    this.box(-4.5, 0.75, 1.5, 2.3, 0.05, 1.4, '#fab1a0');
    [[-5.2, 0.5], [-3.8, 0.5], [-5.2, 2.5], [-3.8, 2.5]].forEach(([x, z]) => {
      this.box(x, 0, z, 0.45, 0.45, 0.45, '#fdcb6e');
      this.box(x, 0.45, z + (z < 1.5 ? -0.2 : 0.2), 0.45, 0.5, 0.06, '#fdcb6e');
    });
    const plate = new THREE.Group();
    plate.position.set(-4.5, 0.8, 1.1);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.03, 12), mat('#ffffff'));
    plate.add(pl);
    const pancakes = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10), mat('#f0b35b'));
      p.position.y = 0.03 + i * 0.045;
      pancakes.add(p);
    }
    const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), mat('#e84393'));
    berry.position.y = 0.23;
    pancakes.add(berry);
    plate.add(pancakes);
    pancakes.visible = !flags.breakfast;
    this.scene.add(plate);
    this.interact({
      pos: [-4.5, 1, 0.6], radius: 1.6, prompt: 'Позавтракать 🥞',
      enabled: () => !flags.breakfast,
      action: () => {
        flags.breakfast = true;
        pancakes.visible = false;
        g.audio.play('pop');
        g.save.addCoins(5, 'breakfast');
        g.achievements.unlock('breakfast');
        g.ui.dialog.show([{ name: 'Мама', avatar: '👩', text: 'Молодец! Завтрак — самая важная еда дня. Теперь у тебя много сил для учёбы! +5 🪙' }]);
      },
    });
    this.label([-4.5, 2, 1.5], '🍳 Кухня', { maxDist: 8 });
    npc(this, {
      x: -5.6, z: -4.2, yaw: 0, name: 'Мама', avatar: '👩',
      look: npcLook('#e84393', '#2d3436', '#6d4c41', { shape: 'tall', extra: 'robe' }),
      lines: () => {
        if (!flags.backpack || !flags.dressed) return ['Не забудь взять рюкзак и переодеться в форму! Всё наверху, в твоей комнате.'];
        if (!flags.breakfast) return ['Сначала позавтракай — блинчики на столе! А потом в школу.'];
        return ['Хорошего дня в школе! Слушай учителей и не забывай переходить дорогу на зелёный!'];
      },
    });

    // ---------- гостиная ----------
    this.box(5, 0, -0.5, 3, 0.5, 1.1, '#6c5ce7', { collide: true }); // диван
    this.box(5, 0.5, -0.95, 3, 0.6, 0.25, '#5f4dd6');
    this.box(3.6, 0.5, -0.5, 0.25, 0.3, 1.1, '#5f4dd6');
    this.box(6.4, 0.5, -0.5, 0.25, 0.3, 1.1, '#5f4dd6');
    this.box(5, 0, 1.2, 1.6, 0.4, 0.8, '#b07d4f', { collide: true }); // столик
    this.box(5, 0.01, 0.6, 3.6, 0.02, 2.6, '#ffeaa7', { cast: false }); // ковёр
    this.box(7.85, 0.9, 1.2, 0.1, 1, 1.8, '#2d3436'); // телевизор
    this.box(7.8, 0.95, 1.2, 0.05, 0.9, 1.7, '#0984e3', { emissive: '#05427a' });
    this.box(7.6, 0, 1.2, 0.5, 0.5, 2, '#b07d4f', { collide: true });
    plant(this, 7.3, 0, 5.3);
    plant(this, -0.4, 0, 5.3, 0.8);
    this.box(6.8, 0, 5.6, 1, 0.5, 0.45, '#8d5524', { collide: true }); // обувница
    this.cat(5.5, 0.55, -0.4);
    this.label([5, 2, 0], '🛋️ Гостиная', { maxDist: 8 });
    // входная дверь
    this.box(5, 0, 6.02, 1.6, 2.3, 0.12, '#a0522d', { dynamic: true });
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat('#f9ca24'));
    knob.position.set(5.6, 1.1, 5.92);
    this.scene.add(knob);
    this.world.addBox(4.2, 5.8, 0, 2.3, 5.95, 6.1);
    this.point('door', 5, 0, 5.3);
    this.label([5, 2.6, 5.7], '🚪 Выход в подъезд', { maxDist: 10 });
    this.interact({
      pos: [5, 1, 5.3], radius: 1.6, prompt: 'Выйти в подъезд 🚪',
      action: () => {
        if (!flags.backpack || !flags.dressed) {
          const miss = [!flags.backpack && 'рюкзак 🎒', !flags.dressed && 'школьную форму 👕'].filter(Boolean).join(' и ');
          g.ui.dialog.show([{ name: 'Мама', avatar: '👩', text: `Стой! Ты забыл ${miss}! Поднимись в свою комнату по лестнице.` }]);
          return;
        }
        if (g.quests.isDone('go_home') || g.quests.isDone('go_school')) {
          g.goTo('hallway', 'fromHome');
          return;
        }
        g.quests.complete('leave_home');
        g.audio.play('door');
        g.goTo('hallway', 'fromHome');
      },
    });

    // ---------- спальня (наверху) ----------
    this.layer('up');
    this.box(-6.6, UP, 4, 2.2, 0.45, 3.2, '#c8925a', { collide: true });
    this.box(-6.6, UP + 0.45, 4, 2, 0.25, 3, '#ffffff');
    this.box(-6.6, UP + 0.7, 4.6, 2.05, 0.1, 1.9, '#6c5ce7');
    this.box(-6.6, UP + 0.7, 2.9, 1.2, 0.18, 0.5, '#ffffff');
    this.box(-5.1, UP, 5.4, 0.7, 0.6, 0.7, '#b07d4f', { collide: true }); // тумбочка
    // будильник
    const alarm = new THREE.Group();
    alarm.position.set(-5.1, UP + 0.6, 5.4);
    alarm.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), mat('#ff6b6b')));
    alarm.children[0].rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), mat('#ffffff'));
    face.position.z = -0.06;
    face.rotation.y = Math.PI;
    alarm.add(face);
    alarm.position.y += 0.15;
    this.addObj(alarm);
    let alarmOn = !flags.alarmOff, alarmT = 0;
    this.onUpdate((dt) => {
      if (!alarmOn) return;
      alarmT += dt;
      alarm.rotation.z = Math.sin(alarmT * 40) * 0.15;
      if (alarmT % 0.5 < dt && g.player.pos.distanceTo(alarm.position) < 9) g.audio.play('tick');
    });
    this.interact({
      pos: [-5.1, UP + 1, 5.0], radius: 1.4, prompt: 'Выключить будильник ⏰', enabled: () => alarmOn,
      action: () => { alarmOn = false; flags.alarmOff = true; alarm.rotation.z = 0; g.ui.toast('⏰ Будильник выключен. Доброе утро!'); },
    });
    // шкаф
    this.box(-7.5, UP, -2.5, 0.9, 2.4, 2, '#b07d4f', { collide: true });
    this.box(-7.03, UP + 0.1, -2.5, 0.05, 2.2, 0.04, '#7a5230');
    this.box(-7.02, UP + 1.2, -2.2, 0.05, 0.15, 0.06, '#f9ca24');
    this.box(-7.02, UP + 1.2, -2.8, 0.05, 0.15, 0.06, '#f9ca24');
    this.point('wardrobe', -6.6, UP, -2.5);
    this.label([-7.2, UP + 2.8, -2.5], '👕 Шкаф с одеждой', { maxDist: 9 });
    this.interact({
      pos: [-6.6, UP + 1, -2.5], radius: 1.6,
      prompt: () => (flags.dressed ? 'Переодеться в пижаму 😴' : 'Переодеться в школьную форму 👕'),
      action: () => {
        flags.dressed = !flags.dressed;
        g.applyLook();
        g.audio.play('whoosh');
        g.fx.burst(new THREE.Vector3(g.player.pos.x, UP + 1, g.player.pos.z), '#a29bfe', 24);
        if (flags.dressed) {
          g.quests.complete('dress');
          const sk = itemById(g.save.data.equipped.skin);
          g.ui.toast(`✨ Ты надел: ${sk?.name || 'форму'}. Образ можно сменить в магазине!`);
        }
      },
    });
    // стол с рюкзаком
    this.box(-3, UP, 5.4, 1.6, 0.75, 0.8, '#e8c18f', { collide: true });
    this.box(-3.4, UP + 0.75, 5.5, 0.5, 0.08, 0.35, '#ff6b6b');
    this.box(-3.35, UP + 0.83, 5.5, 0.45, 0.06, 0.32, '#3fa7ff');
    this.box(-3, UP, 4.5, 0.5, 0.45, 0.5, '#3498db');
    this.box(-3, UP + 0.45, 4.25, 0.5, 0.5, 0.06, '#3498db');
    const bpItem = itemById(g.save.data.equipped.backpack) || itemById('bp_classic');
    const bp = new CharacterModel();
    bp.build({ skin: { body: '#000', pants: '#000', shoes: '#000', hair: '#000', skinTone: '#000' }, acc: { backpack: bpItem } });
    const bpMesh = bp.backpackGroup;
    bpMesh.parent.remove(bpMesh);
    bpMesh.position.set(-3, UP + 0.75, 4.55);
    bpMesh.rotation.y = Math.PI;
    bpMesh.visible = !flags.backpack;
    this.addObj(bpMesh);
    this.point('backpack', -3, UP, 4.1);
    this.label([-3, UP + 1.6, 4.6], '🎒 Рюкзак', { maxDist: 9, visible: () => !flags.backpack });
    this.interact({
      pos: [-3, UP + 1, 4.1], radius: 1.5, prompt: 'Взять рюкзак 🎒', enabled: () => !flags.backpack,
      action: () => {
        flags.backpack = true;
        bpMesh.visible = false;
        g.applyLook();
        g.audio.play('pop');
        g.quests.complete('backpack');
        g.ui.tip('Отлично! В рюкзаке учебники и тетради. Рюкзак можно сменить в <b>магазине</b>.', 'tip_backpack');
      },
    });
    // книга на столе
    let bookRead = !!flags.book;
    this.interact({
      pos: [-3.4, UP + 1, 5.0], radius: 1.1, prompt: 'Полистать книгу 📕',
      action: () => {
        g.ui.dialog.show([{ name: 'Книга «Удивительный мир»', avatar: '📕', text: 'Знаешь ли ты? Улитка может спать целых три года, а у жирафа язык длиной почти полметра!' }]);
        if (!bookRead) { bookRead = flags.book = true; g.save.addCoins(1, 'book'); }
      },
    });
    // полка с книгами и постер
    this.box(-1.5, UP + 1.4, -5.8, 2, 0.08, 0.35, '#b07d4f');
    ['#ff6b6b', '#3fa7ff', '#2ed573', '#ffc93c', '#a29bfe', '#ff8fd8'].forEach((c, i) => this.box(-2.3 + i * 0.3, UP + 1.48, -5.8, 0.22, 0.45 + (i % 3) * 0.08, 0.28, c));
    signText(this, ['Я люблю', 'учиться! ⭐'], -4.5, UP + 1.8, -5.88, 1.8, 1.1, 0, { bg: '#ffeaa7', fg: '#6c5ce7' });
    this.label([-4, UP + 2.4, 1], '🛏️ Твоя комната', { maxDist: 8 });

    // ---------- ванная / игровая (наверху) ----------
    this.box(7.55, UP, 4.5, 0.8, 0.85, 1, '#ffffff', { collide: true }); // раковина
    this.box(7.55, UP + 0.85, 4.5, 0.6, 0.1, 0.7, '#dfe6e9');
    this.box(7.9, UP + 1.2, 4.5, 0.05, 1, 0.8, '#bfe9ff', { emissive: '#4a8fb0' }); // зеркало
    this.box(6.2, UP, 5.3, 2, 0.6, 1.1, '#74b9ff', { collide: true }); // ванна
    this.box(6.2, UP + 0.4, 5.3, 1.8, 0.22, 0.9, '#c7ecff');
    this.interact({
      pos: [7, UP + 1, 4.5], radius: 1.4, prompt: 'Почистить зубы 🪥', enabled: () => !flags.teeth,
      action: () => {
        flags.teeth = true;
        g.audio.play('water');
        g.fx.burst(new THREE.Vector3(7.4, UP + 1.2, 4.5), '#ffffff', 16);
        g.save.addCoins(2, 'teeth');
        g.achievements.unlock('clean');
        g.ui.toast('🪥 Зубы блестят! +2 🪙');
      },
    });
    // игрушки
    this.box(2, UP, 4.8, 1.2, 0.7, 0.8, '#fd79a8', { collide: true });
    ['#ffc93c', '#2ed573', '#3fa7ff'].forEach((c, i) => this.box(1.2 + i * 0.45, UP, 2.2 + (i % 2) * 0.3, 0.35, 0.35, 0.35, c));
    this.geo(GEO.cone, '#ff6b6b', 4.5, UP + 0.9, 4.8, { sx: 0.3, sy: 0.6, sz: 0.3 });
    this.geo(GEO.cyl, '#dfe6e9', 4.5, UP + 0.35, 4.8, { sx: 0.3, sy: 0.7, sz: 0.3 });
    ball(this, 4, UP, 1);
    this.label([4, UP + 2.4, 2], '🧸 Игровая и ванная', { maxDist: 8 });

    // ---------- бонусы ----------
    knowledgeStar(this, 'star_home1', -0.7, UP, -5.4);
    coin(this, 'c1', 3, UP, -3.8);
    coin(this, 'c2', 6.8, UP, -3.8);
    this.layer(null);
    knowledgeStar(this, 'star_home2', -7.3, 0, 5.3);
    coin(this, 'c3', 2, 0, 3);
    coin(this, 'c4', -2.5, 0, -2);

    this.spawn('start', -5.6, UP, 2, Math.PI / 2);
    this.spawn('fromHall', 5, 0, 4.6, Math.PI);
  }

  cat(x, y, z) {
    const g = this.game;
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), mat('#f39c12'));
    body.scale.set(1, 0.7, 1.4);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), mat('#f39c12'));
    head.position.set(0, 0.12, 0.35);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), mat('#e67e22'));
      ear.position.set(s * 0.09, 0.28, 0.35);
      grp.add(ear);
    });
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), mat('#e67e22'));
    tail.position.set(0.15, 0.05, -0.4);
    tail.rotation.set(1.2, 0, 0.6);
    grp.add(body, head, tail);
    grp.position.set(x, y + 0.15, z);
    grp.rotation.y = -0.6;
    this.scene.add(grp);
    let t = 0, purr = 0;
    this.onUpdate((dt) => {
      t += dt;
      body.scale.y = 0.7 + Math.sin(t * 2) * 0.03;
      if (purr > 0) { purr -= dt; grp.position.y = y + 0.15 + Math.abs(Math.sin(t * 12)) * 0.05; }
    });
    this.interact({
      pos: [x, y + 0.5, z], radius: 1.6, prompt: 'Погладить котика 🐱',
      action: () => {
        purr = 1.5;
        g.audio.play('pop');
        g.fx.burst(new THREE.Vector3(x, y + 0.6, z), '#ff6b81', 10, 'heart');
        g.ui.toast('🐱 Мурр-мурр! Котик Персик доволен.');
      },
    });
  }

  update(dt) {
    this.setLayerVisible('up', this.game.player.pos.y > 1.3);
    super.update(dt);
  }

  // если цель на другом уровне квартиры — ведём к лестнице
  route(p) {
    const py = this.game.player.pos.y;
    const onStairs = py > 0.2 && py < UP - 0.2;
    if (onStairs) return p;
    if (p.y > UP - 0.5 && py < 0.5) return this.points.stairsBottom;
    if (p.y < 0.5 && py > UP - 0.5) return this.points.stairsTop;
    return p;
  }

  enter() {
    const g = this.game;
    const f = g.save.progress.flags;
    if (!f.dressed) g.ui.tip('Ты ещё в пижаме! Найди <b>шкаф</b> в комнате и переоденься. И не забудь <b>рюкзак</b>!', null, 8000);
  }
}
