import * as THREE from 'three';
import { mat, mesh, disposeObject } from '../core/gfx.js';
import { Assets } from '../core/Assets.js';

// Персонаж, собранный из примитивов (low‑poly). Поддерживает скины и аксессуары.

const geoCache = new Map();
function g(key, make) {
  if (!geoCache.has(key)) { const geo = make(); geo.userData.shared = true; geoCache.set(key, geo); }
  return geoCache.get(key);
}

export function starGeometry(r = 0.1, depth = 0.03, points = 5) {
  return g(`star${r}_${depth}_${points}`, () => {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    return geo;
  });
}

function heartGeometry(r = 0.06) {
  return g('heart' + r, () => {
    const s = new THREE.Shape();
    s.moveTo(0, -r);
    s.bezierCurveTo(r * 1.6, r * 0.1, r * 0.9, r * 1.3, 0, r * 0.55);
    s.bezierCurveTo(-r * 0.9, r * 1.3, -r * 1.6, r * 0.1, 0, -r);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false, curveSegments: 5 });
    geo.translate(0, 0, -0.0125);
    return geo;
  });
}

export class CharacterModel {
  constructor(look) {
    this.root = new THREE.Group();
    this.phase = Math.random() * 6;
    this.push = 0;
    this.t = 0;
    this.pose = 'stand';
    this.wave = 0;
    if (look) this.build(look);
  }

