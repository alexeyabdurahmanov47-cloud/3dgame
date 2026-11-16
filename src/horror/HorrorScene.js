import * as THREE from 'three';
import { BaseScene } from '../scenes/BaseScene.js';
import { GEO, signText } from '../scenes/props.js';
import { mat, seeded, textPlane } from '../core/gfx.js';
import { bloodTextures, bloodText, DecalBatch, brokenGlass } from './decals.js';

// Заброшенная школа ночью.
// Главный коридор (z ∈ [−2, 2]) — 8 кабинетов на север и 8 на юг; за южными — служебный коридор.
// Запад: лестница-выход и спортзал (лабиринт). Восток: актовый зал Директора и секретная комната.
const H = 3.2;
const WALL = '#3b3a35', WALL2 = '#2f302c', FLOOR = '#2b2723', CEIL = '#1d1c1a';
export const ROOMS = [
  // север
  { id: 'n1', name: 'Кабинет 1', type: 'class' }, { id: 'n2', name: 'Библиотека', type: 'library' },
  { id: 'n3', name: 'Кабинет химии', type: 'chem' }, { id: 'n4', name: 'Кабинет 4', type: 'class' },
  { id: 'n5', name: 'Архив', type: 'archive' }, { id: 'n6', name: 'Электрощитовая', type: 'electric' },
  { id: 'n7', name: 'Музыкальный класс', type: 'music' }, { id: 'n8', name: 'Кабинет 8', type: 'class' },
  // юг
  { id: 's1', name: 'Столовая', type: 'cafe' }, { id: 's2', name: 'Класс-ловушка', type: 'trap' },
  { id: 's3', name: 'Зеркальная', type: 'mirror' }, { id: 's4', name: 'Учительская', type: 'staff' },
  { id: 's5', name: 'Медпункт', type: 'med' }, { id: 's6', name: 'Кабинет 14', type: 'class' },
  { id: 's7', name: 'Котельная', type: 'boiler' }, { id: 's8', name: 'Кабинет 16', type: 'class' },
];
ROOMS.forEach((r, k) => {
  const i = k % 8;
  r.side = k < 8 ? 1 : -1;
  r.i = i;
  r.x0 = -44 + i * 11;
  r.xc = r.x0 + 5.5;
  r.z0 = r.side > 0 ? 2 : -12;
  r.z1 = r.side > 0 ? 12 : -2;
  r.zc = (r.z0 + r.z1) / 2;
  r.doorX = r.xc + 3;
  r.doorZ = r.side > 0 ? 2 : -2;
  r.backX = r.xc - 3;
});
export const roomById = (id) => ROOMS.find((r) => r.id === id);

const WRITINGS = ['НЕ БЕГИ', 'ОН СЛЫШИТ', 'ВЫХОДА НЕТ', 'УРОК НЕ ОКОНЧЕН', 'ТИШЕ', 'ОБЕРНИСЬ', '2 + 2 = 5', 'ОНА ВЕРНУЛАСЬ', 'НЕ СМОТРИ НА НЕЁ', 'ТЫ СЛЕДУЮЩИЙ', 'ПОМОГИТЕ', 'ДОМАШНЕЕ ЗАДАНИЕ: ВЫЖИТЬ'];

export class HorrorScene extends BaseScene {
  constructor(game) {
    super(game, 'horror');
    this.title = 'Заброшенная школа';
    this.indoor = true;
    this.cameraDist = 3.4;
    this.mapZoom = 2.2;
    this.noSave = true;
    this.mapBg = '#0d0b0a';
    this.doors = [];
    this.lamps = [];
    this.lockers = [];
    this.stations = {};
    this.itemSpots = {};
    this.zones = []; // зоны со стеклом / нитями (класс-ловушка)
    this.wires = [];
    this.barricades = [];
    this.nav = { nodes: new Map(), edges: new Map() };
    this.dyn = new THREE.Group();
  }

  get mode() { return this.game.horror; }

