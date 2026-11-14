import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { tree, bush, flowers, bench, lamp, fence, house, signpost, groundArrow, signText, cloud, GEO } from './props.js';
import { coin, knowledgeStar, waterFlower, ball, dog, npc, npcLook } from './entities.js';
import { mat, seeded, textPlane } from '../core/gfx.js';
import { CONFIG } from '../config.js';

// Маршрут от дома до школы (точки поворотов)
const ROUTE = [[0, 1], [0, 30], [0, 40], [0, 50], [14, 58], [14, 76], [0, 84], [0, 90], [0, 99], [0, 110]];

const SIGNS = [
  { x: 3.2, z: 47, title: 'Табличка «Береги природу»', text: 'Дерево растёт 50 лет, а сломать его можно за минуту. Береги деревья и цветы!' },
  { x: 17, z: 66, title: 'Табличка «Знаешь ли ты?»', text: 'Одно большое дерево за день выделяет столько кислорода, сколько нужно для дыхания четырём людям!' },
  { x: -5.5, z: 60, title: 'Табличка у фонтана', text: 'Фонтаны строили ещё в Древнем Риме — по акведукам туда шла вода с гор.' },
  { x: 3, z: 80, title: 'Табличка «Птицы парка»', text: 'В нашем парке живут синицы, воробьи и дятлы. Дятел стучит по дереву до 20 раз в секунду!' },
  { x: 3.5, z: 104, title: 'Табличка «Школа №1»', text: 'Нашей школе больше 50 лет! Здесь 11 этажей: на каждом учится свой класс — с 1-го по 11-й. Есть лаборатории, компьютерный класс и большой спортзал.' },
];

export class StreetScene extends BaseScene {
  constructor(game) {
    super(game, 'street');
    this.title = '🌳 Улица';
    this.cameraDist = 6;
    this.mapZoom = 2.6;
    this.mapBg = '#8fd98a';
    this.nav = { school: 'schoolDoor', default: 'homeDoor' };
    this.cars = [];
  }