  clear() {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    for (const c of [...this.root.children]) {
      this.root.remove(c);
      c.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared && !o.isSkinnedMesh) o.geometry.dispose();
        if (o.material && o.material.userData && o.material.userData.own) o.material.dispose();
      });
    }
  }

  // Точка крепления на кости. Её локальные координаты совпадают с координатами персонажа
  // в позе покоя, поэтому аксессуары задаются «как на статуе», а двигаются вместе с костью.
  anchor(boneName, pos = [0, 0, 0]) {
    const bone = this.bones[boneName];
    const a = new THREE.Object3D();
    const m = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(this.inst.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2]));
    m.decompose(a.position, a.quaternion, a.scale);
    bone.add(a);
    return a;
  }

  build(look) {
    this.clear();
    this.look = look;
    const s = look.skin;
    const shape = s.shape || 'normal';
    // модель из Blender (public/models/character.glb)
    const { scene: inst, mixer, actions } = Assets.instance('character');
    this.inst = inst;
    this.mixer = mixer;
    this.actions = actions;
    this.cur = null;
    this.root.add(inst);
    // взрослые пропорции: голова меньше, чем у «мультяшной» модели
    this.headScale = 0.7;
    if (shape === 'tall') inst.scale.set(1, 1.12, 1);
    if (shape === 'mini') { inst.scale.setScalar(0.84); this.headScale = 0.85; }
    // перекраска материалов под скин
    const robot = shape === 'robot';
    const tint = { Skin: robot ? '#95a5a6' : s.skinTone, Cheek: robot ? '#95a5a6' : s.skinTone, Mouth: '#8a4b45', Body: s.body, Pants: s.pants, Shoes: s.shoes, Hair: s.hair };
    this.parts = {};
    inst.traverse((o) => {
      if (o.isBone) return;
      if (o.name) this.parts[o.name] = o;
      if (o.isMesh && o.material && tint[o.material.name] !== undefined) {
        const m = o.material.clone();
        m.userData = { own: true };
        m.color.set(tint[o.material.name]);
        if (robot && o.material.name === 'Body') { m.metalness = 0.6; m.roughness = 0.35; }
        o.material = m;
      }
    });
    this.bones = {};
    inst.traverse((o) => { if (o.isBone) this.bones[o.name.replace(/[^a-zA-Z]/g, '')] = o; });
    this.root.updateMatrixWorld(true);

    const hipY = 0.58, torsoH = 0.54, torsoR = 0.22, headR = 0.3, legLen = 0.5;
    this.dims = { legLen, torsoH, torsoR, headR, hipY };
    const chestZ = 0.215, shoulderY = 1.07;
    this.headTopY = headR * 1.02;
    this.faceZ = 0.27;
    const head = this.anchor('head', [0, 1.49, 0]);
    const body = this.anchor('chest');
    const hips = this.anchor('hips');
    this.head = head;
    this.body = body;
    this.wrist = this.anchor('handL');
    this.arms = [];
    this.legs = [];
    this.cape = null;
    this.tail = null;

    if (robot) {
      ['Head', 'Face', 'Hair'].forEach((n) => this.hidePart(n));
      head.add(mesh(g('rhead', () => new THREE.BoxGeometry(0.52, 0.46, 0.46)), '#b2bec3'));
      const eyeM = mat('#00d2d3', { emissive: '#00a8a8' });
      [-1, 1].forEach((sd) => {
        const e = mesh(g('reye', () => new THREE.BoxGeometry(0.1, 0.06, 0.02)), eyeM);
        e.position.set(sd * 0.11, 0.04, 0.235);
        head.add(e);
      });
      const m = mesh(g('rmouth', () => new THREE.BoxGeometry(0.2, 0.04, 0.02)), '#2d3436');
      m.position.set(0, -0.1, 0.235);
      const ant = mesh(g('ant', () => new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5)), '#636e72');
      ant.position.y = 0.33;
      const ball = mesh(g('antb', () => new THREE.IcosahedronGeometry(0.05, 0)), mat('#ff4757', { emissive: '#aa0000' }));
      ball.position.y = 0.45;
      head.add(m, ant, ball);
      this.headTopY = 0.23;
      this.faceZ = 0.24;
    }
    if (shape === 'round') {
      const belly = mesh(g('belly', () => new THREE.SphereGeometry(0.33, 14, 10)), s.body);
      belly.scale.set(1, 0.95, 0.92);
      belly.position.set(0, 0.86, 0.02);
      this.anchor('spine').add(belly);
    }

    // особые детали образа
    const ex = s.extra;
    if (ex === 'tie') {
      const t = mesh(g('tie', () => new THREE.BoxGeometry(0.07, 0.24, 0.03)), '#d63031');
      t.position.set(0, 0.97, chestZ + 0.01);
      const collar = mesh(g('collar', () => new THREE.BoxGeometry(0.2, 0.05, 0.05)), '#ffffff');
      collar.position.set(0, 1.11, chestZ - 0.04);
      body.add(t, collar);
    }
    if (ex === 'stripes') {
      ['thighL', 'shinL', 'thighR', 'shinR'].forEach((b) => {
        const x = b.endsWith('L') ? 0.2 : -0.2;
        const st = mesh(g('stripe', () => new THREE.BoxGeometry(0.02, 0.24, 0.05)), '#ffffff');
        st.position.set(x * 0.93, b.startsWith('thigh') ? 0.45 : 0.2, 0);
        this.anchor(b).add(st);
      });
    }
    if (ex === 'leaf') {
      const l = mesh(g('leafb', () => new THREE.OctahedronGeometry(0.08, 0)), '#ffffff');
      l.scale.set(1, 1.4, 0.3);
      l.position.set(0, 0.95, chestZ + 0.01);
      body.add(l);
    }
    if (ex === 'number') {
      const n = mesh(g('num', () => new THREE.BoxGeometry(0.22, 0.22, 0.02)), '#ffffff');
      n.position.set(0, 0.96, chestZ + 0.01);
      body.add(n);
    }
    if (ex === 'dots') {
      for (let i = 0; i < 8; i++) {
        const d = mesh(g('dot', () => new THREE.SphereGeometry(0.028, 5, 4)), '#ffffff');
        const a = (i / 8) * Math.PI * 2;
        d.position.set(Math.sin(a) * 0.235, 0.84 + (i % 3) * 0.1, Math.cos(a) * 0.235);
        body.add(d);
      }
    }
    if (ex === 'robe') {
      const robe = mesh(g('robe', () => new THREE.CylinderGeometry(0.25, 0.42, 0.9, 10)), s.body);
      robe.position.y = 0.47;
      hips.add(robe);
      for (let i = 0; i < 4; i++) {
        const st = mesh(starGeometry(0.05, 0.02), mat('#feca57', { emissive: '#7a5c00' }));
        const a = i * 1.6 + 0.4;
        st.position.set(Math.sin(a) * 0.36, 0.25 + i * 0.12, Math.cos(a) * 0.36);
        st.lookAt(st.position.x * 2, st.position.y, st.position.z * 2);
        hips.add(st);
      }
    }
    if (ex === 'cape') {
      const capeG = new THREE.Group();
      capeG.position.set(0, shoulderY + 0.02, -torsoR - 0.02);
      const c = mesh(g('cape', () => new THREE.BoxGeometry(0.55, 0.85, 0.03)), '#d63031');
      c.position.y = -0.425;
      capeG.add(c);
      body.add(capeG);
      this.cape = capeG;
      const emb = mesh(starGeometry(0.08, 0.02), '#fdcb6e');
      emb.position.set(0, 0.95, chestZ + 0.02);
      body.add(emb);
    }
    if (ex === 'astro') {
      const helmet = new THREE.Mesh(g(`helmet${headR}`, () => new THREE.SphereGeometry(headR * 1.38, 16, 12)), mat('#a8e6ff', { transparent: true, opacity: 0.35 }));
      head.add(helmet);
      const pack = mesh(g('astropack', () => new THREE.BoxGeometry(0.42, 0.48, 0.2)), '#dfe6e9');
      pack.position.set(0, 0.88, -torsoR - 0.1);
      const flag = mesh(g('flag', () => new THREE.BoxGeometry(0.12, 0.08, 0.02)), '#0984e3');
      flag.position.set(0.12, 1.0, chestZ + 0.01);
      body.add(pack, flag);
    }
    if (ex === 'dino') {
      const tail = mesh(g('tail', () => new THREE.ConeGeometry(0.16, 0.7, 6)), s.body);
      tail.rotation.x = -Math.PI / 2 - 0.5;
      tail.position.set(0, hipY - 0.03, -0.42);
      hips.add(tail);
      this.tail = tail;
      for (let i = 0; i < 5; i++) {
        const sp = mesh(g('spike', () => new THREE.ConeGeometry(0.06, 0.14, 4)), '#f9ca24');
        sp.position.set(0, 1.42 - i * 0.18, -torsoR - 0.03 - (i > 1 ? 0.04 * (i - 1) : 0.12));
        sp.rotation.x = -0.6;
        (i < 2 ? head : body).add(sp);
        if (i < 2) sp.position.set(0, 0.1 - i * 0.12, -0.3);
      }
      const hood = mesh(g(`hood${headR}`, () => new THREE.SphereGeometry(headR * 1.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), s.body);
      hood.rotation.x = -0.3;
      head.add(hood);
      for (let i = 0; i < 4; i++) {
        const t = mesh(g('tooth', () => new THREE.ConeGeometry(0.03, 0.06, 3)), '#ffffff');
        t.rotation.x = Math.PI;
        t.position.set(-0.15 + i * 0.1, headR * 0.55, headR * 0.98);
        head.add(t);
      }
    }

    // ---------- аксессуары ----------
    const acc = look.acc || {};
    this.propeller = null;
    this.flames = null;
    if (acc.hat) this.buildHat(acc.hat, head);
    if (acc.glasses) this.buildGlasses(acc.glasses, head);
    if (acc.backpack) this.buildBackpack(acc.backpack, body, 0.9, -(robot ? 0.2 : torsoR) - 0.07);
    if (acc.watch) this.buildWatch(acc.watch, this.wrist);
    if (acc.badge) this.buildBadge(acc.badge, body, 0.98, chestZ + 0.02);
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.play('Idle');
    if (this.actions.Idle) this.actions.Idle.time = Math.random() * 2;
  }

  hidePart(name) {
    const o = this.parts[name];
    if (o) o.visible = false;
  }

  buildHat(it, head) {
    const y = this.headTopY;
    const grp = new THREE.Group();
    grp.position.y = y * 0.62;
    head.add(grp);
    const r = this.dims.headR;
    switch (it.model) {
      case 'cap': {
        const top = mesh(g(`captop${r}`, () => new THREE.SphereGeometry(r * 1.1, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)), it.color);
        const brim = mesh(g(`brim${r}`, () => new THREE.BoxGeometry(r * 1.3, 0.03, r * 0.9)), it.color);
        brim.position.set(0, 0.0, r * 1.0);
        grp.add(top, brim);
        break;
      }
      case 'beanie': {
        const top = mesh(g(`bean${r}`, () => new THREE.SphereGeometry(r * 1.12, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)), it.color);
        top.scale.y = 1.25;
        const pom = mesh(g('pom', () => new THREE.IcosahedronGeometry(0.08, 0)), it.color2);
        pom.position.y = r * 1.4;
        const band = mesh(g(`band${r}`, () => new THREE.CylinderGeometry(r * 1.13, r * 1.13, 0.08, 10)), it.color2);
        grp.add(top, pom, band);
        break;
      }
      case 'propeller': {
        const top = mesh(g(`captop${r}`, () => new THREE.SphereGeometry(r * 1.1, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)), it.color);
        const stick = mesh(g('pstick', () => new THREE.CylinderGeometry(0.015, 0.015, 0.14, 5)), '#555');
        stick.position.y = r * 1.1 + 0.05;
        const prop = new THREE.Group();
        prop.position.y = r * 1.1 + 0.12;
        [0, Math.PI].forEach((a) => {
          const b = mesh(g('blade', () => new THREE.BoxGeometry(0.22, 0.015, 0.06)), it.color2);
          b.position.x = Math.cos(a) * 0.11;
          prop.add(b);
        });
        grp.add(top, stick, prop);
        this.propeller = prop;
        break;
      }
      case 'wizard': {
        const cone = mesh(g(`wiz${r}`, () => new THREE.ConeGeometry(r * 1.05, r * 2.2, 8)), it.color);
        cone.position.y = r * 1.0;
        cone.rotation.z = 0.12;
        const brim = mesh(g(`wbrim${r}`, () => new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.03, 12)), it.color);
        const st = mesh(starGeometry(0.07, 0.03), mat(it.color2, { emissive: '#806000' }));
        st.position.set(0.12, r * 2.1, 0);
        grp.add(cone, brim, st);
        break;
      }
      case 'crown': {
        const ring = mesh(g(`crown${r}`, () => new THREE.CylinderGeometry(r * 0.85, r * 0.8, 0.14, 10, 1, true)), mat(it.color, { emissive: '#5a4500', side: THREE.DoubleSide }));
        ring.position.y = r * 0.35;
        grp.add(ring);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sp = mesh(g('cspike', () => new THREE.ConeGeometry(0.05, 0.12, 4)), mat(it.color, { emissive: '#5a4500' }));
          sp.position.set(Math.sin(a) * r * 0.82, r * 0.35 + 0.12, Math.cos(a) * r * 0.82);
          const gem = mesh(g('gem', () => new THREE.OctahedronGeometry(0.03, 0)), i % 2 ? '#e84393' : '#0984e3');
          gem.position.set(Math.sin(a) * r * 0.86, r * 0.35, Math.cos(a) * r * 0.86);
          grp.add(sp, gem);
        }
        break;
      }
      case 'headphones': {
        grp.position.y = 0;
        const band = mesh(g(`hp${r}`, () => new THREE.TorusGeometry(r * 1.1, 0.03, 4, 12, Math.PI)), it.color);
        band.rotation.y = Math.PI / 2;
        grp.add(band);
        [-1, 1].forEach((sd) => {
          const cup = mesh(g('cup', () => new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8)), it.color2);
          cup.rotation.z = Math.PI / 2;
          cup.position.set(sd * r * 1.08, 0, 0);
          grp.add(cup);
        });
        break;
      }
      default: break;
    }
  }

  buildGlasses(it, head) {
    const z = this.faceZ + 0.03;
    const r = this.dims.headR;
    const y = r * 0.08;
    const grp = new THREE.Group();
    grp.position.set(0, y, z);
    head.add(grp);
    const ex = r * 0.33;
    const bridge = mesh(g('bridge', () => new THREE.BoxGeometry(0.08, 0.015, 0.015)), it.color);
    grp.add(bridge);
    if (it.model === 'round') {
      [-1, 1].forEach((sd) => {
        const t = mesh(g('lens', () => new THREE.TorusGeometry(0.07, 0.015, 4, 10)), it.color);
        t.position.x = sd * ex;
        grp.add(t);
      });
    } else if (it.model === 'sun') {
      [-1, 1].forEach((sd) => {
        const t = mesh(g('sunl', () => new THREE.BoxGeometry(0.15, 0.09, 0.02)), '#111');
        t.position.x = sd * ex;
        grp.add(t);
      });
    } else if (it.model === 'threeD') {
      const frame = mesh(g('3dframe', () => new THREE.BoxGeometry(0.42, 0.13, 0.02)), '#fff');
      grp.add(frame);
      [['#ff3838', -1], ['#17c0eb', 1]].forEach(([c, sd]) => {
        const l = mesh(g('3dl', () => new THREE.BoxGeometry(0.14, 0.08, 0.02)), mat(c, { emissive: c, transparent: true, opacity: 0.85 }));
        l.position.set(sd * ex, 0, 0.005);
        grp.add(l);
      });
    } else if (it.model === 'star') {
      [-1, 1].forEach((sd) => {
        const s = mesh(starGeometry(0.1, 0.02), it.color);
        s.position.x = sd * ex;
        grp.add(s);
      });
    }
  }

  buildBackpack(it, body, y, z) {
    const grp = new THREE.Group();
    grp.position.set(0, y, z);
    body.add(grp);
    this.backpackGroup = grp;
    if (it.model === 'teddy') {
      const b = mesh(g('teddyb', () => new THREE.IcosahedronGeometry(0.2, 1)), it.color);
      b.scale.set(1, 1.15, 0.7);
      const head = mesh(g('teddyh', () => new THREE.IcosahedronGeometry(0.12, 1)), it.color);
      head.position.set(0, 0.25, -0.03);
      [-1, 1].forEach((sd) => {
        const ear = mesh(g('teddye', () => new THREE.IcosahedronGeometry(0.05, 0)), it.color2);
        ear.position.set(sd * 0.09, 0.35, -0.03);
        grp.add(ear);
      });
      const snout = mesh(g('teddys', () => new THREE.IcosahedronGeometry(0.05, 0)), it.color2);
      snout.position.set(0, 0.22, -0.13);
      grp.add(b, head, snout);
      return;
    }
    if (it.model === 'rocket') {
      [-1, 1].forEach((sd) => {
        const c = mesh(g('rocketc', () => new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8)), it.color);
        c.position.set(sd * 0.11, 0, -0.04);
        const tip = mesh(g('rockett', () => new THREE.ConeGeometry(0.09, 0.16, 8)), it.color2);
        tip.position.set(sd * 0.11, 0.28, -0.04);
        grp.add(c, tip);
      });
      const fl = new THREE.Group();
      [-1, 1].forEach((sd) => {
        const f = mesh(g('flame', () => new THREE.ConeGeometry(0.07, 0.3, 6)), mat('#ffa502', { emissive: '#ff4500' }));
        f.rotation.x = Math.PI;
        f.position.set(sd * 0.11, -0.35, -0.04);
        fl.add(f);
      });
      fl.visible = false;
      grp.add(fl);
      this.flames = fl;
      return;
    }
    const b = mesh(g('bpbody', () => new THREE.BoxGeometry(0.4, 0.46, 0.18)), it.color);
    const pocket = mesh(g('bppocket', () => new THREE.BoxGeometry(0.28, 0.18, 0.06)), it.color2);
    pocket.position.set(0, -0.1, -0.1);
    const flap = mesh(g('bpflap', () => new THREE.BoxGeometry(0.42, 0.1, 0.2)), it.color2);
    flap.position.y = 0.2;
    grp.add(b, pocket, flap);
    if (it.model === 'star') {
      const s = mesh(starGeometry(0.1, 0.03), mat(it.color2, { emissive: '#8a6d00' }));
      s.position.set(0, 0.05, -0.13);
      grp.add(s);
    }
  }

  buildWatch(it, wrist) {
    const w = mesh(g('watch', () => new THREE.BoxGeometry(0.13, 0.05, 0.13)), it.color);
    w.position.set(0.33, 0.69, 0);
    wrist.add(w);
    if (it.model === 'smart') {
      const f = mesh(g('wface', () => new THREE.BoxGeometry(0.02, 0.06, 0.08)), mat('#81ecec', { emissive: '#00cec9' }));
      f.position.set(0.4, 0.69, 0);
      wrist.add(f);
    }
  }

  buildBadge(it, body, y, z) {
    let b;
    if (it.model === 'star') b = mesh(starGeometry(0.06, 0.02), mat(it.color, { emissive: '#6b5200' }));
    else if (it.model === 'heart') b = mesh(heartGeometry(0.06), it.color);
    else if (it.model === 'medal') {
      const rib = mesh(g('ribbon', () => new THREE.BoxGeometry(0.06, 0.12, 0.01)), '#0984e3');
      rib.position.set(0.12, y + 0.04, z);
      body.add(rib);
      b = mesh(g('medal', () => new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10)), mat(it.color, { emissive: '#5a4500' }));
      b.rotation.x = Math.PI / 2;
      b.position.set(0.12, y - 0.05, z + 0.01);
      body.add(b);
      return;
    } else {
      b = mesh(g('rbadge', () => new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10)), it.color);
      b.rotation.x = Math.PI / 2;
    }
    b.position.set(0.12, y, z);
    body.add(b);
  }

  // Плавное переключение анимаций из Blender (кроссфейд)
  play(name, ts = 1) {
    const a = this.actions && this.actions[name];
    if (!a) return;
    a.timeScale = ts;
    if (this.cur === name) return;
    const prev = this.actions[this.cur];
    a.reset().setEffectiveWeight(1).fadeIn(0.22).play();
    if (prev) prev.fadeOut(0.22);
    this.cur = name;
  }

  // speed: 0..1.5 (относительная скорость), opts: onGround, running
  animate(dt, speed, opts = {}) {
    if (!this.mixer) return;
    this.t += dt;
    const { onGround = true, running = false } = opts;
    let st = 'Idle', ts = 1;
    if (this.pose === 'sit') st = 'Sit';
    else if (!onGround) st = 'Jump';
    else if (this.push > 0) st = 'Push';
    else if (speed > 0.08) {
      const run = running || speed > 1.25;
      st = run ? 'Run' : 'Walk';
      ts = run ? Math.max(0.75, speed / 1.45) : Math.max(0.6, speed * 1.05);
    } else if (this.wave > 0 || this.pose === 'wave') st = 'Wave';
    else if (this.pose === 'cheer') st = 'Cheer';
    this.play(st, ts);
    if (this.wave > 0) this.wave -= dt;
    if (this.push > 0) this.push -= dt;
    if (this.root.visible) {
      this.mixer.update(dt);
      if (this.headScale !== 1 && this.bones.head) this.bones.head.scale.setScalar(this.headScale);
      // пригнувшись (хоррор-режим): поверх анимации сгибаем колени и спину
      this.crouchK = (this.crouchK || 0) + ((this.crouch ? 1 : 0) - (this.crouchK || 0)) * Math.min(1, dt * 8);
      const k = this.crouchK, B = this.bones;
      if (k > 0.01 && B.hips) {
        B.hips.position.y -= 0.2 * k;
        B.spine.rotation.x += 0.45 * k;
        B.head.rotation.x -= 0.3 * k;
        B.thighL.rotation.x -= 0.9 * k; B.thighR.rotation.x -= 0.9 * k;
        B.shinL.rotation.x += 1.3 * k; B.shinR.rotation.x += 1.3 * k;
        B.footL.rotation.x -= 0.4 * k; B.footR.rotation.x -= 0.4 * k;
      }
    }
    if (this.propeller) this.propeller.rotation.y += dt * (4 + speed * 30);
    if (this.cape) this.cape.rotation.x = 0.1 + speed * 0.6 + Math.sin(this.t * 6) * 0.05 * (0.3 + speed);
    if (this.tail) this.tail.rotation.y = Math.sin(this.t * (3 + speed * 6)) * 0.3;
    if (this.flames) {
      this.flames.visible = !onGround;
      this.flames.scale.y = 0.8 + Math.random() * 0.5;
    }
  }

  dispose() { disposeObject(this.root); }
}
