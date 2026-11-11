import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { windowPane, plant, signText, GEO } from './props.js';
import { coin, knowledgeStar, npc, npcLook } from './entities.js';
import { mat, textTexture } from '../core/gfx.js';

const RIDDLES = [
  { q: 'Зимой и летом одним цветом. Что это?', a: ['Ёлка', 'Снеговик', 'Солнце'], ok: 0 },
  { q: 'Сколько будет 7 × 8?', a: ['54', '56', '64'], ok: 1 },
  { q: 'Как по‑английски «кошка»?', a: ['Dog', 'Cow', 'Cat'], ok: 2 },
  { q: 'Не лает, не кусает, а в дом не пускает. Что это?', a: ['Замок', 'Кот', 'Ветер'], ok: 0 },
  { q: 'Какая планета ближе всех к Солнцу?', a: ['Марс', 'Меркурий', 'Венера'], ok: 1 },
  { q: 'Сколько дней в високосном году?', a: ['365', '364', '366'], ok: 2 },
];

const DOORBELL = ['Гав‑гав! 🐕 (Похоже, дома только собака)', 'Никого нет дома... 🤫', 'Мяу! 🐈', 'Кто там? — Это я, сосед! Хорошего дня! 👋', 'За дверью играет весёлая музыка 🎶'];

// Подъезд: коридор 3 этажа, двери соседей, лифт
export class HallwayScene extends BaseScene {
  constructor(game) {
    super(game, 'hallway');
    this.title = '🚪 Подъезд, 3 этаж';
    this.cameraDist = 4;
    this.mapZoom = 9;
    this.mapBg = '#3d3b5c';
    this.indoor = true;
    this.nav = { home: 'homeDoor', default: 'elevator' };
  }