  build() {
    const g = this.game;
    const M = this.mode;
    const mission = M.mission;
    const diff = M.diff;
    const rnd = seeded(M.seed);
    this.rnd = rnd;
    const gore = g.save.data.horror.gore !== 'low';
    this.scene.add(this.dyn);

    // ---------- свет и атмосфера ----------
    this.scene.background = new THREE.Color('#020203');
    this.scene.fog = new THREE.FogExp2('#030304', 0.05 + M.diffIndex * 0.007);
    this.scene.add(new THREE.HemisphereLight('#3a4258', '#0b0806', 0.22));
    const moon = new THREE.DirectionalLight('#6b80a8', 0.35);
    moon.position.set(10, 20, 40);
    this.scene.add(moon);
    // фонарик
    const fl = new THREE.SpotLight('#fff1d6', 55, 24, 0.44, 0.55, 1.5);
    fl.castShadow = g.quality === 'high';
    fl.shadow.mapSize.set(512, 512);
    fl.shadow.bias = -0.0008;
    fl.shadow.camera.near = 0.3;
    this.scene.add(fl, fl.target);
    this.flashlight = fl;
    // пул точечных светильников — назначаются ближайшим лампам
    this.pool = [];
    const poolN = g.quality === 'high' ? 5 : 3;
    for (let i = 0; i < poolN; i++) {
      const p = new THREE.PointLight('#ffe2b0', 0, 10, 1.8);
      this.scene.add(p);
      this.pool.push(p);
    }
    this.emergency = [];

    // ---------- пол, потолок, коридоры ----------
    this.box(0, -0.2, 0, 88, 0.2, 4, FLOOR, { walk: true, map: '#3a3632', cast: false });
    this.box(0, -0.2, -13.5, 88, 0.2, 3, FLOOR, { walk: true, map: '#34302c', cast: false });
    for (const r of ROOMS) this.box(r.xc, -0.2, r.zc, 11, 0.2, 10, r.type === 'cafe' ? '#2a2c2a' : FLOOR, { walk: true, map: r.side > 0 ? '#2c2a27' : '#2a2826', cast: false });
    this.box(0, H, -1.5, 88, 0.15, 28, CEIL, { cast: false });
    // плитка коридора (тёмные полосы)
    for (let x = -43; x < 44; x += 2) this.box(x, 0.003, 0, 0.05, 0.004, 4, '#1e1b18', { cast: false });

    // стены главного коридора с дверными проёмами
    const nGaps = ROOMS.filter((r) => r.side > 0).map((r) => [r.doorX - 0.75, r.doorX + 0.75]);
    const sGaps = ROOMS.filter((r) => r.side < 0).map((r) => [r.doorX - 0.75, r.doorX + 0.75]);
    this.wallX(2, -44, 44, 0, H, WALL, nGaps, { gapH: 2.4 });
    this.wallX(-2, -44, 44, 0, H, WALL, sGaps, { gapH: 2.4 });
    // задние стены
    this.wallX(12, -44, 44, 0, H, WALL2);
    this.wallX(-12, -44, 44, 0, H, WALL2, ROOMS.filter((r) => r.side < 0).map((r) => [r.backX - 0.75, r.backX + 0.75]), { gapH: 2.4 });
    this.wallX(-15, -44, 44, 0, H, WALL2);
    // перегородки между кабинетами
    for (let i = 1; i < 8; i++) {
      const x = -44 + i * 11;
      this.wallZ(x, 2, 12, 0, H, WALL2);
      this.wallZ(x, -12, -2, 0, H, WALL2);
    }
    // западный торец: выход на лестницу и проход в спортзал
    this.wallZ(-44, 2, 12, 0, H, WALL2);
    this.wallZ(-44, -12, -2, 0, H, WALL2);
    this.wallZ(-44, -2, 2, 0, H, WALL, [[-1, 1]], { gapH: 2.4 });
    this.wallZ(-44, -15, -12, 0, H, WALL2, [[-14.4, -12.6]], { gapH: 2.4 });
    // восточный торец: двери актового зала и (секретная) стена служебного коридора
    this.wallZ(44, 2, 12, 0, H, WALL2);
    this.wallZ(44, -12, -2, 0, H, WALL2);
    this.wallZ(44, -2, 2, 0, H, WALL, [[-1.3, 1.3]], { gapH: 2.6 });
    if (mission.secret) {
      this.wallZ(44, -15, -12, 0, H, WALL2, [[-14.6, -12.4]], { gapH: 2.4 });
    } else this.wallZ(44, -15, -12, 0, H, WALL2);

    // ---------- лестница (выход) ----------
    this.box(-47, -0.2, 1, 6, 0.2, 6, FLOOR, { walk: true, map: '#2e3a2e', cast: false });
    this.box(-47, H, 1, 6, 0.15, 6, CEIL, { cast: false });
    this.wallX(4, -50, -44, 0, H, WALL2);
    this.wallX(-2, -50, -44, 0, H, WALL2);
    this.wallZ(-50, -2, 4, 0, H, WALL2);
    for (let i = 0; i < 6; i++) this.box(-49.3 + i * 0.01, i * 0.18, 2.7 - i * 0.35, 1.2, 0.18, 0.35, '#3a3632', { cast: false });
    this.point('exit', -47, 0, 1);
    const exitSign = signText(this, 'ВЫХОД', -44.15, 2.75, 0, 1.2, 0.35, -Math.PI / 2, { bg: '#0a6b2f', fg: '#d8ffe0', res: 0.4 });
    exitSign.material = new THREE.MeshBasicMaterial({ map: exitSign.material.map, transparent: true });
    this.emergencyLight(-45, 2.6, 0, '#2aff6a', 0.7);

    // ---------- кабинеты ----------
    const decals = new DecalBatch();
    this.decals = decals;
    const T = bloodTextures();
    for (const r of ROOMS) this.buildRoom(r, rnd, decals, T, gore);

    // ---------- двери ----------
    for (const r of ROOMS) {
      this.makeDoor(`d_${r.id}`, r.doorX, r.doorZ, 'x', r);
      if (r.side < 0) this.makeDoor(`b_${r.id}`, r.backX, -12, 'x', r, { back: true });
    }
    this.gymDoor = this.makeDoor('gym', -44, -13.5, 'z', null, { locked: !mission.maze, name: 'Спортзал' });
    this.finalDoor = this.makeDoor('final', 44, 0, 'z', null, { locked: !mission.boss, wide: true, name: 'Актовый зал' });
    this.exitDoor = this.makeDoor('exit', -44, 0, 'z', null, { locked: false, name: 'Выход' });

    // ---------- шкафчики-укрытия ----------
    const spots = [];
    for (const r of ROOMS) {
      spots.push({ x: r.xc - 2, z: r.side * 1.72, face: -r.side });
      spots.push({ x: r.xc + 0.2, z: r.side * 1.72, face: -r.side });
    }
    for (let x = -40; x <= 40; x += 13) spots.push({ x, z: -14.72, face: 1 });
    const count = Math.max(3, Math.round(spots.length * diff.lockers * 0.6));
    const chosen = spots.map((s) => [rnd(), s]).sort((a, b) => a[0] - b[0]).slice(0, count).map((p) => p[1]);
    chosen.forEach((s) => this.makeLocker(s.x, s.z, s.face));

    // ---------- лампы ----------
    for (let x = -40; x <= 40; x += 8) this.makeLamp(x, 0, rnd);
    for (let x = -38; x <= 38; x += 12) this.makeLamp(x, -13.5, rnd);
    for (const r of ROOMS) this.makeLamp(r.xc, r.zc, rnd);
    this.makeLamp(-47, 1, rnd, true);
    // аварийное красное освещение
    this.emergencyLight(-43.6, 2.7, -13.5, '#ff1010', 1.2);
    this.emergencyLight(0, 3.0, 1.85, '#ff1010', 1.0);
    this.emergencyLight(43.6, 2.7, 0, '#ff1010', 1.2);
    this.emergencyLight(20, 3.0, -14.8, '#ff1010', 0.9);

    // ---------- кровь и надписи в коридорах ----------
    for (let i = 0; i < (gore ? 26 : 10); i++) {
      const x = -42 + rnd() * 84, z = -1.6 + rnd() * 3.2;
      decals.add(T.splat[i % 3], x, 0.012 + i * 0.0003, z, { w: 0.6 + rnd() * 1.4, h: 0.6 + rnd() * 1.4, rot: rnd() * 6 });
    }
    if (gore) {
      // отпечатки рук у дверей
      for (const r of ROOMS) if (rnd() < 0.55) decals.add(T.hand, r.doorX + (rnd() < 0.5 ? -1.1 : 1.1), 1.1 + rnd() * 0.6, r.doorZ - r.side * 0.12, { face: r.side > 0 ? '-z' : '+z', w: 0.32, h: 0.32, rot: rnd() - 0.5 });
      // волочение по коридору
      for (let k = 0; k < 6; k++) { const x = -38 + k * 14 + rnd() * 4; decals.add(T.drag, x, 0.014, -0.4 + rnd() * 0.8, { w: 3 + rnd() * 2, h: 0.6, rot: (rnd() - 0.5) * 0.4 }); }
      // подтёки на стенах
      for (let k = 0; k < 10; k++) { const x = -42 + rnd() * 84; const n = rnd() < 0.5; decals.add(T.drip, x, 1.6 + rnd() * 0.8, n ? 1.88 : -1.88, { face: n ? '-z' : '+z', w: 0.9, h: 0.9 }); }
    }
    const wcount = gore ? 7 : 3;
    for (let k = 0; k < wcount; k++) {
      const t = WRITINGS[Math.floor(rnd() * WRITINGS.length)];
      const m = bloodText(t, 3.2, 0.9);
      const n = k % 2 === 0;
      m.position.set(-38 + k * 12 + rnd() * 3, 1.7 + rnd() * 0.4, n ? 1.88 : -1.88);
      m.rotation.y = n ? Math.PI : 0;
      this.addObj(m);
    }
    // баррикады (перестройка школы)
    if (diff.shuffle || mission.id === 'night') {
      for (const bx of [-24 + 5.5, 3.5 + 5.5, 25.5 + 5.5]) this.barricades.push(this.makeBarricade(bx));
      this.setBarricade(Math.floor(rnd() * this.barricades.length));
    }

    // ---------- особые зоны ----------
    this.buildGym(mission, rnd, decals, T);
    this.buildFinal(mission, rnd, decals, T);
    if (mission.secret) this.buildSecret(rnd, decals, T);
    decals.bake(this.scene);

    this.buildNav();
    this.spawn('start', 0, 0, 0, -Math.PI / 2);
    this.mapRects.push({ x: 0, z: 0, w: 88, d: 4, color: '#4a4540' }, { x: 0, z: -13.5, w: 88, d: 3, color: '#403b36' }, { x: -47, z: 1, w: 6, d: 6, color: '#2f6b3f' });
    for (const r of ROOMS) this.mapRects.push({ x: r.xc, z: r.zc, w: 10.6, d: 9.6, color: '#36322e' });
  }