  build() {
    const g = this.game;
    const rnd = seeded(7);
    this.setupLights({ sky: '#8fd3ff', fog: [70, 170], shadowSize: 32, sunPos: [25, 45, 15] });

    // ---------- земля ----------
    this.box(0, -0.3, 62, 110, 0.3, 200, '#7bd36b', { walk: true, cast: false });
    this.box(0, 0, 64, 62, 0.01, 46, '#86dc74', { cast: false }); // трава парка
    this.box(0, 0, 105, 50, 0.02, 14, '#d1d8e0', { cast: false, map: '#c9ced6' }); // школьный двор

    // ---------- дом игрока ----------
    house(this, 0, -8, 24, 16, 12, '#ff9f8f', '#6c5ce7');
    this.box(0, 0, 0.2, 2, 2.4, 0.3, '#a0522d');
    this.box(0, 2.6, 0.9, 3.4, 0.15, 1.8, '#6c5ce7'); // козырёк
    this.box(0, 0, 0.8, 3, 0.15, 1.6, '#b2bec3', { cast: false });
    signText(this, 'Подъезд №1', 0, 3.1, 0.4, 2, 0.45, 0, { bg: '#ffffff', fg: '#6c5ce7' });
    this.point('homeDoor', 0, 0, 1.4);
    this.label([0, 3.6, 0.8], '🏠 Твой дом', { maxDist: 22 });
    this.interact({
      pos: [0, 1, 1.4], radius: 1.8, prompt: () => (g.quests.current()?.id === 'go_home' ? 'Зайти домой 🏠' : 'Зайти в подъезд'),
      action: () => {
        if (g.quests.current()?.id === 'go_home') {
          g.quests.complete('go_home', true);
          g.endDay();
        } else {
          g.ui.dialog.show([{ name: 'Сова Соня', avatar: '🦉', text: 'Домой пока рано — сначала уроки в школе! Иди по жёлтым стрелкам. 🏫' }]);
        }
      },
    });

    // ---------- дорожки ----------
    for (let i = 0; i < ROUTE.length - 1; i++) this.path(ROUTE[i], ROUTE[i + 1], 3, i < 2 || i > 6 ? '#c8cdd6' : '#f2d7a6');
    this.path([-20, 50], [0, 50], 2.4, '#f2d7a6');
    this.path([-9, 50], [-9, 60], 2.4, '#f2d7a6');
    this.path([14, 67], [26, 67], 2.4, '#f2d7a6');

    // ---------- двор: площадка и парковка ----------
    this.playground(-12, 14);
    this.label([-12, 3.2, 14], '🛝 Детская площадка: качели и горка', { maxDist: 22 });
    for (let i = 0; i < 4; i++) {
      this.box(12, 0, 6 + i * 4.5, 5, 0.02, 0.15, '#ffffff', { cast: false });
      if (i < 3) this.staticCar(12, 8.2 + i * 4.5, ['#e84393', '#0984e3', '#fdcb6e'][i]);
    }
    this.box(12, 0, 13, 6, 0.015, 15, '#636e72', { cast: false, map: '#7f8c8d' });
    this.label([12, 3, 13], '🚗 Парковка: будь осторожен рядом с машинами', { maxDist: 20 });

    // ---------- дорога 1 со светофором ----------
    this.road(35, 8);
    this.zebra(0, 35, 8);
    this.trafficLights();
    this.label([0, 3.6, 29.5], '🚦 Пешеходный переход: смотри на светофор!', { maxDist: 24, cls: 'goal' });
    for (let i = 0; i < 3; i++) this.addCar(1, 33.2, -45 + i * 32, ['#ff6b6b', '#3fa7ff', '#2ed573'][i]);
    for (let i = 0; i < 3; i++) this.addCar(-1, 36.8, 40 - i * 30, ['#ffc93c', '#a29bfe', '#fd79a8'][i]);

    // ---------- парк ----------
    this.label([0, 3.4, 44], '🌳 Парк: здесь можно отдохнуть', { maxDist: 24 });
    this.fountain(-9, 63);
    this.label([-9, 3.6, 63], '⛲ Фонтан: загадай желание!', { maxDist: 20 });
    bench(this, 2.8, 55, Math.PI / 2);
    bench(this, 16.8, 62, Math.PI / 2);
    bench(this, 11.2, 70, -Math.PI / 2);
    bench(this, -10.9, 55, Math.PI / 2);
    bench(this, -5, 82, Math.PI / 2);
    [[2.5, 44], [-2.5, 58], [11.5, 60], [16.5, 72], [7, 81], [-2.5, 88], [2.5, 26], [-2.5, 12], [2.5, 101], [-3, 106]].forEach(([x, z]) => lamp(this, x, z));
    flowers(this, -4, 45, 3, 1.5, 12, 0, rnd);
    flowers(this, 6, 45, 3, 1.5, 12, 0, rnd);
    flowers(this, 19, 62, 1.5, 4, 10, 0, rnd);
    flowers(this, -14, 63, 1.5, 4, 10, 0, rnd);
    flowers(this, 9, 77, 3, 1.5, 12, 0, rnd);
    // деревья (не на дорожках)
    let placed = 0;
    for (let i = 0; i < 400 && placed < 75; i++) {
      const x = -30 + rnd() * 60, z = 2 + rnd() * 108;
      if (this.nearRoute(x, z) < 4.5) continue;
      if (Math.abs(x) < 22 && z > 100) continue; // школа и двор
      if (z > 29 && z < 41) continue; // дорога 1
      if (z > 90 && z < 100) continue; // дорога 2
      if (x > -20 && x < -4 && z > 5 && z < 24) continue; // площадка
      if (x > 8 && x < 16 && z > 4 && z < 23) continue; // парковка
      if (Math.hypot(x + 9, z - 63) < 6) continue; // фонтан
      if (Math.abs(x) < 14 && z < 3) continue;
      tree(this, x, z, 0.8 + rnd() * 0.6, rnd() > 0.75 ? 'pine' : 'round', 0, rnd);
      placed++;
    }
    for (let i = 0; i < 30; i++) {
      const x = -30 + rnd() * 60, z = 42 + rnd() * 46;
      if (this.nearRoute(x, z) < 2.5) continue;
      bush(this, x, z, 0.6 + rnd() * 0.6);
    }
    dog(this, 8, 68, 5);
    this.goalBall = ball(this, -10, 0, 102);

    // ---------- дорога 2 у школы ----------
    this.road(95, 6);
    this.zebra(0, 95, 6);
    this.label([0, 3.4, 89.5], '🚸 Переход у школы: посмотри налево и направо', { maxDist: 22, cls: 'goal' });
    for (let i = 0; i < 2; i++) this.addCar(1, 93.6, -40 + i * 45, ['#00b894', '#e17055'][i], 6, 95);
    for (let i = 0; i < 2; i++) this.addCar(-1, 96.4, 30 - i * 45, ['#6c5ce7', '#fab1a0'][i], 6, 95);
    npc(this, {
      x: 3.2, z: 89.5, yaw: Math.PI, name: 'Регулировщик дядя Петя', avatar: '👮',
      look: npcLook('#f39c12', '#2d3436', '#2d3436', { shape: 'tall', extra: 'stripes', acc: { hat: { model: 'cap', color: '#2d3436' } } }),
      lines: ['Здравствуй! Перед тем как перейти дорогу, посмотри налево, потом направо.', 'Я остановлю машины, когда ты подойдёшь к переходу. Шагай смело!'],
    });

    // ---------- школа ----------
    this.school();
    if (g.raid.happenedToday()) this.police();

    // ---------- окружение ----------
    [[-36, 20, '#74b9ff'], [-36, 50, '#ffeaa7'], [-36, 80, '#55efc4'], [36, 30, '#fab1a0'], [36, 60, '#a29bfe'], [36, 85, '#ffeaa7'], [-30, 125, '#fd79a8'], [32, 125, '#81ecec']].forEach(([x, z, c], i) => house(this, x, z, 10, 10, 6 + (i % 3) * 3, c, ['#d63031', '#6c5ce7', '#0984e3'][i % 3]));
    fence(this, -46, -20, -46, 150);
    fence(this, 46, -20, 46, 150);
    fence(this, -46, 150, 46, 150);
    this.world.addBox(-60, 60, 0, 10, -26, -24);
    this.clouds = [];
    for (let i = 0; i < 9; i++) this.clouds.push(cloud(this, -60 + i * 15, 22 + (i % 3) * 4, -10 + i * 18, 1.6 + (i % 2)));

    // ---------- навигация ----------
    this.arrows = [];
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [x1, z1] = ROUTE[i], [x2, z2] = ROUTE[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
      for (let d = 2.5; d < len - 1; d += 5) {
        const m = groundArrow(this, x1 + dx * d, 0, z1 + dz * d, dx, dz);
        m.userData.yaw = m.rotation.y;
        this.arrows.push(m);
      }
    }
    signpost(this, -2.4, 52.5, Math.PI, '⬅ Школа');
    signpost(this, 16.2, 56.5, -Math.PI / 2, 'Школа ➡');
    signpost(this, 16.4, 77, Math.PI, 'Школа ➡');
    signpost(this, -2.4, 85.5, Math.PI / 2, '⬅ Школа');
    signpost(this, 2.6, 8, Math.PI, '🏫 Школа ⬆');
    this.onUpdate((dt) => {
      const back = g.quests.current()?.id === 'go_home';
      const t = performance.now() / 1000;
      this.arrows.forEach((a, i) => {
        a.rotation.y = a.userData.yaw + (back ? Math.PI : 0);
        a.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 4 - i * 0.5));
      });
      this.clouds.forEach((c, i) => { c.position.x += dt * (0.6 + (i % 3) * 0.2); if (c.position.x > 70) c.position.x = -70; });
    });

    // ---------- бонусы ----------
    SIGNS.forEach((s, i) => this.readSign(s, i));
    knowledgeStar(this, 'star_park1', -12.5, 0, 67);
    knowledgeStar(this, 'star_park2', 25, 0, 82);
    knowledgeStar(this, 'star_yard', -16.5, 0, 19);
    knowledgeStar(this, 'star_schoolyard', 21, 0, 106);
    let ci = 0;
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [x1, z1] = ROUTE[i], [x2, z2] = ROUTE[i + 1];
      if (i === 1 || i === 7) continue; // не на дорогах
      const len = Math.hypot(x2 - x1, z2 - z1);
      for (let d = 4; d < len; d += 7) coin(this, `rc${ci++}`, x1 + (x2 - x1) * d / len + 0.8, 0, z1 + (z2 - z1) * d / len);
    }
    const fl = [[-2.3, 52], [2.3, 64], [12, 64.5], [16.3, 70], [10, 80.5], [-2.2, 86.5], [-7, 50], [-11, 60]];
    fl.forEach(([x, z], i) => waterFlower(this, `wf${i}`, x, 0, z, ['#ff6b81', '#feca57', '#a29bfe', '#ff9ff3'][i % 4]));

    this.spawn('start', 0, 0, 2.6, 0);
    this.spawn('fromHome', 0, 0, 2.6, 0);
    this.spawn('fromSchool', 0, 0, 108.4, Math.PI);

    this.onUpdate((dt) => this.updateTraffic(dt));
    this.onUpdate(() => this.updateCrossing());
    this.onUpdate((dt) => this.updateGoal(dt));
  }

  // ---------- строительные помощники ----------
  path([x1, z1], [x2, z2], w, color) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    this.geo(GEO.box, color, (x1 + x2) / 2, 0.02, (z1 + z2) / 2, { sx: w, sy: 0.05, sz: len + w, ry: ang, cast: false });
    for (let d = 0; d <= len; d += w * 0.6) this.mapRects.push({ x: x1 + (x2 - x1) * d / len, z: z1 + (z2 - z1) * d / len, w, d: w, color: '#f6e7c1', y: 0, y0: 0 });
  }

  nearRoute(x, z) {
    let best = Infinity;
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [x1, z1] = ROUTE[i], [x2, z2] = ROUTE[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - x1 - dx * t, z - z1 - dz * t));
    }
    return best;
  }

  road(zc, w) {
    this.box(0, 0, zc, 110, 0.04, w, '#4a4a58', { cast: false, map: '#555566' });
    this.box(0, 0, zc - w / 2 - 0.25, 110, 0.15, 0.5, '#dfe6e9', { cast: false });
    this.box(0, 0, zc + w / 2 + 0.25, 110, 0.15, 0.5, '#dfe6e9', { cast: false });
    for (let x = -54; x < 54; x += 4) if (Math.abs(x) > 4) this.box(x, 0.04, zc, 2, 0.01, 0.15, '#ffffff', { cast: false });
  }

  zebra(xc, zc, w) {
    for (let z = zc - w / 2 + 0.5; z < zc + w / 2; z += 1) this.box(xc, 0.045, z, 4, 0.01, 0.5, '#ffffff', { cast: false, map: '#ffffff' });
  }

  playground(x, z) {
    this.box(x, 0, z, 14, 0.03, 16, '#f8c291', { cast: false, map: '#f8c291' });
    // качели
    this.geo(GEO.box, '#e74c3c', x - 4, 1.4, z - 4, { sx: 0.15, sy: 2.8, sz: 0.15 });
    this.geo(GEO.box, '#e74c3c', x - 1, 1.4, z - 4, { sx: 0.15, sy: 2.8, sz: 0.15 });
    this.geo(GEO.box, '#e74c3c', x - 2.5, 2.8, z - 4, { sx: 3.2, sy: 0.15, sz: 0.15 });
    this.world.addBox(x - 4.2, x - 0.8, 0, 3, z - 4.2, z - 3.8, { camera: false });
    this.swing = new THREE.Group();
    this.swing.position.set(x - 2.5, 2.75, z - 4);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.4), mat('#3498db'));
    seat.position.y = -2.2;
    [-0.3, 0.3].forEach((dx) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.03), mat('#636e72'));
      r.position.set(dx, -1.1, 0);
      this.swing.add(r);
    });
    this.swing.add(seat);
    this.addObj(this.swing);
    let st = 0, amp = 0.15;
    this.onUpdate((dt) => { st += dt; amp = Math.max(0.15, amp * Math.exp(-0.15 * dt)); this.swing.rotation.x = Math.sin(st * 2.2) * amp; });
    this.interact({ pos: [x - 2.5, 1, z - 3], radius: 1.8, prompt: 'Раскачать качели 🎢', action: () => { amp = 0.9; this.game.audio.play('whoosh'); this.game.ui.toast('🎢 Уииии!'); } });
    // горка
    this.box(x + 3, 0, z + 2, 1.6, 2, 1.6, '#f1c40f', { collide: true });
    this.geo(GEO.box, '#e67e22', x + 3, 1, z + 4.2, { sx: 1.2, sy: 0.12, sz: 3.6, rx: -0.55 });
    // песочница
    this.box(x - 3, 0, z + 4, 4, 0.3, 4, '#b07d4f', { collide: false });
    this.box(x - 3, 0.25, z + 4, 3.6, 0.08, 3.6, '#ffeaa7', { cast: false });
    this.box(x - 3, 0, z + 2, 4, 0.3, 0.2, '#b07d4f', { collide: true });
    this.geo(GEO.cone, '#e84393', x - 2.2, 0.55, z + 4.5, { sx: 0.4, sy: 0.6, sz: 0.4 });
  }

  staticCar(x, z, color) {
    this.box(x, 0.3, z, 4, 0.8, 1.9, color, { collide: true, rotY: Math.PI / 2 });
    this.box(x, 0, z, 1.9, 0.3, 4, '#2d3436', { cast: false });
    this.geo(GEO.box, '#bfe9ff', x, 1.4, z, { sx: 1.7, sy: 0.6, sz: 2.2 });
  }

  makeCarMesh(color) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 1.9), mat(color));
    body.position.y = 0.75;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.7), mat('#dff6ff'));
    cab.position.set(-0.2, 1.45, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.75), mat(color));
    roof.position.set(-0.2, 1.8, 0);
    grp.add(body, cab, roof);
    const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    [[-1.3, 0.85], [1.3, 0.85], [-1.3, -0.85], [1.3, -0.85]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wg, mat('#2d3436'));
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.38, wz);
      grp.add(w);
    });
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 1.5), mat('#fffbd0', { emissive: '#bba' }));
    hl.position.set(2.0, 0.85, 0);
    grp.add(hl);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return grp;
  }

  addCar(dir, z, x, color, maxSpeed = 9, roadZ = 35) {
    const m = this.makeCarMesh(color);
    m.rotation.y = dir > 0 ? 0 : Math.PI;
    m.position.set(x, 0, z);
    this.addObj(m);
    const col = this.world.addBox(0, 0, 0, 2, 0, 0, { camera: false });
    this.cars.push({ m, dir, x, z, speed: maxSpeed, maxSpeed, col, roadZ, honk: 0 });
  }

  trafficLights() {
    this.lightPhase = 0;
    this.lightT = 0;
    this.bulbs = { car: [], ped: [] };
    const dim = (c) => mat(c, {});
    const pole = (x, z, rot) => {
      this.geo(GEO.cyl, '#2d3436', x, 1.8, z, { sx: 0.08, sy: 3.6, sz: 0.08 });
      this.world.addBox(x - 0.12, x + 0.12, 0, 3.6, z - 0.12, z + 0.12, { camera: false });
      // автомобильный светофор
      const car = new THREE.Group();
      car.position.set(x, 3.3, z);
      car.rotation.y = rot;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.3), mat('#2d3436'));
      car.add(box);
      const cb = ['#ff3b30', '#ffcc00', '#34c759'].map((c, i) => {
        const b = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), dim('#444'));
        b.position.set(0, 0.35 - i * 0.35, 0.16);
        b.userData.on = c;
        car.add(b);
        const b2 = b.clone();
        b2.position.z = -0.16;
        b2.rotation.y = Math.PI;
        b2.userData.on = c;
        car.add(b2);
        return [b, b2];
      });
      this.addObj(car);
      this.bulbs.car.push(cb);
      // пешеходный
      const ped = new THREE.Group();
      ped.position.set(x, 2.1, z);
      ped.rotation.y = rot + Math.PI / 2;
      ped.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 0.25), mat('#2d3436')));
      const pb = ['#ff3b30', '#34c759'].map((c, i) => {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.26), dim('#444'));
        b.position.set(0, 0.17 - i * 0.34, 0.13);
        b.userData.on = c;
        ped.add(b);
        const b2 = b.clone();
        b2.position.z = -0.13;
        b2.rotation.y = Math.PI;
        ped.add(b2);
        return [b, b2];
      });
      this.addObj(ped);
      this.bulbs.ped.push(pb);
    };
    pole(-2.8, 30.3, Math.PI / 2);
    pole(2.8, 39.7, -Math.PI / 2);
    this.setLights();
  }

  // фазы: 0 машины зелёный, 1 машины жёлтый, 2 пешеходы зелёный, 3 пешеходы мигает
  setLights() {
    const ph = this.lightPhase;
    const blink = ph === 3 && Math.floor(this.lightT * 4) % 2 === 0;
    const carOn = ph === 0 ? 2 : ph === 1 ? 1 : 0;
    const pedOn = ph === 2 || (ph === 3 && !blink) ? 1 : ph === 3 ? -1 : 0;
    for (const cb of this.bulbs.car) cb.forEach((pair, i) => pair.forEach((b) => (b.material = i === carOn ? mat(b.userData.on, { basic: true }) : mat('#444'))));
    for (const pb of this.bulbs.ped) pb.forEach((pair, i) => pair.forEach((b) => (b.material = i === pedOn ? mat(b.userData.on, { basic: true }) : mat('#444'))));
  }

  get pedGreen() { return this.lightPhase === 2 || this.lightPhase === 3; }

  updateTraffic(dt) {
    const dur = [7, 2, 7, 2.5];
    this.lightT += dt;
    if (this.lightT > dur[this.lightPhase]) {
      this.lightT = 0;
      this.lightPhase = (this.lightPhase + 1) % 4;
      if (this.lightPhase === 2 && this.game.player.pos.distanceTo(new THREE.Vector3(0, 0, 35)) < 15) this.game.ui.toast('🚦 Зелёный свет для пешеходов — можно идти!');
    }
    this.setLights();
    const p = this.game.player.pos;
    for (const c of this.cars) {
      let limit = Infinity;
      const nearCross = c.roadZ === 35;
      const stopLine = 3.3; // перед переходом (|x| = 2)
      const pos = -c.x * c.dir; // расстояние до центра перехода вдоль движения (>0 — переход впереди)
      const playerOnCross = Math.abs(p.x) < 3.5 && Math.abs(p.z - c.roadZ) < (nearCross ? 4.3 : 5.5);
      const mustStop = nearCross ? (this.lightPhase >= 1 && this.lightPhase <= 3) || playerOnCross : playerOnCross || (Math.abs(p.x) < 4 && Math.abs(p.z - c.roadZ) < 7);
      if (mustStop && pos - 2 > stopLine - 0.4 && pos - 2 < 22) limit = Math.max(0, pos - 2 - stopLine);
      // игрок на дороге прямо перед машиной
      const ahead = (p.x - c.x) * c.dir;
      if (Math.abs(p.z - c.z) < 1.8 && ahead > 0 && ahead < 9) {
        limit = Math.min(limit, ahead - 3.2);
        c.honk -= dt;
        if (c.honk <= 0) { this.game.audio.play('horn'); c.honk = 3; this.game.ui.toast('🚗 Би‑бип! Не стой на дороге!', 'warn'); }
      }
      // машина впереди
      for (const o of this.cars) {
        if (o === c || o.dir !== c.dir || o.roadZ !== c.roadZ) continue;
        const gap = (o.x - c.x) * c.dir;
        if (gap > 0 && gap < 14) limit = Math.min(limit, gap - 5.5);
      }
      const target = limit <= 0.05 ? 0 : Math.min(c.maxSpeed, Math.sqrt(2 * 7 * limit));
      c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), dt * (target < c.speed ? 14 : 4));
      c.x += c.speed * c.dir * dt;
      if (c.x * c.dir > 58) c.x = -58 * c.dir;
      c.m.position.x = c.x;
      Object.assign(c.col, { minX: c.x - 2, maxX: c.x + 2, minY: 0, maxY: 1.8, minZ: c.z - 0.95, maxZ: c.z + 0.95 });
    }
  }

  updateCrossing() {
    const g = this.game;
    const p = g.player.pos;
    const onRoad1 = p.z > 31 && p.z < 39;
    const onRoad2 = p.z > 92 && p.z < 98;
    const onCross = Math.abs(p.x) < 2.4;
    if (onRoad1 && onCross && !this.inCross) {
      this.inCross = true;
      this.crossOk = this.pedGreen;
      if (!this.pedGreen) {
        g.ui.toast('🛑 Стой! Для пешеходов красный свет. Подожди зелёного!', 'warn', 3500);
        g.audio.play('wrong');
      }
    }
    if (this.inCross && !(onRoad1 && onCross)) {
      if (this.crossOk && (p.z >= 39 || p.z <= 31)) {
        if (g.achievements.unlock('road')) g.ui.tip('Ты перешёл дорогу на <b>зелёный</b> свет — так и надо! 👍');
      }
      this.inCross = false;
    }
    this.jayT = (this.jayT || 0) - 1 / 60;
    if ((onRoad1 || onRoad2) && !onCross && this.jayT <= 0) {
      this.jayT = 5;
      g.ui.toast('⚠️ Переходи дорогу только по пешеходному переходу (зебре)!', 'warn', 3500);
    }
  }

  fountain(x, z) {
    const g = this.game;
    this.geo(GEO.cyl12, '#b2bec3', x, 0.3, z, { sx: 3.2, sy: 0.6, sz: 3.2 });
    this.geo(GEO.cyl12, '#74b9ff', x, 0.62, z, { sx: 2.9, sy: 0.05, sz: 2.9, emissive: '#1d5e9a', cast: false });
    this.geo(GEO.cyl, '#dfe6e9', x, 1.2, z, { sx: 0.35, sy: 1.6, sz: 0.35 });
    this.geo(GEO.cyl12, '#b2bec3', x, 2.0, z, { sx: 1.1, sy: 0.2, sz: 1.1 });
    this.world.addBox(x - 3, x + 3, 0, 0.9, z - 3, z + 3, { camera: false });
    this.mapRects.push({ x, z, w: 6.4, d: 6.4, color: '#74b9ff', round: true, y0: 0 });
    const drops = [];
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat('#c7ecff', { basic: true }));
      d.userData.ph = i / 14;
      this.addObj(d);
      drops.push(d);
    }
    this.onUpdate((dt) => {
      const t = performance.now() / 1000;
      drops.forEach((d, i) => {
        const ph = (t * 0.7 + d.userData.ph) % 1;
        const a = (i / drops.length) * Math.PI * 2;
        const r = ph * 1.8;
        d.position.set(x + Math.cos(a) * r, 2.2 + ph * 1.6 - ph * ph * 3.2, z + Math.sin(a) * r);
      });
    });
    this.interact({
      pos: [x, 1, z - 3.4], radius: 2.2, prompt: 'Бросить монетку и загадать желание 🪙',
      action: () => {
        if (!g.save.spend(1)) { g.ui.toast('Нет монет 😅'); return; }
        g.audio.play('water');
        const lucky = Math.random() < 0.3;
        setTimeout(() => {
          if (lucky) { g.audio.play('star'); g.save.addCoins(5, 'wish'); g.ui.toast('✨ Желание сбылось! Фонтан подарил тебе 5 монет!', 'achv'); }
          else g.ui.toast('🌊 Плюх! Желание загадано... может, сбудется завтра?');
        }, 600);
      },
    });
  }

  readSign(s, i) {
    const g = this.game;
    this.geo(GEO.cyl, '#6d4c41', s.x, 0.6, s.z, { sx: 0.07, sy: 1.2, sz: 0.07 });
    this.geo(GEO.box, '#fdf2d0', s.x, 1.35, s.z, { sx: 0.9, sy: 0.6, sz: 0.08 });
    const icon = textPlane('📜', 0.5, 0.5, { bg: null });
    icon.position.set(s.x, 1.35, s.z - 0.05);
    icon.rotation.y = Math.PI;
    this.addObj(icon);
    const key = `${this.name}:sign${i}`;
    this.interact({
      pos: [s.x, 1, s.z], radius: 1.8, prompt: 'Прочитать табличку 📜',
      action: () => {
        g.ui.dialog.show([{ name: s.title, avatar: '📜', text: s.text }]);
        const prog = g.save.progress;
        if (!prog.picked[key]) {
          prog.picked[key] = true;
          g.save.addCoins(CONFIG.rewards.readSign, 'sign');
          g.save.stat('signs');
        }
      },
    });
  }

  school() {
    const g = this.game;
    house(this, 0, 126, 44, 28, 34, '#ffd59e', '#e17055'); // 11 этажей
    this.box(0, 0, 111.8, 4, 3, 0.4, '#74b9ff', { emissive: '#1d4e7a' });
    this.box(0, 3.2, 110.8, 6, 0.2, 2.6, '#e17055');
    [-2.8, 2.8].forEach((x) => this.geo(GEO.cyl, '#ffffff', x, 1.6, 109.8, { sx: 0.15, sy: 3.2, sz: 0.15 }));
    this.box(0, 0, 110.5, 6, 0.12, 2.6, '#dfe6e9', { cast: false });
    signText(this, ['ШКОЛА №1 · 11 этажей', 'READ & PRACTICE'], 0, 9.5, 111.85, 10, 2.4, Math.PI, { bg: '#ffffff', fg: '#6c5ce7', sub: '#e17055' });
    // флагшток
    this.geo(GEO.cyl, '#dfe6e9', -8, 4, 108, { sx: 0.1, sy: 8, sz: 0.1 });
    this.flag = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 0.05), mat('#6c5ce7'));
    this.flag.position.set(-7, 7.3, 108);
    this.addObj(this.flag);
    this.onUpdate(() => { this.flag.rotation.y = Math.sin(performance.now() / 300) * 0.25; });
    // футбольные ворота
    this.box(-15, 0, 100.6, 0.15, 2, 0.15, '#ffffff', { collide: true });
    this.box(-11, 0, 100.6, 0.15, 2, 0.15, '#ffffff', { collide: true });
    this.box(-13, 2, 100.6, 4.15, 0.15, 0.15, '#ffffff');
    this.box(-13, 0, 99.6, 4, 2, 0.05, '#dfe6e9', { collide: true });
    this.box(-15, 0, 100.1, 0.05, 2, 1, '#dfe6e9', { collide: true });
    this.box(-11, 0, 100.1, 0.05, 2, 1, '#dfe6e9', { collide: true });
    this.label([-13, 2.8, 101], '⚽ Ворота: забей гол!', { maxDist: 16 });
    this.point('schoolDoor', 0, 0, 110);
    this.label([0, 5.2, 110.5], '🏫 Школа: тебе сюда!', { maxDist: 60, cls: 'goal', visible: () => g.quests.current()?.id === 'go_school' });
    this.interact({
      pos: [0, 1, 110.3], radius: 2, prompt: 'Войти в школу 🏫',
      action: () => {
        const prog = g.save.progress;
        if (g.quests.current()?.id === 'go_school') {
          if (prog.clock < CONFIG.clock.earlyBird) {
            g.achievements.unlock('early');
            g.save.addCoins(10, 'early');
            g.ui.toast('🐦 Ты пришёл рано! +10 🪙');
          }
          g.quests.complete('go_school', true);
        }
        g.audio.play('door');
        g.save.progress.schoolFloor = 1;
        g.goTo('school', 'entrance', '🏫 Школа · 1 этаж');
      },
    });
  }

  // Полиция у школы во время (и после) захвата
  police() {
    const g = this.game;
    const bars = [];
    [[-7, 103.5, 0.4], [7, 103.8, -0.3], [12, 100.5, 1.2]].forEach(([x, z, rot], i) => {
      const car = this.makeCarMesh('#f5f6fa');
      car.position.set(x, 0, z);
      car.rotation.y = rot;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.22, 1.92), mat('#0c2461'));
      stripe.position.y = 0.75;
      car.add(stripe);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.5), mat('#ff3b30'));
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.5), mat('#3fa7ff'));
      red.position.set(-0.2, 1.92, -0.4);
      blue.position.set(-0.2, 1.92, 0.4);
      car.add(red, blue);
      const txt = signText(this, 'ПОЛИЦИЯ', 0, 0, 0, 2.2, 0.4, 0, { bg: null, fg: '#0c2461', res: 0.4 });
      txt.removeFromParent();
      txt.position.set(0, 0.95, 0.97);
      car.add(txt);
      this.addObj(car);
      this.world.addBox(x - 2.2, x + 2.2, 0, 1.8, z - 2.2, z + 2.2, { camera: false });
      bars.push({ red, blue, ph: i * 0.37 });
    });
    this.onUpdate(() => {
      const t = performance.now() / 1000;
      bars.forEach((b) => {
        const on = Math.floor((t + b.ph) * 4) % 2 === 0;
        b.red.material = mat(on ? '#ff3b30' : '#5a1010', { emissive: on ? '#ff0000' : '#000000' });
        b.blue.material = mat(on ? '#1a2a5a' : '#3fa7ff', { emissive: on ? '#000000' : '#0055ff' });
      });
    });
    const active = g.raid.active();
    npc(this, {
      x: -3.5, z: 105.5, yaw: Math.PI, name: 'Полицейский Иванов', avatar: '👮',
      look: npcLook('#0c2461', '#0c2461', '#2d3436', { shape: 'tall', acc: { hat: { model: 'cap', color: '#0c2461' } } }),
      lines: () => (g.raid.active() ? ['Школа оцеплена! Внутри грабители. Майор Орлов ждёт тебя — снаряжение в ящиках у лифта на каждом этаже.'] : ['Всё под контролем! Спасибо за помощь, юный герой!']),
    });
    npc(this, {
      x: 4, z: 106, yaw: Math.PI, name: 'Полицейский Петрова', avatar: '👮‍♀️',
      look: npcLook('#0c2461', '#0c2461', '#6d4c41', { shape: 'tall', acc: { hat: { model: 'cap', color: '#0c2461' } } }),
      lines: ['Не подходи к окнам школы и слушай указания полиции.'],
    });
    this.label([0, 3.2, 104], active ? '🚨 Школа оцеплена полицией' : '👮 Полиция', { maxDist: 40, cls: 'goal' });
    // лента ограждения
    for (let x = -10; x <= 10; x += 2) this.box(x, 0.9, 107.5, 2, 0.08, 0.04, x % 4 === 0 ? '#f9ca24' : '#2d3436', { cast: false });
  }

  updateGoal() {
    const b = this.goalBall;
    if (!b) return;
    const p = b.position;
    if (p.x > -14.8 && p.x < -11.2 && p.z < 100.5 && p.z > 99.6 && !this.scored) {
      this.scored = true;
      const g = this.game;
      g.audio.play('levelup');
      g.ui.bigMessage('⚽ ГОООЛ!<small>+3 монеты</small>');
      g.save.addCoins(3, 'goal');
      g.fx.burst(p.clone(), '#ffffff', 25);
      setTimeout(() => { p.copy(b.userData.home); b.userData.vel.set(0, 0, 0); this.scored = false; }, 1500);
    }
  }

  enter() {
    const g = this.game;
    if (g.quests.current()?.id === 'go_school') {
      g.ui.tip('Ура, улица! Иди по <b>жёлтым стрелкам</b> на земле. Сверху — расстояние до школы, справа — мини‑карта.', 'tip_street');
    } else if (g.quests.current()?.id === 'go_home') {
      g.ui.tip('Уроки окончены! Возвращайся <b>домой</b> по стрелкам — они теперь показывают обратную дорогу.', 'tip_gohome');
    }
  }
}
