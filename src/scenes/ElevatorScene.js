import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { plant, signText, windowPane } from './props.js';
import { coin, knowledgeStar, npc, npcLook } from './entities.js';
import { mat, textTexture } from '../core/gfx.js';
import { h } from '../ui/dom.js';

// Кабина лифта + площадка снаружи (меняется в зависимости от этажа)
export class ElevatorScene extends BaseScene {
  constructor(game) {
    super(game, 'elevator');
    this.title = '🛗 Лифт';
    this.cameraDist = 3.4;
    this.mapZoom = 12;
    this.mapBg = '#3d3b5c';
    this.indoor = true;
    this.floor = 3;
    this.moving = false;
    this.nav = { hallway: 'panel', street: 'exitDoor', school: 'exitDoor', default: 'exitDoor' };
  }

  build() {
    const g = this.game;
    this.setupLights({ sky: '#d9ecff', sun: true, hemi: 1.1, ambient: 0.4, shadowSize: 10, sunPos: [6, 18, 12] });
    const H = 2.8;
    // кабина: x -1.5..1.5, z -1.5..1.5; двери на z = 1.5
    this.box(0, -0.2, 0, 3, 0.2, 3, '#7f8c8d', { walk: true, map: '#b2bec3' });
    this.box(0, 0, 0, 2.6, 0.01, 2.6, '#a4b0be', { cast: false });
    const metal = '#c9d1d9';
    this.wallX(-1.55, -1.6, 1.6, 0, H, metal);
    this.wallZ(-1.55, -1.5, 1.5, 0, H, metal);
    this.wallZ(1.55, -1.5, 1.5, 0, H, metal);
    this.wallX(1.55, -1.6, 1.6, 0, H, '#aab6c3', [[-0.85, 0.85]]);
    this.box(0, H, 0, 3.3, 0.1, 3.3, '#b2bec3', { collide: true });
    this.box(0, 0.4, -1.47, 2, 1.9, 0.04, '#e8f4ff', { emissive: '#555', cast: false }); // зеркало
    this.box(0, 0.95, -1.42, 2.6, 0.06, 0.08, '#f9ca24', { cast: false }); // поручень
    // панель с кнопками
    this.box(1.48, 0.9, 0.6, 0.06, 0.8, 0.4, '#636e72');
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), mat('#ecf0f1'));
      b.rotation.z = Math.PI / 2;
      b.position.set(1.44, 1.0 + i * 0.15, 0.6);
      this.scene.add(b);
    }
    this.point('panel', 0.9, 0, 0.6);
    this.label([1.4, 1.95, 0.6], '🔘 Панель лифта', { maxDist: 5 });
    this.interact({ pos: [0.9, 1, 0.6], radius: 1.2, prompt: 'Нажать кнопку этажа 🔘', enabled: () => !this.moving, action: () => this.openPanel() });
    // табло
    this.dispTex = textTexture('3', { w: 128, h: 96, bg: '#111', fg: '#ff4d4d', font: 'bold 70px monospace', radius: 10 });
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ map: this.dispTex }));
    disp.position.set(0, 2.5, 1.48);
    disp.rotation.y = Math.PI;
    this.scene.add(disp);
    // двери
    this.doorL = this.box(-0.43, 0, 1.55, 0.86, 2.3, 0.08, '#aab6c3', { dynamic: true });
    this.doorR = this.box(0.43, 0, 1.55, 0.86, 2.3, 0.08, '#aab6c3', { dynamic: true });
    this.doorCol = this.world.addBox(-0.9, 0.9, 0, 2.3, 1.45, 1.65);
    this.doorOpen = 1;
    this.doorTarget = 1;

    // площадка снаружи: x -4..4, z 1.6..8
    this.box(0, -0.2, 4.8, 8.4, 0.2, 6.6, '#b8c1ec', { walk: true, map: '#e0e4f7' });
    this.wallZ(-4.1, 1.5, 8.1, 0, 3, '#ffe8cc');
    this.wallZ(4.1, 1.5, 8.1, 0, 3, '#ffe8cc');
    this.wallX(8.1, -4.1, 4.1, 0, 3, '#ffe8cc', [[-1, 1]], { gapH: 3 });
    this.exitBlock = this.world.addBox(-1, 1, 0, 3, 7.95, 8.25);
    this.wallX(1.55, -4.1, -1.6, 0, 3, '#ffe8cc');
    this.wallX(1.55, 1.6, 4.1, 0, 3, '#ffe8cc');

    // вариант: 1 этаж (вестибюль)
    this.lobby = new THREE.Group();
    this.landing = new THREE.Group();
    this.scene.add(this.lobby, this.landing);
    const L = { parent: this.lobby, dynamic: true };
    this.box(0, 0, 8.1, 2, 2.4, 0.1, '#55efc4', { ...L, emissive: '#1a6b55' }); // стеклянная дверь
    this.box(0, 2.4, 8.1, 2, 0.6, 0.15, '#ffe8cc', L);
    const exitSign = signText(this, '🚪 ВЫХОД', 0, 2.7, 7.98, 1.4, 0.4, Math.PI, { bg: '#2ed573', fg: '#ffffff' });
    this.scene.remove(exitSign);
    this.lobby.add(exitSign);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) this.box(-4.0, 0.9 + i * 0.35, 3.2 + j * 0.45, 0.12, 0.3, 0.4, '#74b9ff', L); // почтовые ящики
    const mb = signText(this, 'Почта 📬', -3.93, 2.2, 3.9, 1.2, 0.35, Math.PI / 2, { bg: '#ffffff', fg: '#0984e3' });
    this.scene.remove(mb);
    this.lobby.add(mb);
    this.box(3.3, 0, 5, 1.2, 1.1, 2, '#b07d4f', L); // стол консьержа
    this.point('exitDoor', 0, 0, 7.3);
    this.label([0, 2.9, 7.5], '🌤️ Выход на улицу', { maxDist: 10, visible: () => this.floor === 1 });

    // вариант: другие этажи
    const D = { parent: this.landing, dynamic: true };
    this.box(0, 0, 8.05, 2, 2.4, 0.1, '#ffe8cc', D);
    this.box(-2.5, 0, 8.0, 1.2, 2.2, 0.1, '#6c5ce7', D);
    this.box(2.5, 0, 8.0, 1.2, 2.2, 0.1, '#00b894', D);
    this.floorTex = textTexture('Этаж 3', { w: 512, h: 160, bg: '#ffffff', fg: '#6c5ce7', font: 'bold 90px Nunito, sans-serif' });
    const fs = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: this.floorTex, transparent: true }));
    fs.position.set(0, 2.6, 7.98);
    fs.rotation.y = Math.PI;
    this.landing.add(fs);

    // NPC консьерж (только в вестибюле)
    const conc = npc(this, {
      x: 3.3, z: 6.4, yaw: Math.PI, name: 'Консьерж Галина', avatar: '👩‍💼',
      look: npcLook('#0984e3', '#2d3436', '#b33939', { shape: 'tall' }),
      enabled: () => this.floor === 1,
      lines: ['Доброе утро! Школа — прямо по дорожке, через парк. Иди по жёлтым стрелкам!', 'И помни: дорогу переходим только на зелёный свет светофора! 🚦'],
    });
    this.conc = conc;
    this.labels[this.labels.length - 1].visible = () => this.floor === 1;
    plant(this, -3.4, 0, 7.4);
    knowledgeStar(this, 'star_lobby', 3.5, 0, 2.3);
    coin(this, 'c1', -2, 0, 5);
    windowPane(this, 4.1, 0.9, 3.2, 1.4, 1.2, 'z');

    this.interact({
      pos: [0, 1, 7.4], radius: 1.4, prompt: 'Выйти на улицу 🌤️', enabled: () => this.floor === 1 && !this.moving,
      action: () => {
        g.quests.complete('exit_building', true);
        g.audio.play('door');
        g.goTo('street', 'fromHome');
      },
    });
    this.onUpdate((dt) => this.updateDoors(dt));
    // после перезагрузки: если уже спустились, но ещё не вышли — остаёмся на 1 этаже
    if (g.quests.isDone('ride_elevator') && !g.quests.isDone('exit_building')) this.floor = 1;
    this.applyFloor();
    this.spawn('start', 0, 0, -0.6, 0);
    this.spawn('fromHall', 0, 0, 0.6, Math.PI);
  }

  applyFloor() {
    const lobby = this.floor === 1;
    this.lobby.visible = lobby;
    this.landing.visible = !lobby;
    this.conc.root.visible = lobby;
    this.exitBlock.enabled = !lobby;
    const t = textTexture(`Этаж ${this.floor}`, { w: 512, h: 160, bg: '#ffffff', fg: '#6c5ce7', font: 'bold 90px Nunito, sans-serif' });
    this.floorTex.image = t.image;
    this.floorTex.needsUpdate = true;
    const d = textTexture(String(this.floor), { w: 128, h: 96, bg: '#111', fg: '#ff4d4d', font: 'bold 70px monospace', radius: 10 });
    this.dispTex.image = d.image;
    this.dispTex.needsUpdate = true;
  }

  openPanel() {
    const g = this.game;
    const disp = h('div', { class: 'disp' }, String(this.floor));
    const btns = h('div', { class: 'btns' });
    [4, 3, 2, 1].forEach((n) => btns.append(h('button', { class: `elev-btn ${n === this.floor ? 'lit' : ''}`, onclick: (e) => {
      e.target.classList.add('lit');
      g.audio.play('click');
      setTimeout(() => { g.ui.closeModal('elevpanel'); this.goFloor(n); }, 250);
    } }, n)));
    const el = h('div', { class: 'overlay', onclick: (e) => e.target === el && g.ui.closeModal('elevpanel') },
      h('div', { class: 'elev-panel pop' }, disp, btns,
        h('div', { style: { marginTop: '14px', fontWeight: 800, color: '#2d3436' } }, 'Выбери этаж')));
    el._close = () => g.ui.closeModal('elevpanel');
    g.ui.openModal('elevpanel', el);
  }

  goFloor(n) {
    const g = this.game;
    if (n === this.floor) {
      this.doorTarget = 1;
      return;
    }
    this.moving = true;
    this.doorTarget = 0;
    g.audio.play('door');
    const steps = Math.abs(n - this.floor);
    const dir = Math.sign(n - this.floor);
    setTimeout(() => {
      g.audio.startHum();
      g.cam.shake = 0.06;
      let k = 0;
      const tick = setInterval(() => {
        k++;
        this.floor += dir;
        this.applyFloor();
        g.cam.shake = 0.04;
        if (k >= steps) {
          clearInterval(tick);
          g.audio.stopHum();
          g.audio.play('ding');
          this.doorTarget = 1;
          this.moving = false;
          if (this.floor === 1) {
            g.quests.complete('ride_elevator');
            g.ui.tip('Приехали на <b>1 этаж</b>! Выходи из лифта и иди к двери с надписью <b>«Выход»</b>.', 'tip_lobby');
          } else if (this.floor !== 3) {
            g.ui.tip(`Это ${this.floor} этаж — тут живут соседи. Тебе нужен <b>1 этаж</b>, чтобы выйти на улицу!`);
          }
        }
      }, 1400);
      this.timer = tick;
    }, 900);
  }

  updateDoors(dt) {
    this.doorOpen += Math.sign(this.doorTarget - this.doorOpen) * Math.min(Math.abs(this.doorTarget - this.doorOpen), dt * 1.3);
    this.doorL.position.x = -0.43 - this.doorOpen * 0.9;
    this.doorR.position.x = 0.43 + this.doorOpen * 0.9;
    this.doorCol.enabled = this.doorOpen < 0.9;
    // вышел из лифта на 3 этаже → в подъезд
    const p = this.game.player.pos;
    if (!this.moving && this.floor !== 1 && p.z > 2.6 && this.game.state === 'play') {
      if (this.floor === 3) this.game.goTo('hallway', 'fromElevator');
      else {
        p.z = 2.4;
        this.game.ui.toast('🚫 Это чужой этаж! Вернись в лифт и нажми «1».', 'warn');
      }
    }
  }

  exit() {
    clearInterval(this.timer);
    this.game.audio.stopHum();
  }

  enter() {
    if (!this.game.quests.isDone('ride_elevator')) this.game.ui.tip('Подойди к <b>панели с кнопками</b> справа от двери и выбери <b>1 этаж</b>.', 'tip_elev');
  }
}