  // -------------------------------------------------------------- комнаты
  buildRoom(r, rnd, decals, T, gore) {
    const { xc, zc, side } = r;
    const s = side;
    // доска/станция у дальней стены
    const wallZ = s > 0 ? 11.85 : -11.85;
    const st = { x: s > 0 ? xc - 1 : xc + 1.5, z: s > 0 ? 10.6 : -10.6, yaw: s > 0 ? 0 : Math.PI, room: r.id };
    this.stations[r.id] = st;
    const boardX = st.x;
    const face = s > 0 ? Math.PI : 0;
    const spotsAt = (pts) => (this.itemSpots[r.id] = pts.map(([dx, dz]) => ({ x: xc + dx, z: zc + dz * s })));
    // окна на севере (разбитые) — только у северных кабинетов
    if (s > 0) {
      const gm = new THREE.MeshStandardMaterial({ map: brokenGlass(), transparent: true, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
      gm.userData.own = true;
      for (const dx of [-3.2, 3.2]) {
        this.box(xc + dx, 1.0, 11.95, 2.2, 0.1, 0.3, '#2a2622');
        this.box(xc + dx, 2.5, 11.95, 2.2, 0.1, 0.3, '#2a2622');
        const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.4), gm);
        p.position.set(xc + dx, 1.8, 11.9);
        p.rotation.y = Math.PI;
        this.addObj(p);
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), new THREE.MeshBasicMaterial({ color: '#0c1526', fog: false }));
        sky.material.userData.own = true;
        sky.position.set(xc + dx, 1.8, 12.08);
        sky.rotation.y = Math.PI;
        this.addObj(sky);
        if (rnd() < 0.6) for (let k = 0; k < 5; k++) this.geo(GEO.box, '#8a9aa8', xc + dx + (rnd() - 0.5) * 2, 0.02, 11.2 - rnd() * 1.4, { sx: 0.12 + rnd() * 0.2, sy: 0.01, sz: 0.06 + rnd() * 0.1, ry: rnd() * 3, cast: false });
      }
    }
    const tipped = (x, z) => {
      this.geo(GEO.box, '#3a2e22', x, 0.4, z, { sx: 1.3, sy: 0.06, sz: 0.6, rx: 1.2 + rnd() * 0.3, ry: rnd() * 3 });
      this.geo(GEO.box, '#3a3d40', x + 0.3, 0.2, z + 0.2, { sx: 0.06, sy: 0.7, sz: 0.5, rz: 1.3, ry: rnd() * 3 });
    };
    const board = (text) => {
      this.box(boardX, 0.9, wallZ, 3.2, 1.4, 0.08, '#1d2a22');
      this.box(boardX, 0.85, wallZ - s * 0.08, 3.3, 0.06, 0.15, '#3a2e22');
      const m = bloodText(text, 2.8, 1);
      m.position.set(boardX, 1.6, wallZ - s * 0.06);
      m.rotation.y = face;
      this.addObj(m);
    };
    const T2 = bloodTextures();
    switch (r.type) {
      case 'class':
      case 'trap': {
        board(r.type === 'trap' ? 'ТИШЕ…' : WRITINGS[Math.floor(rnd() * WRITINGS.length)]);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
          const x = xc - 3.2 + col * 3.2, z = zc - s * 2.2 + s * row * 2.1;
          if (r.type === 'trap') continue;
          if (rnd() < 0.3) tipped(x, z);
          else {
            this.prop('desk', x, 0, z, { ry: s > 0 ? 0 : Math.PI, colors: { Top: '#3d3024', Steel: '#2c2e30' } });
            if (rnd() < 0.7) this.prop('chair', x + (rnd() - 0.5) * 0.4, 0, z - s * 0.55, { ry: (s > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.8, colors: { Seat: '#2a3540', Steel: '#2c2e30' } });
            this.world.addBox(x - 0.65, x + 0.65, 0, 0.78, z - 0.3, z + 0.3, { camera: false });
          }
        }
        if (r.type === 'trap') {
          // битое стекло по всему полу и нити с колокольчиками
          for (let k = 0; k < 140; k++) this.geo(GEO.box, '#9fb2c0', xc - 5 + rnd() * 10, 0.015, zc - 4.4 + rnd() * 8.8, { sx: 0.06 + rnd() * 0.16, sy: 0.012, sz: 0.04 + rnd() * 0.1, ry: rnd() * 3, cast: false, emissive: '#1a2228' });
          this.zones.push({ kind: 'glass', minX: r.x0 + 0.3, maxX: r.x0 + 10.7, minZ: -11.7, maxZ: -2.3, room: r.id });
          for (const wz of [-4.6, -7, -9.4]) {
            this.wires.push({ z: wz, minX: r.x0 + 0.2, maxX: r.x0 + 10.8 });
            this.box(xc, 0.22, wz, 10.6, 0.012, 0.012, '#b02020', { cast: false, emissive: '#400000' });
            for (let k = 0; k < 5; k++) this.geo(GEO.sphere, '#b8952a', r.x0 + 1 + k * 2.2, 0.17, wz, { sx: 0.05, sy: 0.06, sz: 0.05, emissive: '#3a2a00' });
          }
        }
        spotsAt([[-4, 4], [4.2, 4.2], [-4.2, -1], [4, -3.5]]);
        break;
      }
      case 'library': {
        for (let k = 0; k < 4; k++) {
          const x = xc - 4 + k * 2.6;
          this.box(x, 0, zc + s * 0.5, 0.5, 2.4, 6, '#2e241b', { collide: true });
          for (let sh = 0; sh < 4; sh++) for (let b = 0; b < 10; b++) if (rnd() < 0.75) this.box(x + (rnd() < 0.5 ? -0.12 : 0.12), 0.25 + sh * 0.55, zc + s * 0.5 - 2.7 + b * 0.6, 0.18, 0.3 + rnd() * 0.15, 0.1, ['#4a1f1f', '#1f2f4a', '#2f3f22', '#4a3a1f'][Math.floor(rnd() * 4)], { cast: false });
        }
        for (let k = 0; k < 18; k++) this.geo(GEO.box, '#3a2a20', xc + (rnd() - 0.5) * 9, 0.03, zc + (rnd() - 0.5) * 8, { sx: 0.3, sy: 0.05, sz: 0.22, ry: rnd() * 3, cast: false });
        board('ТИШИНА В ЧИТАЛЬНОМ ЗАЛЕ');
        spotsAt([[-4.6, 3.8], [4.6, -3.8], [-1.3, -3.6], [3.9, 3.8]]);
        break;
      }
      case 'chem': {
        board('H₂O + КРОВЬ');
        for (const dz of [-2.2, 0.6]) {
          this.box(xc, 0, zc + s * dz, 7, 0.9, 1.1, '#2b2f2f', { collide: true });
          for (let k = 0; k < 6; k++) this.geo(GEO.cyl, ['#3fa36b', '#a33f3f', '#3f6ba3', '#c9c9a0'][k % 4], xc - 3 + k * 1.2, 1.05, zc + s * dz, { sx: 0.08, sy: 0.3, sz: 0.08, emissive: k % 2 ? '#0a2a1a' : '#2a0a0a' });
        }
        spotsAt([[-4.5, 4], [4.5, 3.6], [-4.5, -3.8], [4.4, -2.6]]);
        break;
      }
      case 'archive': {
        for (let k = 0; k < 5; k++) this.box(xc - 4.5 + k * 2, 0, zc + s * 3.4, 1.2, 2, 0.7, '#3a3d3a', { collide: true });
        for (let k = 0; k < 30; k++) this.geo(GEO.box, '#bdb39a', xc + (rnd() - 0.5) * 9, 0.01 + k * 0.0004, zc + (rnd() - 0.5) * 8, { sx: 0.3, sy: 0.003, sz: 0.4, ry: rnd() * 3, cast: false });
        this.box(xc + 3.5, 0, zc - s * 0.5, 1, 1.2, 0.9, '#2b2d30', { collide: true }); // сейф
        this.stations[r.id] = { x: xc + 3.5, z: zc - s * 1.6, yaw: s > 0 ? Math.PI : 0, room: r.id };
        spotsAt([[-4.6, -3.5], [-1, 0.5], [4.6, 2], [1, -3.8]]);
        break;
      }
      case 'electric': {
        for (let k = 0; k < 4; k++) {
          this.box(xc - 3.5 + k * 2.2, 0, wallZ - s * 0.35, 1.6, 2.2, 0.5, '#3c4044', { collide: true });
          for (let l = 0; l < 6; l++) this.geo(GEO.box, l % 3 ? '#1a5a1a' : '#5a1a1a', xc - 4 + k * 2.2 + l * 0.2, 1.6, wallZ - s * 0.62, { sx: 0.08, sy: 0.08, sz: 0.04, emissive: l % 3 ? '#0a3a0a' : '#4a0000' });
        }
        this.stations[r.id] = { x: xc - 1.3, z: wallZ - s * 1.5, yaw: s > 0 ? 0 : Math.PI, room: r.id };
        for (let k = 0; k < 6; k++) this.geo(GEO.cyl, '#151515', xc - 4 + k * 1.6, 2.9, zc, { sx: 0.05, sy: 10, sz: 0.05, rx: Math.PI / 2 });
        spotsAt([[-4.5, -3.8], [4.5, -3.8], [0, -1], [4.6, 1.5]]);
        break;
      }
      case 'music': {
        this.box(xc + 3, 0, zc + s * 3, 2.2, 1.1, 1.1, '#120f0d', { collide: true }); // пианино
        this.box(xc + 3, 0.95, zc + s * 2.4, 2, 0.06, 0.25, '#d8d0c0');
        for (let k = 0; k < 12; k++) this.prop('chair', xc - 4 + (k % 4) * 1.6, 0, zc - s * 2 + Math.floor(k / 4) * 1.5 * s, { ry: rnd() * 6, colors: { Seat: '#3a2a2a' } });
        this.stations[r.id] = { x: xc + 3, z: zc + s * 1.6, yaw: s > 0 ? 0 : Math.PI, room: r.id };
        spotsAt([[-4.6, 4.2], [4.6, -4], [-4.5, -4], [0.5, 4.2]]);
        break;
      }
      case 'cafe': {
        for (let k = 0; k < 3; k++) {
          this.box(xc, 0, zc - s * 2.5 + s * k * 2.6, 8, 0.75, 1.1, '#3a3530', { collide: true });
          for (let t = 0; t < 6; t++) if (rnd() < 0.5) this.geo(GEO.box, '#6a6a6a', xc - 3.5 + t * 1.4, 0.78, zc - s * 2.5 + s * k * 2.6, { sx: 0.4, sy: 0.02, sz: 0.3, ry: rnd() });
        }
        this.box(xc + 4.3, 0, wallZ - s * 0.6, 1.6, 1.1, 0.8, '#2e3236', { collide: true }); // касса
        this.stations[r.id] = { x: xc + 4.3, z: wallZ - s * 1.6, yaw: s > 0 ? 0 : Math.PI, room: r.id };
        spotsAt([[-4.6, 4.3], [-4.6, -4.3], [4.6, -4.2], [0, 4.4]]);
        break;
      }
      case 'mirror': {
        const mm = new THREE.MeshStandardMaterial({ color: '#7d858c', metalness: 0.9, roughness: 0.15 });
        mm.userData.own = true;
        for (let k = 0; k < 4; k++) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.4), mm);
          p.position.set(r.x0 + 1.6 + k * 2.6, 1.4, wallZ - s * 0.03);
          p.rotation.y = face;
          this.addObj(p);
          this.box(r.x0 + 1.6 + k * 2.6, 0.15, wallZ, 2.2, 2.7, 0.06, '#1a1714');
        }
        board('ТЫ НЕ ОТРАЖАЕШЬСЯ');
        spotsAt([[-4.6, 4.2], [4.6, -4], [-4.5, -4], [0, 0]]);
        break;
      }
      case 'staff': {
        this.prop('sofa', xc - 3, 0, zc + s * 3, { ry: s > 0 ? Math.PI : 0, colors: { Fabric: '#3a2424', Cushion: '#2a1a1a' } });
        this.world.addBox(xc - 4.5, xc - 1.5, 0, 0.9, zc + s * 3 - 0.55, zc + s * 3 + 0.55);
        this.prop('teacher_desk', xc + 1.5, 0, zc, { ry: s > 0 ? 0 : Math.PI, colors: { Wood: '#2e241b' } });
        this.world.addBox(xc + 0.6, xc + 2.4, 0, 0.8, zc - 0.45, zc + 0.45);
        this.stations[r.id] = { x: xc + 1.5, z: zc - s * 1.1, yaw: s > 0 ? Math.PI : 0, room: r.id };
        
        spotsAt([[-4.5, -4], [4.6, -4], [-4.6, 1], [3.2, 2.5]]);
        break;
      }
      case 'med': {
        for (let k = 0; k < 3; k++) this.prop('bed', xc - 3.4 + k * 3.4, 0, zc + s * 2.2, { ry: s > 0 ? 0 : Math.PI, colors: { Sheet: '#8a8478', Blanket: '#4a2020' } });
        for (let k = 0; k < 3; k++) this.world.addBox(xc - 3.4 + k * 3.4 - 1.1, xc - 3.4 + k * 3.4 + 1.1, 0, 0.7, zc + s * 2.2 - 1.6, zc + s * 2.2 + 1.6);
        if (gore) for (let k = 0; k < 3; k++) decals.add(T2.splat[k], xc - 3.4 + k * 3.4, 0.62, zc + s * 2.2, { w: 1.1, h: 1.1, rot: rnd() * 6 });
        spotsAt([[-4.6, -3.8], [4.6, -3.8], [0, -1.2], [4.5, 4.4]]);
        break;
      }
      case 'boiler': {
        for (let k = 0; k < 2; k++) {
          this.geo(GEO.cyl, '#3a2f2a', xc - 2.5 + k * 5, 1.3, zc + s * 2, { sx: 1.6, sy: 2.6, sz: 1.6 });
          this.world.addBox(xc - 2.5 + k * 5 - 0.85, xc - 2.5 + k * 5 + 0.85, 0, 2.6, zc + s * 2 - 0.85, zc + s * 2 + 0.85);
          this.geo(GEO.box, '#ff3a10', xc - 2.5 + k * 5, 0.5, zc + s * 2 - s * 0.82, { sx: 0.5, sy: 0.3, sz: 0.02, emissive: '#a01800' });
        }
        for (let k = 0; k < 5; k++) this.geo(GEO.cyl, '#2a2522', xc - 4.5 + k * 2.2, 2.6, zc, { sx: 0.12, sy: 10, sz: 0.12, rx: Math.PI / 2 });
        this.emergencyLight(xc, 0.6, zc + s * 2 - s * 1.2, '#ff4010', 0.8, true);
        spotsAt([[-4.6, -3.8], [4.6, -3.8], [0, -2.5], [0, 4.3]]);
        break;
      }
      default: break;
    }
    // кровь в кабинете
    if (gore || rnd() < 0.4) decals.add(T2.splat[Math.floor(rnd() * 3)], xc + (rnd() - 0.5) * 6, 0.013, zc + (rnd() - 0.5) * 6, { w: 1 + rnd() * 1.5, h: 1 + rnd() * 1.5, rot: rnd() * 6 });
    if (gore && rnd() < 0.5) decals.add(T2.hand, xc + (rnd() - 0.5) * 8, 1 + rnd(), wallZ - s * 0.05, { face: s > 0 ? '-z' : '+z', w: 0.32, h: 0.32, rot: rnd() - 0.5 });
    // табличка на двери
    const lbl = signText(this, r.name, r.doorX, 2.65, r.doorZ - r.side * 0.13, 1.5, 0.3, r.side > 0 ? Math.PI : 0, { bg: '#26231f', fg: '#9c9384', res: 0.35 });
    r.sign = lbl;
  }

  // -------------------------------------------------------------- двери
  makeDoor(id, x, z, axis, room, { locked = false, back = false, wide = false, name = null } = {}) {
    const w = wide ? 2.6 : 1.5;
    const pivot = new THREE.Group();
    const doorMat = new THREE.MeshStandardMaterial({ color: wide ? '#3a1d14' : '#3b2a1e', roughness: 0.8 });
    doorMat.userData.own = true;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, 0.07), doorMat);
    leaf.castShadow = true;
    // ручка и окошко
    const knob = new THREE.Mesh(GEO.sphere, mat('#8a7a50'));
    knob.scale.setScalar(0.06);
    knob.position.set(w / 2 - 0.15, 0, 0.06);
    leaf.add(knob);
    if (axis === 'x') {
      pivot.position.set(x - w / 2, 0, z);
      leaf.position.set(w / 2, 1.2, 0);
    } else {
      pivot.position.set(x, 0, z - w / 2);
      pivot.rotation.y = -Math.PI / 2;
      leaf.position.set(w / 2, 1.2, 0);
    }
    pivot.add(leaf);
    this.addObj(pivot);
    const col = axis === 'x'
      ? this.world.addBox(x - w / 2, x + w / 2, 0, 2.4, z - 0.08, z + 0.08)
      : this.world.addBox(x - 0.08, x + 0.08, 0, 2.4, z - w / 2, z + w / 2);
    const d = { id, x, z, axis, room, back, pivot, col, open: 0, target: 0, locked, name: name || room?.name, openDir: room ? -room.side : 1, leaf };
    this.doors.push(d);
    this.interact({
      pos: [x, 1, z], radius: 1.7,
      prompt: () => (d.locked ? `🔒 Заперто${d.name ? ': ' + d.name : ''}` : d.target ? 'Закрыть дверь' : `Открыть дверь${d.name ? ': ' + d.name : ''}`),
      action: () => this.useDoor(d, true),
    });
    return d;
  }

  useDoor(d, byPlayer) {
    const M = this.mode;
    if (d.locked) {
      if (byPlayer) { M.audio.at('rattle', d); M.makeNoise(d.x, d.z, 7, 'door'); }
      return;
    }
    d.target = d.target ? 0 : 1;
    M.audio.at(d.target ? 'creak' : 'slam', d);
    if (byPlayer) M.makeNoise(d.x, d.z, d.target ? 6 : 9, 'door');
  }

  setDoor(d, open) {
    if (d.locked && open) return;
    if (!!d.target === !!open) return;
    d.target = open ? 1 : 0;
    this.mode.audio.at(open ? 'creak' : 'slam', d);
  }

  // -------------------------------------------------------------- шкафчики
  makeLocker(x, z, face) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = face > 0 ? 0 : Math.PI;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.5), mat('#3c4a44'));
    body.position.y = 1;
    body.castShadow = true;
    g.add(body);
    for (let k = 0; k < 5; k++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.02), mat('#1a201d'));
      v.position.set(0, 1.65 - k * 0.07, 0.26);
      g.add(v);
    }
    this.addObj(g);
    this.world.addBox(x - 0.36, x + 0.36, 0, 2, z - 0.26, z + 0.26, { camera: false });
    const L = { x, z, face, g, out: new THREE.Vector3(x, 0, z + face * 0.75) };
    this.lockers.push(L);
    this.interact({
      pos: [x, 1, z + face * 0.4], radius: 1.3,
      prompt: () => (this.mode.hidden ? 'Выйти из шкафчика' : 'Спрятаться в шкафчик'),
      enabled: () => !this.mode.hidden || this.mode.hidden === L,
      action: () => this.mode.toggleHide(L),
    });
    return L;
  }

  // -------------------------------------------------------------- лампы
  makeLamp(x, z, rnd, alwaysOn = false) {
    const m = new THREE.MeshBasicMaterial({ color: '#fff0d0' });
    m.userData.own = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.35), m);
    mesh.position.set(x, H - 0.05, z);
    this.addObj(mesh);
    const r = rnd();
    const blackout = this.mode.mission.blackout;
    const state = alwaysOn ? 'flicker' : blackout ? 'dead' : r < 0.42 ? 'on' : r < 0.72 ? 'flicker' : 'dead';
    const L = { x, z, mesh, m, state, base: state, level: 0, ph: rnd() * 10 };
    this.lamps.push(L);
    return L;
  }

  emergencyLight(x, y, z, color, intensity = 1, small = false) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(small ? 0.3 : 0.4, 0.14, 0.14), new THREE.MeshBasicMaterial({ color }));
    box.material.userData.own = true;
    box.position.set(x, y, z);
    this.addObj(box);
    // сам источник света — из общего пула (ближайшие к игроку)
    this.emergency.push({ isEm: true, x, y: y - 0.2, z, color: new THREE.Color(color), base: intensity * 4, ph: Math.random() * 6, level: 1 });
  }

  // -------------------------------------------------------------- баррикады
  makeBarricade(x) {
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.6), mat('#3a2e22'));
      b.position.set((Math.random() - 0.5) * 0.6, 0.3 + k * 0.35, -1.4 + (k % 3) * 1.4);
      b.rotation.set(Math.random(), Math.random() * 3, Math.random() * 0.8);
      b.castShadow = true;
      g.add(b);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), mat('#2c2e30'));
      leg.position.copy(b.position).add(new THREE.Vector3(0.3, -0.2, 0));
      leg.rotation.z = Math.random();
      g.add(leg);
    }
    g.position.set(x, 0, 0);
    this.addObj(g);
    const col = this.world.addBox(x - 0.7, x + 0.7, 0, 2.2, -2, 2);
    const B = { x, g, col, on: false };
    return B;
  }

  setBarricade(k) {
    this.barricades.forEach((b, i) => { b.on = i === k; b.g.visible = b.on; b.col.enabled = b.on; });
  }

  // -------------------------------------------------------------- спортзал / лабиринт
  buildGym(mission, rnd, decals, T) {
    this.box(-58, -0.2, -21, 28, 0.2, 18, '#2e2a26', { walk: true, map: '#2e3a40', cast: false });
    this.box(-58, H + 1.5, -21, 28, 0.15, 18, CEIL, { cast: false });
    this.wallX(-12, -72, -44, 0, H + 1.5, WALL2);
    this.wallX(-30, -72, -44, 0, H + 1.5, WALL2);
    this.wallZ(-72, -30, -12, 0, H + 1.5, WALL2);
    this.wallZ(-44, -30, -15, 0, H + 1.5, WALL2);
    for (let k = 0; k < 3; k++) this.makeLamp(-66 + k * 10, -21, rnd);
    this.emergencyLight(-71.6, 3, -21, '#ff1010', 1.2);
    this.point('gym', -47, 0, -13.5);
    this.maze = null;
    if (!mission.maze) return;
    // лабиринт 9×6 клеток по 3 м, стены — отдельные меши, чтобы перестраиваться
    const NX = 9, NZ = 6, C = 3, X0 = -71, Z0 = -30;
    const wallMat = new THREE.MeshStandardMaterial({ color: '#4a3f36', roughness: 0.9 });
    wallMat.userData.own = true;
    const walls = [];
    const mk = (x, z, vert) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(vert ? 0.25 : C + 0.25, 2.6, vert ? C + 0.25 : 0.25), wallMat);
      m.position.set(x, 1.3, z);
      m.castShadow = true;
      this.addObj(m);
      const col = this.world.addBox(x - (vert ? 0.13 : C / 2 + 0.12), x + (vert ? 0.13 : C / 2 + 0.12), 0, 2.6, z - (vert ? C / 2 + 0.12 : 0.13), z + (vert ? C / 2 + 0.12 : 0.13));
      return { m, col };
    };
    // все внутренние рёбра
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      if (i < NX - 1) walls.push({ a: [i, j], b: [i + 1, j], ...mk(X0 + (i + 1) * C, Z0 + j * C + C / 2, true) });
      if (j < NZ - 1) walls.push({ a: [i, j], b: [i, j + 1], ...mk(X0 + i * C + C / 2, Z0 + (j + 1) * C, false) });
    }
    this.maze = { NX, NZ, C, X0, Z0, walls, cell: (i, j) => ({ x: X0 + i * C + C / 2, z: Z0 + j * C + C / 2 }) };
    this.shuffleMaze(rnd);
  }

  // новая планировка лабиринта (рекурсивный обход) — любая клетка достижима из любой
  shuffleMaze(rnd = Math.random) {
    const Z = this.maze;
    if (!Z) return;
    const seen = new Set();
    const open = new Set();
    const key = (i, j) => i + ',' + j;
    const stack = [[Z.NX - 1, Z.NZ - 1]];
    seen.add(key(Z.NX - 1, Z.NZ - 1));
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < Z.NX && b < Z.NZ && !seen.has(key(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = nb[Math.floor(rnd() * nb.length)];
      open.add([key(i, j), key(a, b)].sort().join('|'));
      seen.add(key(a, b));
      stack.push([a, b]);
    }
    for (const w of Z.walls) {
      const k = [key(...w.a), key(...w.b)].sort().join('|');
      const on = !open.has(k) && rnd() > 0.12; // немного лишних проходов, чтобы были петли
      w.m.visible = on;
      w.col.enabled = on;
    }
  }

  // -------------------------------------------------------------- актовый зал Директора
  buildFinal(mission, rnd, decals, T) {
    this.box(56, -0.2, 0, 24, 0.2, 24, '#24201d', { walk: true, map: '#40262a', cast: false });
    this.box(56, H + 2, 0, 24, 0.15, 24, CEIL, { cast: false });
    this.wallX(12, 44, 68, 0, H + 2, WALL2);
    this.wallX(-12, 44, 68, 0, H + 2, WALL2);
    this.wallZ(68, -12, 12, 0, H + 2, WALL2);
    for (const [x, z] of [[50, -6], [50, 6], [60, -6], [60, 6]]) this.box(x, 0, z, 0.8, H + 2, 0.8, '#3a3530', { collide: true });
    this.box(65, 0, 0, 5, 0.7, 14, '#2a1a16', { collide: false, walk: true }); // сцена
    // красный занавес
    for (let k = 0; k < 10; k++) this.box(67.6, 0.7, -6.3 + k * 1.4, 0.2, 4.4, 1.3, k % 2 ? '#4a0808' : '#3a0606');
    const big = bloodText('ДОБРО ПОЖАЛОВАТЬ НА ЭКЗАМЕН', 9, 1.4);
    big.position.set(67.4, 4.3, 0);
    big.rotation.y = -Math.PI / 2;
    this.addObj(big);
    this.seals = [[54, -9], [54, 9], [62, -4]].map(([x, z], k) => {
      this.box(x, 0, z, 0.8, 1.1, 0.8, '#1d1a18', { collide: true });
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: '#ff2010' }));
      rune.material.userData.own = true;
      rune.position.set(x, 1.6, z);
      this.addObj(rune);
      return { x, z, rune, k };
    });
    this.examDesk = { x: 58, z: 0 };
    this.box(58, 0, 0, 1.8, 0.85, 1, '#2a1d16', { collide: true });
    for (let k = 0; k < (this.game.save.data.horror.gore !== 'low' ? 14 : 4); k++) decals.add(T.splat[k % 3], 46 + rnd() * 20, 0.015 + k * 0.0003, -10 + rnd() * 20, { w: 1 + rnd() * 2, h: 1 + rnd() * 2, rot: rnd() * 6 });
    for (let k = 0; k < 4; k++) this.makeLamp(48 + k * 6, 0, rnd);
    this.emergencyLight(67.5, 4.5, -8, '#ff1010', 1.6);
    this.emergencyLight(67.5, 4.5, 8, '#ff1010', 1.6);
    this.point('final', 47, 0, 0);
    this.mapRects.push({ x: 56, z: 0, w: 24, d: 24, color: '#3a2226' });
  }

  // -------------------------------------------------------------- секретная комната (кровавый след)
  buildSecret(rnd, decals, T) {
    this.box(48.5, -0.2, -16, 9, 0.2, 8, FLOOR, { walk: true, cast: false });
    this.box(48.5, H, -16, 9, 0.15, 8, CEIL, { cast: false });
    this.wallX(-20, 44, 53, 0, H, WALL2);
    this.wallZ(53, -20, -12, 0, H, WALL2);
    this.wallZ(44, -20, -15, 0, H, WALL2);
    this.box(50, 0, -18.8, 1.2, 1.2, 0.8, '#2b2d30', { collide: true });
    this.stations.secret = { x: 50, z: -17.6, yaw: Math.PI, room: 'secret' };
    const w = bloodText('ТЫ НАШЁЛ МЕНЯ', 4, 1);
    w.position.set(48.5, 1.8, -19.85);
    this.addObj(w);
    for (let k = 0; k < 6; k++) decals.add(T.splat[k % 3], 45 + rnd() * 7, 0.015 + k * 0.0003, -19 + rnd() * 6, { w: 1.2, h: 1.2, rot: rnd() * 6 });
    this.makeLamp(48.5, -16, rnd);
    this.point('secret', 47, 0, -13.5);
    this.mapRects.push({ x: 48.5, z: -16, w: 9, d: 8, color: '#3a2020' });
  }

  // кровавый след: footprints от точки a к точке b
  trail(points, fake = false) {
    const T = bloodTextures();
    const D = new DecalBatch();
    let step = 0;
    for (let k = 0; k < points.length - 1; k++) {
      const [ax, az] = points[k], [bx, bz] = points[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      for (let d = 0; d < len; d += 0.7) {
        const t = d / len;
        const side = step++ % 2 ? 0.14 : -0.14;
        const x = ax + (bx - ax) * t + Math.cos(ang) * side, z = az + (bz - az) * t - Math.sin(ang) * side;
        D.add(T.foot, x, 0.016 + (step % 7) * 0.0002, z, { w: 0.18, h: 0.34, rot: ang + Math.PI });
        if (!fake && step % 9 === 0) D.add(T.splat[step % 3], x, 0.0155, z, { w: 0.4, h: 0.4, rot: step });
      }
    }
    D.bake(this.dyn);
  }

  // -------------------------------------------------------------- навигация монстров
  buildNav() {
    const N = this.nav.nodes, E = this.nav.edges;
    const node = (id, x, z) => { N.set(id, { id, x, z }); E.set(id, []); };
    const link = (a, b, door = null, block = null) => { E.get(a).push({ to: b, door, block }); E.get(b).push({ to: a, door, block }); };
    const cxs = [-43, ...ROOMS.slice(0, 8).map((r) => r.doorX), 43];
    cxs.forEach((x, k) => node('c' + k, x, 0));
    for (let k = 0; k < cxs.length - 1; k++) {
      const mid = (cxs[k] + cxs[k + 1]) / 2;
      const b = this.barricades.find((B) => B.x > cxs[k] && B.x < cxs[k + 1]) || null;
      link('c' + k, 'c' + (k + 1), null, b);
      void mid;
    }
    const sxs = [-43, ...ROOMS.slice(8).map((r) => r.backX), 43];
    sxs.forEach((x, k) => node('v' + k, x, -13.5));
    for (let k = 0; k < sxs.length - 1; k++) link('v' + k, 'v' + (k + 1));
    ROOMS.forEach((r) => {
      const ci = 1 + r.i;
      const dIn = r.id + 'i', cen = r.id + 'c';
      node(dIn, r.doorX, r.side * 3.3);
      node(cen, r.xc, r.zc);
      const door = this.doors.find((d) => d.id === 'd_' + r.id);
      link('c' + ci, dIn, door);
      link(dIn, cen);
      if (r.side < 0) {
        const bIn = r.id + 'b';
        node(bIn, r.backX, -10.7);
        link(cen, bIn);
        link(bIn, 'v' + ci, this.doors.find((d) => d.id === 'b_' + r.id));
      }
    });
  }

  nearestNode(x, z) {
    let best = null, bd = Infinity;
    for (const n of this.nav.nodes.values()) {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // Дейкстра по графу (узлов немного)
  path(fromId, toId) {
    const dist = new Map([[fromId, 0]]);
    const prev = new Map();
    const open = new Set([fromId]);
    const N = this.nav.nodes;
    while (open.size) {
      let cur = null, cd = Infinity;
      for (const id of open) { const d = dist.get(id); if (d < cd) { cd = d; cur = id; } }
      open.delete(cur);
      if (cur === toId) break;
      for (const e of this.nav.edges.get(cur)) {
        if (e.block && e.block.on) continue;
        if (e.door && e.door.locked) continue;
        const a = N.get(cur), b = N.get(e.to);
        const nd = cd + Math.hypot(a.x - b.x, a.z - b.z);
        if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { id: cur, door: e.door }); open.add(e.to); }
      }
    }
    if (!dist.has(toId)) return null;
    const out = [];
    let c = toId;
    while (c !== fromId) { const p = prev.get(c); out.unshift({ node: N.get(c), door: p.door }); c = p.id; }
    return out;
  }

  // прямая видимость (стены блокируют)
  los(ax, ay, az, bx, by, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.45);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.world.pointBlocked(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, 0.02)) return false;
    }
    return true;
  }

  lightAt(x, z) {
    let L = 0;
    for (const l of this.lamps) {
      if (l.level < 0.1) continue;
      const d = Math.hypot(l.x - x, l.z - z);
      if (d < 6) L = Math.max(L, l.level * (1 - d / 6));
    }
    return L;
  }

  enter() { this.mode.begin(); }

  // -------------------------------------------------------------- обновление
  update(dt) {
    super.update(dt);
    const g = this.game, M = this.mode;
    const t = performance.now() / 1000;
    // двери
    for (const d of this.doors) {
      if (Math.abs(d.open - d.target) > 0.001) {
        d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 2.4);
        d.leaf.parent.rotation.y = (d.axis === 'z' ? -Math.PI / 2 : 0) + d.open * 1.55 * d.openDir;
      }
      d.col.enabled = d.open < 0.35;
    }
    // лампы
    const flickerSafe = g.save.data.horror.flashSafe;
    for (const l of this.lamps) {
      let target = 0;
      if (!M.blackout || l.base === 'emergency') {
        if (l.state === 'on') target = 1;
        else if (l.state === 'flicker') {
          const n = Math.sin(t * 13 + l.ph) * Math.sin(t * 7.3 + l.ph * 2) + Math.sin(t * 1.7 + l.ph);
          target = flickerSafe ? 0.5 + 0.2 * Math.sin(t + l.ph) : n > 0.4 ? 1 : n > -0.2 ? 0.25 : 0;
        }
      }
      l.level = target;
      l.m.color.setRGB(0.12 + l.level * 0.9, 0.11 + l.level * 0.82, 0.1 + l.level * 0.65);
    }
    // пул точечных источников — к ближайшим включённым лампам
    this._poolT = (this._poolT || 0) - dt;
    const p = g.player.pos;
    if (this._poolT <= 0) {
      this._poolT = 0.2;
      const src = this.lamps.filter((l) => l.state !== 'dead').concat(this.emergency);
      this._near = src.map((l) => [l, (l.x - p.x) ** 2 + (l.z - p.z) ** 2]).filter((a) => a[1] < 24 * 24).sort((a, b) => a[1] - b[1]).slice(0, this.pool.length).map((a) => a[0]);
    }
    const warm = this._warm || (this._warm = new THREE.Color('#ffe2b0'));
    this.pool.forEach((pl, i) => {
      const l = this._near && this._near[i];
      if (!l) { pl.intensity = 0; return; }
      if (l.isEm) {
        // аварийный красный — пульсирует, при отключении света ярче
        pl.position.set(l.x, l.y, l.z);
        pl.color.copy(l.color);
        pl.intensity = l.base * (0.55 + 0.45 * Math.sin(t * 2.2 + l.ph)) * (M.blackout ? 1.4 : 1);
      } else {
        pl.position.set(l.x, H - 0.35, l.z);
        pl.color.copy(warm);
        pl.intensity = l.level * 7;
      }
    });
    // фонарик — светит туда, куда смотрит камера
    const fl = this.flashlight;
    const cam = g.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    fl.position.set(p.x + Math.cos(g.cam.yaw) * 0.25, p.y + 1.35, p.z - Math.sin(g.cam.yaw) * 0.25);
    fl.target.position.copy(fl.position).addScaledVector(dir, 8);
    const on = M.flashOn && M.battery > 0 && !M.hidden;
    let fi = on ? 55 : 0;
    if (on && M.battery < 15) fi *= Math.random() < 0.12 ? 0.1 : 0.55 + M.battery / 40;
    fl.intensity = fi;
    if (this.seals) this.seals.forEach((s) => { s.rune.rotation.y += dt * (s.broken ? 0 : 1.5); s.rune.rotation.x = Math.sin(t + s.k) * 0.3; });
  }
}
