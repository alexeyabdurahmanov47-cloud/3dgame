import * as THREE from 'three';
import { mat } from '../core/gfx.js';
import { CONFIG } from '../config.js';
import { CharacterModel, starGeometry } from '../player/CharacterModel.js';
import { lookFromEquipped } from '../shop/items.js';

// Динамические объекты: монеты, звёзды знаний, цветы, мяч, собака, NPC.

export const STAR_TOTAL = 10;
const FACTS = [
  'Сердце человека бьётся около 100 000 раз в день!',
  'Осьминог имеет три сердца и голубую кровь.',
  'Свет от Солнца летит до Земли примерно 8 минут.',
  'Слово «алфавит» состоит из названий двух греческих букв: альфа и бета.',
  'Самая длинная река в мире — Нил или Амазонка: учёные до сих пор спорят!',
  'Пчёлы видят ультрафиолетовый свет, а мы — нет.',
  'Ноль придумали индийские математики примерно 1500 лет назад.',
  'В английском языке самая частая буква — E.',
  'Байкал — самое глубокое озеро на планете (1642 м).',
  'Первый компьютер весил почти 30 тонн!',
];

const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 14);
coinGeo.rotateX(Math.PI / 2);

export function coin(s, key, x, y, z) {
  const g = s.game;
  const prog = g.save.progress;
  const fullKey = `${s.name}:${key}`;
  if (prog.picked[fullKey]) return;
  const m = new THREE.Mesh(coinGeo, mat('#ffd32a', { emissive: '#8a6a00' }));
  m.position.set(x, y + 0.8, z);
  m.castShadow = true;
  s.addObj(m);
  const base = m.position.y;
  let alive = true;
  s.onUpdate((dt) => {
    if (!alive) return;
    m.rotation.y += dt * 3;
    m.position.y = base + Math.sin(performance.now() / 300 + x) * 0.1;
    const p = g.player.pos;
    if (Math.abs(p.x - x) < 0.8 && Math.abs(p.z - z) < 0.8 && Math.abs(p.y + 0.8 - m.position.y) < 1.3) {
      alive = false;
      prog.picked[fullKey] = true;
      m.removeFromParent();
      g.audio.play('coin');
      g.save.addCoins(CONFIG.rewards.coinPickup, 'pickup');
      g.save.stat('coinsPicked');
      g.fx.burst(m.position, '#ffd32a', 10);
    }
  });
}

export function knowledgeStar(s, id, x, y, z) {
  const g = s.game;
  if (g.save.data.collected[id]) return;
  const grp = new THREE.Group();
  const m = new THREE.Mesh(starGeometry(0.45, 0.15), mat('#ffe066', { emissive: '#c9a400' }));
  m.castShadow = true;
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 20), mat('#fff8c4', { basic: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  grp.add(m, halo);
  grp.position.set(x, y + 1.1, z);
  s.addObj(grp);
  let alive = true;
  s.onUpdate((dt) => {
    if (!alive) return;
    m.rotation.y += dt * 2;
    halo.lookAt(g.camera.position);
    grp.position.y = y + 1.1 + Math.sin(performance.now() / 400) * 0.15;
    const p = g.player.pos;
    if (p.distanceTo(new THREE.Vector3(x, p.y, z)) < 1 && Math.abs(p.y - y) < 1.8) {
      alive = false;
      grp.removeFromParent();
      g.save.data.collected[id] = true;
      const n = Object.keys(g.save.data.collected).length;
      g.audio.play('star');
      g.fx.burst(grp.position, '#ffe066', 30);
      g.save.addCoins(CONFIG.rewards.star, 'star');
      g.save.addXp(25);
      g.ui.dialog.show([
        { name: 'Звезда знаний', avatar: '⭐', text: `Ты нашёл звезду знаний (${n}/${STAR_TOTAL})! +${CONFIG.rewards.star} монет.` },
        { name: 'Знаешь ли ты?', avatar: '💡', text: FACTS[(n - 1) % FACTS.length] },
      ]);
      g.events.emit('star', n);
    }
  });
}

// Цветок, который можно полить (маленький бонус)
export function waterFlower(s, key, x, y, z, color = '#ff6b81') {
  const g = s.game;
  const prog = g.save.progress;
  const fullKey = `${s.name}:${key}`;
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), mat('#27ae60'));
  stem.position.y = 0.25;
  const head = new THREE.Group();
  head.position.y = 0.55;
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(color));
    const a = (i / 6) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
    head.add(p);
  }
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat('#feca57')));
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat('#2ecc71'));
  leaf.scale.set(1.5, 0.3, 0.7);
  leaf.position.set(0.1, 0.2, 0);
  grp.add(stem, head, leaf);
  s.addObj(grp);
  let watered = !!prog.picked[fullKey];
  let grow = watered ? 1 : 0;
  const apply = () => {
    head.scale.setScalar(0.35 + grow * 0.85);
    stem.scale.y = 0.6 + grow * 0.6;
    stem.position.y = 0.25 * stem.scale.y;
    head.position.y = 0.55 * stem.scale.y;
  };
  apply();
  s.onUpdate((dt) => {
    if (watered && grow < 1) { grow = Math.min(1, grow + dt * 1.5); apply(); }
    head.rotation.y += dt * 0.5;
  });
  s.interact({
    pos: [x, y + 0.5, z],
    radius: 1.5,
    prompt: 'Полить цветок 💧',
    enabled: () => !watered,
    action: () => {
      watered = true;
      prog.picked[fullKey] = true;
      g.audio.play('water');
      g.fx.burst(new THREE.Vector3(x, y + 0.8, z), '#74b9ff', 14);
      g.save.addCoins(CONFIG.rewards.waterFlower, 'flower');
      g.save.stat('flowers');
      g.ui.toast(`🌸 Цветок расцвёл! +${CONFIG.rewards.waterFlower} 🪙`);
    },
  });
}

