import * as THREE from 'three';
import { mat, mesh, disposeObject } from '../core/gfx.js';

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
    this.t = 0;
    this.pose = 'stand';
    this.wave = 0;
    if (look) this.build(look);
  }

  clear() {
    for (const c of [...this.root.children]) {
      this.root.remove(c);
      c.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    }
  }

  build(look) {
    this.clear();
    this.look = look;
    const s = look.skin;
    const shape = s.shape || 'normal';
    let legLen = 0.5, torsoH = 0.55, torsoR = 0.24, headR = 0.3, armLen = 0.45;
    if (shape === 'tall') { legLen = 0.72; torsoH = 0.62; armLen = 0.55; }
    if (shape === 'mini') { legLen = 0.32; torsoH = 0.42; headR = 0.34; armLen = 0.36; }
    if (shape === 'round') { torsoR = 0.36; torsoH = 0.6; }
    const hipY = legLen + 0.08;
    this.dims = { legLen, torsoH, torsoR, headR, hipY };

    const body = new THREE.Group();
    this.root.add(body);
    this.body = body;

    // ноги
    this.legs = [-1, 1].map((side) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.11 * (shape === 'round' ? 1.3 : 1), hipY, 0);
      const l = mesh(g(`leg${legLen}`, () => new THREE.BoxGeometry(0.17, legLen, 0.19)), s.pants);
      l.position.y = -legLen / 2;
      const shoe = mesh(g('shoe', () => new THREE.BoxGeometry(0.19, 0.1, 0.28)), s.shoes);
      shoe.position.set(0, -legLen - 0.03, 0.04);
      leg.add(l, shoe);
      if (s.extra === 'stripes') {
        const st = mesh(g(`stripe${legLen}`, () => new THREE.BoxGeometry(0.02, legLen * 0.9, 0.05)), '#ffffff');
        st.position.set(side * 0.09, -legLen / 2, 0);
        leg.add(st);
      }
      body.add(leg);
      return leg;
    });

    // туловище
    let torso;
    if (shape === 'robot') torso = mesh(g('rtorso', () => new THREE.BoxGeometry(0.52, torsoH, 0.36)), s.body);
    else torso = mesh(g(`torso${torsoR}_${torsoH}`, () => new THREE.CylinderGeometry(torsoR * 0.88, torsoR, torsoH, 8)), s.body);
    torso.position.y = hipY + torsoH / 2;
    body.add(torso);
    this.torso = torso;
    const chestZ = shape === 'robot' ? 0.19 : torsoR * 0.95;
    const shoulderY = hipY + torsoH - 0.06;

    // руки
    this.arms = [-1, 1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * (torsoR + 0.08), shoulderY, 0);
      const a = mesh(g(`arm${armLen}`, () => new THREE.BoxGeometry(0.12, armLen, 0.12)), s.body);
      a.position.y = -armLen / 2;
      const hand = mesh(g('hand', () => new THREE.IcosahedronGeometry(0.075, 0)), shape === 'robot' ? '#7f8c8d' : s.skinTone);
      hand.position.y = -armLen - 0.03;
      arm.add(a, hand);
      arm.userData.len = armLen;
      body.add(arm);
      return arm;
    });

    // голова
    const head = new THREE.Group();
    head.position.y = hipY + torsoH + headR * 0.92;
    body.add(head);
    this.head = head;
    if (shape === 'robot') {
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
    } else {
      head.add(mesh(g(`head${headR}`, () => new THREE.IcosahedronGeometry(headR, 1)), s.skinTone));
      [-1, 1].forEach((sd) => {
        const eye = mesh(g('eye', () => new THREE.SphereGeometry(0.045, 6, 5)), '#1e1e2e');
        eye.position.set(sd * headR * 0.33, headR * 0.08, headR * 0.88);
        const hl = mesh(g('eyehl', () => new THREE.SphereGeometry(0.015, 4, 3)), '#ffffff');
        hl.position.set(sd * headR * 0.33 + 0.012, headR * 0.13, headR * 0.88 + 0.035);
        const cheek = mesh(g('cheek', () => new THREE.SphereGeometry(0.045, 6, 4)), '#ff9a9e');
        cheek.scale.set(1, 0.6, 0.3);
        cheek.position.set(sd * headR * 0.55, -headR * 0.22, headR * 0.78);
        head.add(eye, hl, cheek);
      });
      const mouth = mesh(g('mouth', () => new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI)), '#c0392b');
      mouth.rotation.z = Math.PI;
      mouth.position.set(0, -headR * 0.3, headR * 0.92);
      head.add(mouth);
      // волосы
      const hair = mesh(g(`hair${headR}`, () => new THREE.SphereGeometry(headR * 1.07, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)), s.hair);
      hair.rotation.x = -0.25;
      hair.position.y = headR * 0.05;
      const fringe = mesh(g(`fringe${headR}`, () => new THREE.BoxGeometry(headR * 1.5, headR * 0.25, headR * 0.3)), s.hair);
      fringe.position.set(0, headR * 0.62, headR * 0.72);
      fringe.rotation.x = 0.4;
      head.add(hair, fringe);
      this.headTopY = headR * 1.02;
      this.faceZ = headR * 0.95;
    }

    // особые детали образа
    const ex = s.extra;
    if (ex === 'tie') {
      const t = mesh(g('tie', () => new THREE.BoxGeometry(0.07, 0.26, 0.03)), '#d63031');
      t.position.set(0, hipY + torsoH - 0.18, chestZ);
      const collar = mesh(g('collar', () => new THREE.BoxGeometry(0.2, 0.05, 0.04)), '#ffffff');
      collar.position.set(0, hipY + torsoH - 0.03, chestZ - 0.04);
      body.add(t, collar);
    }
    if (ex === 'leaf') {
      const l = mesh(g('leafb', () => new THREE.OctahedronGeometry(0.08, 0)), '#ffffff');
      l.scale.set(1, 1.4, 0.3);
      l.position.set(0, hipY + torsoH * 0.6, chestZ);
      body.add(l);
    }
    if (ex === 'number') {
      const n = mesh(g('num', () => new THREE.BoxGeometry(0.24, 0.24, 0.02)), '#ffffff');
      n.position.set(0, hipY + torsoH * 0.55, chestZ);
      body.add(n);
    }
    if (ex === 'dots') {
      for (let i = 0; i < 6; i++) {
        const d = mesh(g('dot', () => new THREE.SphereGeometry(0.03, 4, 3)), '#ffffff');
        const a = (i / 6) * Math.PI * 2;
        d.position.set(Math.sin(a) * torsoR, hipY + 0.15 + (i % 3) * 0.15, Math.cos(a) * torsoR);
        body.add(d);
      }
    }
    if (ex === 'robe') {
      const robe = mesh(g(`robe${hipY}`, () => new THREE.CylinderGeometry(0.26, 0.42, hipY + torsoH * 0.6, 8)), s.body);
      robe.position.y = (hipY + torsoH * 0.6) / 2 + 0.02;
      body.add(robe);
      for (let i = 0; i < 4; i++) {
        const st = mesh(starGeometry(0.05, 0.02), mat('#feca57', { emissive: '#7a5c00' }));
        const a = i * 1.6 + 0.4;
        st.position.set(Math.sin(a) * 0.36, 0.25 + i * 0.12, Math.cos(a) * 0.36);
        st.lookAt(st.position.x * 2, st.position.y, st.position.z * 2);
        body.add(st);
      }
    }
    if (ex === 'cape') {
      const capeG = new THREE.Group();
      capeG.position.set(0, shoulderY + 0.03, -torsoR - 0.02);
      const c = mesh(g(`cape${hipY}`, () => new THREE.BoxGeometry(0.55, hipY + torsoH - 0.2, 0.03)), '#d63031');
      c.position.y = -(hipY + torsoH - 0.2) / 2;
      capeG.add(c);
      body.add(capeG);
      this.cape = capeG;
      const emb = mesh(starGeometry(0.08, 0.02), '#fdcb6e');
      emb.position.set(0, hipY + torsoH * 0.6, chestZ);
      body.add(emb);
    } else this.cape = null;
    if (ex === 'astro') {
      const helmet = new THREE.Mesh(g(`helmet${headR}`, () => new THREE.SphereGeometry(headR * 1.35, 12, 9)), mat('#a8e6ff', { transparent: true, opacity: 0.35 }));
      head.add(helmet);
      const pack = mesh(g('astropack', () => new THREE.BoxGeometry(0.42, 0.5, 0.2)), '#dfe6e9');
      pack.position.set(0, hipY + torsoH / 2 + 0.05, -torsoR - 0.1);
      const flag = mesh(g('flag', () => new THREE.BoxGeometry(0.12, 0.08, 0.02)), '#0984e3');
      flag.position.set(0.12, hipY + torsoH * 0.7, chestZ);
      body.add(pack, flag);
    }
    if (ex === 'dino') {
      const tail = mesh(g('tail', () => new THREE.ConeGeometry(0.16, 0.7, 6)), s.body);
      tail.rotation.x = -Math.PI / 2 - 0.5;
      tail.position.set(0, hipY - 0.05, -0.45);
      body.add(tail);
      this.tail = tail;
      for (let i = 0; i < 5; i++) {
        const sp = mesh(g('spike', () => new THREE.ConeGeometry(0.06, 0.14, 4)), '#f9ca24');
        sp.position.set(0, hipY + torsoH + 0.35 - i * 0.2, -torsoR - 0.02 - (i > 2 ? 0.05 * (i - 2) : 0));
        sp.rotation.x = -0.6;
        body.add(sp);
      }
      const hood = mesh(g(`hood${headR}`, () => new THREE.SphereGeometry(headR * 1.12, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55)), s.body);
      hood.rotation.x = -0.3;
      head.add(hood);
      for (let i = 0; i < 4; i++) {
        const t = mesh(g('tooth', () => new THREE.ConeGeometry(0.03, 0.06, 3)), '#ffffff');
        t.rotation.x = Math.PI;
        t.position.set(-0.15 + i * 0.1, headR * 0.55, headR * 0.98);
        head.add(t);
      }
    } else this.tail = null;

    // ---------- аксессуары ----------
    const acc = look.acc || {};
    this.propeller = null;
    this.flames = null;
    if (acc.hat) this.buildHat(acc.hat, head);
    if (acc.glasses) this.buildGlasses(acc.glasses, head);
    if (acc.backpack) this.buildBackpack(acc.backpack, body, hipY + torsoH * 0.55, -(shape === 'robot' ? 0.18 : torsoR) - 0.06);
    if (acc.watch) this.buildWatch(acc.watch, this.arms[0]);
    if (acc.badge) this.buildBadge(acc.badge, body, hipY + torsoH * 0.72, chestZ + 0.01);

    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
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

  buildWatch(it, arm) {
    const w = mesh(g('watch', () => new THREE.BoxGeometry(0.14, 0.06, 0.14)), it.color);
    w.position.y = -arm.userData.len + 0.05;
    arm.add(w);
    if (it.model === 'smart') {
      const f = mesh(g('wface', () => new THREE.BoxGeometry(0.06, 0.07, 0.08)), mat('#81ecec', { emissive: '#00cec9' }));
      f.position.set(-0.05, -arm.userData.len + 0.05, 0);
      arm.add(f);
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

  // speed: 0..1 (относительная скорость), opts: onGround, running
  animate(dt, speed, opts = {}) {
    if (!this.body) return;
    this.t += dt;
    const { onGround = true, running = false } = opts;
    const legs = this.legs, arms = this.arms;
    if (this.pose === 'sit') {
      legs.forEach((l) => (l.rotation.x = -1.45));
      arms.forEach((a, i) => (a.rotation.x = -0.9 + Math.sin(this.t * 2 + i) * 0.03));
      this.body.position.y = 0.5 - this.dims.hipY;
      this.head.rotation.x = 0.1;
      return;
    }
    this.body.position.y = 0;
    this.head.rotation.x = 0;
    if (!onGround) {
      legs[0].rotation.x = -0.6; legs[1].rotation.x = 0.3;
      arms[0].rotation.x = -2.6; arms[1].rotation.x = -2.6;
      arms[0].rotation.z = 0.2; arms[1].rotation.z = -0.2;
    } else if (speed > 0.05) {
      this.phase += dt * (running ? 13 : 9.5);
      const sw = Math.sin(this.phase) * (running ? 0.9 : 0.65) * Math.min(1, speed * 1.4);
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw;
      arms[0].rotation.x = -sw * 0.8; arms[1].rotation.x = sw * 0.8;
      arms[0].rotation.z = 0.08; arms[1].rotation.z = -0.08;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05;
    } else {
      const b = Math.sin(this.t * 2.2);
      legs.forEach((l) => (l.rotation.x *= 0.8));
      arms[0].rotation.x = b * 0.04; arms[1].rotation.x = -b * 0.04;
      arms[0].rotation.z = 0.08 + b * 0.02; arms[1].rotation.z = -0.08 - b * 0.02;
      this.body.position.y = b * 0.01;
      if (this.wave > 0 || this.pose === 'wave') {
        arms[1].rotation.x = -2.8;
        arms[1].rotation.z = -0.3 + Math.sin(this.t * 10) * 0.35;
      }
    }
    if (this.wave > 0) this.wave -= dt;
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