  build() {
    const g = this.game;
    const prog = g.save.progress;
    this.setupLights({ sky: '#d9ecff', sun: true, hemi: 1.1, ambient: 0.35, shadowSize: 14, sunPos: [-15, 20, 8] });
    const H = 3;
    this.box(0, -0.2, 0, 22, 0.2, 6, '#b8c1ec', { walk: true, map: '#e0e4f7' });
    // плитка «шахматка»
    for (let x = -10; x < 10; x += 1) for (let z = -2; z < 2; z += 1) if ((x + z) % 2 === 0) this.box(x + 0.5, 0, z + 0.5, 1, 0.01, 1, '#a3acdc', { cast: false });
    const wall = '#ffe8cc';
    this.wallX(-2.1, -10, 10, 0, H, wall, [[-6.7, -5.3], [-1.7, -0.3], [3.3, 4.7]]);
    this.wallX(2.1, -10, 10, 0, H, wall, [[0.3, 1.7]]);
    this.wallZ(-10.1, -2.1, 2.1, 0, H, wall, [[-1.6, 1.6]], { gapH: H });
    this.wallZ(10.1, -2.1, 2.1, 0, H, '#c9d1d9', [[-0.9, 0.9]]);
    this.box(0, 0, -2.15, 20, 0.5, 0.06, '#8e7dff', { cast: false });
    this.box(0, 0, 2.15, 20, 0.5, 0.06, '#8e7dff', { cast: false });

    // двери квартир
    const doors = [
      { x: -6, z: -2.1, n: 12, mine: true }, { x: -1, z: -2.1, n: 11 }, { x: 4, z: -2.1, n: 10 }, { x: 1, z: 2.1, n: 9 },
    ];
    doors.forEach((d) => {
      const s = d.z < 0 ? 1 : -1;
      this.box(d.x, 0, d.z - 0.02 * s, 1.4, 2.3, 0.1, d.mine ? '#e17055' : ['#6c5ce7', '#00b894', '#0984e3'][d.n % 3]);
      this.box(d.x + 0.45, 1.05, d.z + 0.06 * s, 0.1, 0.1, 0.1, '#f9ca24');
      signText(this, `кв. ${d.n}`, d.x, 2.55, d.z + 0.07 * s, 0.8, 0.35, s > 0 ? 0 : Math.PI, { bg: '#ffffff', fg: '#2d3436' });
      this.world.addBox(d.x - 0.7, d.x + 0.7, 0, 2.3, Math.min(d.z, d.z - 0.1 * s), Math.max(d.z, d.z - 0.1 * s));
      if (d.mine) return;
      let rang = 0;
      this.interact({
        pos: [d.x, 1, d.z + 0.8 * s], radius: 1.2, prompt: `Позвонить в кв. ${d.n} 🔔`,
        action: () => { g.audio.play('ding'); g.ui.toast(DOORBELL[(d.n + rang++) % DOORBELL.length]); },
      });
    });
    this.point('homeDoor', -6, 0, -1.3);
    this.label([-6, 2.9, -1.6], '🏠 Твоя квартира', { maxDist: 9 });
    this.interact({ pos: [-6, 1, -1.4], radius: 1.2, prompt: 'Вернуться домой 🏠', action: () => g.goTo('home', 'fromHall') });

    // лестница (закрыта на уборку)
    for (let i = 0; i < 7; i++) this.box(-10.4 - i * 0.35, -3, 0, 0.35, 3 - (i + 1) * 0.38, 3.2, '#c8c8d8');
    this.box(-12.3, -3, 0, 0.2, 4, 4.2, wall);
    this.box(-10.3, 0, 0, 0.1, 1, 3.2, '#ff7675', { collide: true });
    signText(this, ['⚠️ Мокрый пол!', 'Пользуйтесь лифтом'], -10.25, 1.4, 0, 2, 0.9, Math.PI / 2, { bg: '#ffeaa7', fg: '#d63031' });
    this.interact({
      pos: [-9.6, 1, 0], radius: 1.5, prompt: 'Спуститься по лестнице',
      action: () => g.ui.dialog.show([{ name: 'Уборщица тётя Зина', avatar: '🧹', text: 'Ой, осторожно, я только что помыла лестницу! Поезжай на лифте, он справа, в конце коридора.' }]),
    });

    // окно и декор
    windowPane(this, -5, 0.9, 2.1, 2, 1.4, 'x');
    windowPane(this, 6, 0.9, 2.1, 2, 1.4, 'x');
    plant(this, -9.2, 0, -1.5);
    plant(this, 9.3, 0, -1.6, 0.9);
    this.box(-3, 0, 1.75, 1.6, 0.45, 0.5, '#b07d4f', { collide: true }); // скамейка
    signText(this, ['Доска объявлений', '🎈 Праздник двора в субботу!'], 7, 1.6, -2.03, 2, 1.1, 0, { bg: '#dff9fb', fg: '#130f40' });

    // соседка с загадками
    let solved = !!prog.flags.riddle;
    npc(this, {
      x: 3, z: -1, yaw: 0, name: 'Бабушка Валя', avatar: '👵',
      look: npcLook('#a29bfe', '#636e72', '#dfe6e9', { shape: 'normal', extra: 'robe' }),
      prompt: 'Поговорить',
      lines: () => {
        if (solved) return ['Умница! Беги скорее в школу, не опоздай!'];
        const r = RIDDLES[(prog.day - 1) % RIDDLES.length];
        return [
          { name: 'Бабушка Валя', avatar: '👵', text: 'Доброе утро, внучок! А отгадай‑ка мою загадку!' },
          {
            name: 'Бабушка Валя', avatar: '👵', text: r.q,
            choices: r.a.map((a, i) => ({
              text: a,
              action: () => {
                if (i === r.ok) {
                  solved = prog.flags.riddle = true;
                  g.audio.play('correct');
                  g.save.addCoins(5, 'riddle');
                  g.ui.dialog.show([{ name: 'Бабушка Валя', avatar: '👵', text: 'Правильно! Держи 5 монеток на конфеты! 🍬' }]);
                } else {
                  g.audio.play('wrong');
                  g.ui.dialog.show([{ name: 'Бабушка Валя', avatar: '👵', text: 'Не‑а! Подумай ещё и приходи снова.' }]);
                }
              },
            })),
          },
        ];
      },
    });

    // ---------- лифт ----------
    // кабина за дверями
    this.box(11.2, -0.2, 0, 2.2, 0.2, 2.2, '#95a5a6', { walk: true });
    this.box(11.2, 0, -1.15, 2.2, H, 0.1, '#bdc3c7', { collide: true });
    this.box(11.2, 0, 1.15, 2.2, H, 0.1, '#bdc3c7', { collide: true });
    this.box(12.35, 0, 0, 0.1, H, 2.4, '#bdc3c7', { collide: true });
    this.box(12.28, 0.5, 0, 0.05, 1.8, 1, '#dfe6e9', { emissive: '#666' }); // зеркало
    this.box(11.2, H, 0, 2.4, 0.1, 2.4, '#bdc3c7', { collide: true });
    // двери
    this.doorL = this.box(10.12, 0, -0.45, 0.08, 2.3, 0.9, '#aab6c3', { dynamic: true });
    this.doorR = this.box(10.12, 0, 0.45, 0.08, 2.3, 0.9, '#aab6c3', { dynamic: true });
    this.doorCol = this.world.addBox(10.0, 10.25, 0, 2.3, -0.9, 0.9);
    this.doorOpen = 0;
    this.doorTarget = 0;
    // табло этажа
    this.dispCanvasFloor = 1;
    this.dispTex = textTexture('1', { w: 128, h: 96, bg: '#111', fg: '#ff4d4d', font: 'bold 70px monospace', radius: 10 });
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ map: this.dispTex }));
    disp.position.set(10.0, 2.6, 0);
    disp.rotation.y = -Math.PI / 2;
    this.scene.add(disp);
    // кнопка вызова
    this.box(10.03, 1, 1.4, 0.06, 0.35, 0.22, '#7f8c8d');
    this.callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), mat('#ecf0f1'));
    this.callBtn.rotation.z = Math.PI / 2;
    this.callBtn.position.set(9.98, 1.17, 1.4);
    this.scene.add(this.callBtn);
    this.point('elevatorButton', 9.5, 0, 1.4);
    this.point('elevator', 10.9, 0, 0);
    this.label([10, 3.0, 0], '🛗 Лифт', { maxDist: 14 });
    this.label([10, 1.75, 1.4], '🔘 Кнопка вызова', { maxDist: 6 });

    this.state = 'idle'; // idle | coming | open
    this.interact({
      pos: [9.5, 1, 1.4], radius: 1.4, prompt: 'Вызвать лифт 🛗',
      enabled: () => this.state === 'idle',
      action: () => this.callElevator(),
    });
    this.interact({
      pos: [10.4, 1, 0], radius: 1.3, prompt: 'Зайти в лифт',
      enabled: () => this.state === 'open',
      action: () => this.enterElevator(),
    });
    this.onUpdate((dt) => this.updateElevator(dt));

    // бонусы
    knowledgeStar(this, 'star_hall1', -9.3, 0, 1.4);
    coin(this, 'c1', -3, 0, 0);
    coin(this, 'c2', 0, 0, 0);
    coin(this, 'c3', 6, 0, 0.5);

    this.spawn('start', -6, 0, -0.8, Math.PI / 2);
    this.spawn('fromHome', -6, 0, -0.8, Math.PI / 2);
    this.spawn('fromElevator', 9, 0, 0, -Math.PI / 2);
  }

  setFloor(n) {
    if (this.dispCanvasFloor === n) return;
    this.dispCanvasFloor = n;
    const t = textTexture(String(n), { w: 128, h: 96, bg: '#111', fg: '#ff4d4d', font: 'bold 70px monospace', radius: 10 });
    this.dispTex.image = t.image;
    this.dispTex.needsUpdate = true;
  }

  callElevator() {
    const g = this.game;
    this.state = 'coming';
    this.callBtn.material = mat('#ffd32a', { emissive: '#ffaa00' });
    g.audio.startHum();
    g.ui.toast('🛗 Лифт едет... Подожди немного!');
    let f = 1;
    const tick = setInterval(() => {
      f++;
      this.setFloor(f);
      if (f >= 3) {
        clearInterval(tick);
        g.audio.stopHum();
        g.audio.play('ding');
        this.state = 'open';
        this.doorTarget = 1;
        this.callBtn.material = mat('#ecf0f1');
        g.quests.complete('call_elevator');
      }
    }, 1100);
    this.timers = [tick];
  }

  enterElevator() {
    const g = this.game;
    g.quests.complete('enter_elevator', true);
    g.goTo('elevator', 'fromHall', '🛗 Лифт');
  }

  updateElevator(dt) {
    const sp = 1.4;
    this.doorOpen += Math.sign(this.doorTarget - this.doorOpen) * Math.min(Math.abs(this.doorTarget - this.doorOpen), dt * sp);
    this.doorL.position.z = -0.45 - this.doorOpen * 0.85;
    this.doorR.position.z = 0.45 + this.doorOpen * 0.85;
    this.doorCol.enabled = this.doorOpen < 0.9;
    // если игрок сам зашёл в кабину
    if (this.state === 'open' && this.game.player.pos.x > 10.6 && this.game.state === 'play') {
      this.state = 'gone';
      this.enterElevator();
    }
  }

  exit() {
    (this.timers || []).forEach(clearInterval);
    this.game.audio.stopHum();
  }

  enter() {
    const g = this.game;
    if (!g.quests.isDone('call_elevator')) g.ui.tip('Это подъезд. Лифт — в конце коридора. Подойди к <b>кнопке вызова</b> и нажми <b>E</b>.', 'tip_hall');
  }
}
