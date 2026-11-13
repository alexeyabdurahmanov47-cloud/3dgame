import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus } from './EventBus.js';
import { Input } from './Input.js';
import { AudioSys } from './Audio.js';
import { Effects } from './Effects.js';
import { mat } from './gfx.js';
import { SaveManager, newDayProgress } from '../save/SaveManager.js';
import { Player } from '../player/Player.js';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js';
import { UI } from '../ui/UI.js';
import { HUD } from '../ui/HUD.js';
import { Labels } from '../ui/Labels.js';
import { MainMenu } from '../ui/MainMenu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { Shop } from '../shop/Shop.js';
import { lookFromEquipped, PAJAMAS } from '../shop/items.js';
import { QuestManager } from '../quests/QuestManager.js';
import { Achievements } from '../quests/achievements.js';
import { LessonManager } from '../lessons/LessonManager.js';
import { LessonUI } from '../lessons/LessonUI.js';
import { MenuScene } from '../scenes/MenuScene.js';
import { HomeScene } from '../scenes/HomeScene.js';
import { HallwayScene } from '../scenes/HallwayScene.js';
import { ElevatorScene } from '../scenes/ElevatorScene.js';
import { StreetScene } from '../scenes/StreetScene.js';
import { SchoolScene } from '../scenes/SchoolScene.js';
import { fmtTime } from '../ui/dom.js';

const SCENES = { home: HomeScene, hallway: HallwayScene, elevator: ElevatorScene, street: StreetScene, school: SchoolScene };
const TITLES = { home: '🏠 Дом', hallway: '🚪 Подъезд', elevator: '🛗 Лифт', street: '🌳 Дорога в школу', school: '🏫 Школа' };