// Мяч, который можно пинать
export function ball(s, x, y, z) {
  const g = s.game;
  const r = 0.35;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat('#ff7675'));
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.04, 4, 16), mat('#ffffff'));
  m.add(stripe);
  m.castShadow = true;
  m.position.set(x, y + r, z);
  s.addObj(m);
  const v = new THREE.Vector3();
  let vy = 0;
  let cool = 0;
  s.onUpdate((dt) => {
    cool -= dt;
    const p = g.player.pos;
    const dx = m.position.x - p.x, dz = m.position.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < r + 0.45 && Math.abs(p.y + r - m.position.y) < 1 && cool <= 0) {
      const pv = g.player.vel;
      const sp = Math.max(4, Math.hypot(pv.x, pv.z) * 1.6);
      v.set(dx / d, 0, dz / d).multiplyScalar(sp);
      vy = 3 + Math.random() * 2;
      cool = 0.3;
      g.audio.play('kick');
      g.save.stat('kicks');
    }
    vy -= 18 * dt;
    m.position.x += v.x * dt;
    m.position.z += v.z * dt;
    m.position.y += vy * dt;
    const ground = s.world.groundAt(m.position.x, m.position.z, m.position.y) + r;
    if (m.position.y < ground) { m.position.y = ground; vy = Math.abs(vy) > 1.5 ? -vy * 0.45 : 0; }
    const before = m.position.clone();
    const tmp = new THREE.Vector3(m.position.x, m.position.y - r, m.position.z);
    if (s.world.resolve(tmp, r, r * 2)) {
      const nx = tmp.x - before.x, nz = tmp.z - before.z;
      if (Math.abs(nx) > Math.abs(nz)) v.x = -v.x * 0.7; else v.z = -v.z * 0.7;
      m.position.x = tmp.x; m.position.z = tmp.z;
    }
    v.multiplyScalar(Math.exp(-1.2 * dt));
    m.rotation.x += v.z * dt / r;
    m.rotation.z -= v.x * dt / r;
  });
  m.userData.vel = v;
  m.userData.home = new THREE.Vector3(x, y + r, z);
  return m;
}