export class Game {
  constructor() {
    this.events = bus;
    this.save = new SaveManager();
    this.audio = new AudioSys(this.save);
    this.canvas = document.getElementById('game');
    this.input = new Input(this.canvas);
    this.state = 'menu';
    this.paused = false;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
    this.cam = new ThirdPersonCamera(this.camera);
    this.applyQuality();

    this.fx = new Effects();
    this.ui = new UI(this);
    this.lessons = new LessonManager();
    this.quests = new QuestManager(this);
    this.player = new Player(this);
    this.hud = new HUD(this);
    this.labels = new Labels(this);
    this.achievements = new Achievements(this);
    this.lesson = new LessonUI(this);
    this.shop = new Shop(this);
    this.pauseMenu = new PauseMenu(this);
    this.mainMenu = new MainMenu(this);

    // маркер цели (ромб над точкой назначения)
    this.marker = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat('#ffc93c', { emissive: '#a07000' }));
    gem.scale.y = 1.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 24), mat('#ffe066', { basic: true }));
    ring.rotation.x = Math.PI / 2;
    this.marker.add(gem, ring);
    this.marker.userData = { gem, ring };

    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && this.input.enabled && !this.paused) this.togglePause(true);
    };
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.onEscape();
      if (e.code === 'KeyM' && this.state === 'play' && this.input.enabled) {
        this.save.settings.music = !this.save.settings.music;
        this.audio.apply();
        this.ui.toast(this.save.settings.music ? '🎵 Музыка включена' : '🔇 Музыка выключена');
      }
    });
    // звук запускается после первого действия пользователя
    const unlockAudio = () => this.audio.init();
    addEventListener('pointerdown', unlockAudio);
    addEventListener('keydown', unlockAudio);

    addEventListener('resize', () => this.resize());
    this.resize();
    setInterval(() => { if (this.state === 'play') this.save.save(); }, 15000);
    addEventListener('beforeunload', () => this.save.save());

    bus.on('levelup', (lvl) => {
      this.audio.play('levelup');
      this.ui.toast(`🚀 <b>Новый уровень: ${lvl}!</b> +20 🪙`, 'lvl', 3500);
      this.save.addCoins(20, 'level');
    });

    this.menuScene = new MenuScene(this);
    this.menuScene.build();
    this.scene = null;
    this.mainMenu.show();
    this.clock = new THREE.Clock();
    this.fpsAcc = 0;
    this.loop();
  }

  get quality() { return this.save.settings.quality; }

  applyQuality() {
    const high = this.quality === 'high';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.75 : 1));
    this.renderer.shadowMap.enabled = high;
    if (this.scene?.sun) this.scene.sun.castShadow = high;
    this.renderer.shadowMap.needsUpdate = true;
    this.scene?.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  refreshInput() {
    const en = this.state === 'play' && !this.paused && !this.ui.hasModal() && !this.ui.dialog.open && !(this.lesson.active && !this.lesson.suspended) && !this.cutscene;
    this.input.enabled = en;
    this.input.wantLock = en;
    if (!en) this.input.unlock();
    if (!en) { this.input.joy.x = this.input.joy.y = 0; }
  }

  onEscape() {
    if (this.state !== 'play') {
      if (this.ui.hasModal()) this.ui.closeAllModals();
      return;
    }
    if (this.ui.dialog.open) return;
    const others = [...this.ui.modals.entries()].filter(([n]) => n !== 'pause');
    if (others.length) {
      const [n, el] = others[others.length - 1];
      el._close ? el._close() : this.ui.closeModal(n);
      return;
    }
    this.togglePause();
  }

  togglePause(force) {
    if (this.state !== 'play') return;
    const p = force ?? !this.paused;
    if (p === this.paused) return;
    this.paused = p;
    if (p) this.pauseMenu.open(); else this.pauseMenu.close();
    this.refreshInput();
  }

  // ---------- внешний вид игрока ----------
  applyLook() {
    const f = this.save.progress.flags;
    const pajamas = !f.dressed;
    this.player.setLook(lookFromEquipped(this.save.data.equipped, { skinOverride: pajamas ? PAJAMAS : null, noBackpack: !f.backpack }));
  }

  // ---------- игра ----------
  async startGame() {
    this.audio.init();
    this.mainMenu.hide();
    this.quests.build();
    const p = this.save.progress;
    await this.goTo(p.scene || 'home', p.spawn || 'start');
    if (p.day === 1 && !p.done.length) this.introDialog();
  }

  introDialog() {
    this.ui.dialog.show([
      { name: 'Мама', avatar: '👩', text: 'Доброе утро, солнышко! Пора вставать и собираться в школу!' },
      { name: 'Сова Соня', avatar: '🦉', text: 'Привет! Я Соня, твоя помощница. Я буду подсказывать, куда идти.' },
      { name: 'Сова Соня', avatar: '🦉', text: this.input.isTouch ? 'Двигайся джойстиком слева, крути камеру пальцем справа, а кнопка ✋ — действие.' : 'Ходи на WASD, поворачивай камеру — зажми правую кнопку мыши и двигай мышь, Shift — бег, пробел — прыжок, E — действие, Esc — меню.' },
      { name: 'Сова Соня', avatar: '🦉', text: 'Сверху — твоё задание и стрелка, указывающая на цель. Справа внизу — мини‑карта. Вперёд!' },
    ]);
  }

  toMainMenu() {
    this.save.save();
    this.paused = false;
    this.pauseMenu.close();
    this.lesson.abort();
    this.ui.closeAllModals();
    if (this.ui.dialog.open) this.ui.dialog.close();
    if (this.scene) { this.scene.exit(); this.scene.dispose(); this.scene = null; }
    this.labels.setScene(null);
    this.hud.show(false);
    this.state = 'menu';
    this.refreshInput();
    this.menuScene.refreshLook();
    this.mainMenu.show();
  }

  async goTo(name, spawn = 'start', title) {
    this.state = 'loading';
    this.refreshInput();
    this.hud.setPrompt(null);
    this.ui.loading.show(title || TITLES[name] || 'Загрузка...');
    this.audio.play('whoosh');
    await new Promise((r) => setTimeout(r, 60));
    if (this.scene) {
      this.scene.exit();
      this.scene.scene.remove(this.player.object);
      this.scene.dispose();
    }
    this.ui.loading.set(0.3);
    await new Promise((r) => requestAnimationFrame(r));
    const S = SCENES[name];
    const s = new S(this);
    this.scene = s;
    this.applyLook();
    s.build();
    s.finalize();
    this.ui.loading.set(0.75);
    s.scene.add(this.player.object);
    s.scene.add(this.marker);
    this.fx.setScene(s.scene);
    this.labels.setScene(s);
    const sp = s.spawns[spawn] || s.spawns.start;
    this.player.place(sp.x, sp.y, sp.z, sp.yaw);
    this.cam.maxDist = s.cameraDist;
    this.cam.override = null;
    this.cam.snap(this.player.pos, sp.yaw + Math.PI);
    this.cam.pitch = 0.3;
    const prog = this.save.progress;
    prog.scene = name;
    prog.spawn = spawn;
    this.save.save();
    // прогрев шейдеров
    this.renderer.compile(s.scene, this.camera);
    this.ui.loading.set(1);
    await new Promise((r) => setTimeout(r, 350));
    this.ui.loading.hide();
    this.state = 'play';
    this.hud.show(true);
    this.quests.refresh();
    this.refreshInput();
    s.enter();
  }

  // Конец дня: итоги и новый день
  endDay() {
    const prog = this.save.progress;
    const lessons = this.quests.dayLessons();
    const grades = lessons.map((id) => `${this.lessons.byId[id].icon} ${this.lessons.byId[id].subject}: <b>${this.save.data.lessons[id]?.last ?? '—'}</b>`).join('<br>');
    const pr = this.gradeProgress();
    this.achievements.unlock('day1');
    this.ui.confetti();
    this.audio.play('levelup');
    this.ui.dialog.show([
      { name: 'Мама', avatar: '👩', text: `Ты вернулся! Как прошёл день №${prog.day}? Я горжусь тобой!` },
      { name: 'Сова Соня', avatar: '🦉', text: `Итоги дня: ${grades.replace(/<br>/g, ', ').replace(/<\/?b>/g, '')}. Награда за день: 30 монет! Сдано предметов ${this.save.data.grade} класса: ${pr.passed} из ${pr.total}.` },
    ], () => {
      this.save.addCoins(30, 'day');
      if (pr.ok) this.promote();
      this.save.data.progress = newDayProgress(prog.day + 1);
      this.save.save();
      this.quests.build();
      this.goTo('home', 'start', `🌅 День ${prog.day + 1}`).then(() => {
        this.ui.dialog.show([{ name: 'Мама', avatar: '👩', text: 'Новый день — новые знания! Собирайся в школу!' }]);
      });
    });
  }

  // сколько предметов текущего класса сдано (оценка 3 и выше)
  gradeProgress() {
    const all = this.lessons.forGrade(this.save.data.grade);
    const rec = this.save.data.lessons;
    const passed = all.filter((L) => rec[L.id] && rec[L.id].best >= 3).length;
    return { passed, total: all.length, ok: all.length > 0 && passed === all.length };
  }

  // перевод в следующий класс
  promote() {
    const d = this.save.data;
    const from = d.grade;
    this.ui.confetti(4000);
    this.audio.play('achievement');
    if (from >= 11) {
      this.achievements.unlock('graduate');
      this.save.addCoins(500, 'graduate');
      this.ui.dialog.show([{ name: 'Директор', avatar: '👨‍💼', text: '🎓 Поздравляю! Ты окончил школу! Вот твой аттестат и 500 монет. Можешь выбрать любой класс в меню и повторить программу.' }]);
      return;
    }
    d.grade = from + 1;
    this.achievements.unlock('promoted');
    this.save.addCoins(100, 'promotion');
    this.save.save();
    this.ui.dialog.show([{ name: 'Директор', avatar: '👨‍💼', text: `🏆 Похвальная грамота! Ты сдал все предметы ${from} класса и переведён в ${d.grade} класс! Теперь твои уроки — на ${d.grade} этаже. +100 монет!` }]);
  }

  // ---------- игровой цикл ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.input.endFrame();
  }

  update(dt) {
    if (this.state === 'menu' || !this.scene) {
      this.menuScene.update(dt);
      this.renderer.render(this.menuScene.scene, this.menuScene.camera);
      return;
    }
    const s = this.scene;
    const prog = this.save.progress;
    if (this.state === 'play' && !this.paused) {
      if (!this.lesson.active) prog.clock += dt / CONFIG.clock.realSecondsPerGameMinute;
      this.player.update(dt, this.input, this.cam.yaw, s.world);
      s.update(dt);
      this.updateInteraction();
      this.lesson.update(dt);
    }
    this.hud._extraSub = this.quests.extraSub();
    this.cam.update(dt, this.player.pos, this.input.consumeLook(), s.world, this.save.settings);
    this.fx.update(dt);
    const target = this.state === 'play' ? this.quests.target() : null;
    this.updateMarker(target, dt);
    if (this.state === 'play') this.hud.update(target);
    this.labels.update(this.camera);
    this.renderer.render(s.scene, this.camera);
  }

  updateInteraction() {
    const s = this.scene;
    if (!this.input.enabled || this.lesson.active) { this.hud.setPrompt(null); return; }
    const p = this.player.pos;
    let best = null, bd = Infinity;
    for (const it of s.interactables) {
      if (!it.enabled()) continue;
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z, dy = it.pos.y - (p.y + 1);
      if (Math.abs(dy) > 1.8) continue;
      const d = Math.hypot(dx, dz);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    this.hud.setPrompt(best ? (typeof best.prompt === 'function' ? best.prompt() : best.prompt) : null);
    if (best && this.input.pressed('KeyE')) {
      this.audio.play('click');
      best.action();
    }
  }

  updateMarker(target, dt) {
    const m = this.marker;
    if (!target || this.lesson.active) { m.visible = false; return; }
    const d = Math.hypot(target.x - this.player.pos.x, target.z - this.player.pos.z);
    m.visible = d > 1.4;
    const t = performance.now() / 1000;
    m.position.set(target.x, target.y + 2.2 + Math.sin(t * 3) * 0.2, target.z);
    m.userData.gem.rotation.y += dt * 2;
    m.userData.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
  }

  // Звонок + обновление часов
  ringBell(text) {
    this.audio.play('bell');
    this.ui.bigMessage(`🔔 Звонок!<small>${text}</small>`, 3000);
  }

  setClockAtLeast(min) {
    const prog = this.save.progress;
    if (prog.clock < min) prog.clock = min;
  }

  timeStr() { return fmtTime(this.save.progress.clock); }
}