// Собака, гуляющая по парку
export function dog(s, x, z, range = 6) {
  const g = s.game;
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.7), mat('#c68642'));
  body.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat('#c68642'));
  head.position.set(0, 0.7, 0.42);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.15), mat('#8d5524'));
  snout.position.set(0, 0.64, 0.6);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), mat('#111'));
  nose.position.set(0, 0.68, 0.68);
  const ears = [-1, 1].map((sd) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.1), mat('#8d5524'));
    e.position.set(sd * 0.15, 0.82, 0.38);
    return e;
  });
  const eyes = [-1, 1].map((sd) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), mat('#111'));
    e.position.set(sd * 0.08, 0.76, 0.575);
    return e;
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), mat('#c68642'));
  tail.position.set(0, 0.6, -0.42);
  tail.rotation.x = -0.6;
  const legs = [[-0.12, 0.25], [0.12, 0.25], [-0.12, -0.25], [0.12, -0.25]].map(([lx, lz]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.09), mat('#8d5524'));
    l.position.set(lx, 0.16, lz);
    return l;
  });
  grp.add(body, head, snout, nose, tail, ...ears, ...eyes, ...legs);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  grp.position.set(x, 0, z);
  s.addObj(grp);
  let target = new THREE.Vector3(x, 0, z), wait = 0, t = 0, happy = 0;
  s.onUpdate((dt) => {
    t += dt;
    const p = g.player.pos;
    const toP = Math.hypot(p.x - grp.position.x, p.z - grp.position.z);
    if (happy > 0) { happy -= dt; tail.rotation.y = Math.sin(t * 30) * 0.7; grp.position.y = Math.abs(Math.sin(t * 10)) * 0.15; return; }
    grp.position.y = 0;
    if (toP < 2.2) { // смотрит на игрока
      grp.rotation.y = Math.atan2(p.x - grp.position.x, p.z - grp.position.z);
      tail.rotation.y = Math.sin(t * 18) * 0.5;
      return;
    }
    if (wait > 0) { wait -= dt; tail.rotation.y = Math.sin(t * 6) * 0.3; return; }
    const dx = target.x - grp.position.x, dz = target.z - grp.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      target.set(x + (Math.random() - 0.5) * range * 2, 0, z + (Math.random() - 0.5) * range * 2);
      wait = 1 + Math.random() * 3;
      return;
    }
    grp.rotation.y = Math.atan2(dx, dz);
    grp.position.x += (dx / d) * 1.6 * dt;
    grp.position.z += (dz / d) * 1.6 * dt;
    legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 14 + (i % 2) * Math.PI) * 0.5));
  });
  const it = s.interact({
    pos: grp.position,
    radius: 1.8,
    prompt: 'Погладить собаку 🐶',
    action: () => {
      happy = 2;
      g.audio.play('bark');
      g.fx.burst(new THREE.Vector3(grp.position.x, 1.2, grp.position.z), '#ff6b81', 12, 'heart');
      g.save.stat('pets');
      g.ui.toast('🐶 Гав! Собака очень рада!');
    },
  });
  it.pos = grp.position;
  return grp;
}

// NPC‑персонаж с диалогом
export function npc(s, { x, y = 0, z, yaw = 0, look, name, avatar = '🙂', lines, prompt = 'Поговорить', onTalk, wave = false, enabled }) {
  const g = s.game;
  const model = new CharacterModel(look || lookFromEquipped({ skin: 'skin_uniform' }));
  model.root.position.set(x, y, z);
  model.root.rotation.y = yaw;
  if (wave) model.pose = 'wave';
  s.addObj(model.root);
  let face = yaw;
  s.onUpdate((dt) => {
    const p = g.player.pos;
    const d = Math.hypot(p.x - x, p.z - z);
    const want = d < 4 ? Math.atan2(p.x - x, p.z - z) : yaw;
    let diff = want - face;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    face += diff * Math.min(1, dt * 5);
    model.root.rotation.y = face;
    model.animate(dt, 0, {});
  });
  s.interact({
    pos: [x, y + 1, z],
    radius: 2,
    prompt: `${prompt}: ${name}`,
    enabled,
    action: () => {
      model.wave = 1.5;
      const ls = typeof lines === 'function' ? lines() : lines;
      if (ls) g.ui.dialog.show(ls.map((t) => (typeof t === 'string' ? { name, avatar, text: t } : t)), onTalk);
      else if (onTalk) onTalk();
    },
  });
  s.label([x, y + 2.3, z], name, { maxDist: 10, cls: 'npc' });
  return model;
}

// Простая «одежда» для NPC
export function npcLook(body, pants, hair, opts = {}) {
  return {
    skin: { body, pants, shoes: opts.shoes || '#333', hair, skinTone: opts.skinTone || '#ffd3b0', shape: opts.shape || 'tall', extra: opts.extra },
    acc: opts.acc || {},
  };
}
