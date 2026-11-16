import * as THREE from 'three';
import { Assets } from '../core/Assets.js';
import { angleDamp } from '../core/gfx.js';

// Монстры хоррор-режима. Модели и анимации — из Blender (blender/monsters.py):
// Idle, Walk, Chase, Attack, Scream, Appear, Search.
const tmpV = new THREE.Vector3();

class MonsterBase {
  constructor(mode, kind) {
    this.mode = mode;
    this.kind = kind;
    const inst = Assets.instance(kind);
    this.root = new THREE.Group();
    this.model = inst.scene;
    this.root.add(this.model);
    this.mixer = inst.mixer;
    this.actions = inst.actions;
    this.cur = null;
    this.pos = this.root.position;
    this.yaw = 0;
    this.stepAcc = 0;
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name.replace(/[^a-zA-Z]/g, '')] = o; });
    mode.scene.addObj(this.root);
  }

  play(name, { once = false, ts = 1, fade = 0.2 } = {}) {
    const a = this.actions[name];
    if (!a) return;
    a.timeScale = ts;
    if (this.cur === name && !once) return;
    const prev = this.actions[this.cur];
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once;
    a.setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== a) prev.fadeOut(fade);
    this.cur = name;
  }

  face(x, z, dt, k = 8) {
    this.yaw = angleDamp(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), k, dt);
    this.root.rotation.y = this.yaw;
  }

  stepTo(x, z, speed, dt, collide = true) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) return 0;
    const s = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * s;
    this.pos.z += (dz / d) * s;
    if (collide) this.mode.scene.world.resolve(this.pos, 0.36, 2.2);
    this.face(x, z, dt);
    this.stepAcc += s;
    return d;
  }

  distToPlayer() { const p = this.mode.game.player.pos; return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  remove() { this.root.removeFromParent(); this.mixer.stopAllAction(); }
}

// ======================================================================= УЧИТЕЛЬ
export class Teacher extends MonsterBase {
  constructor(mode, x, z) {
    super(mode, 'teacher');
    this.pos.set(x, 0, z);
    this.state = 'patrol';
    this.aware = 0;
    this.path = [];
    this.goal = null;
    this.lastSeen = new THREE.Vector3();
    this.lostT = 0;
    this.stateT = 0;
    this.senseT = 0;
    this.screamCd = 0;
    this.attackHit = false;
    this.patrolIdx = Math.floor(Math.random() * 10);
    this.play('Walk');
  }

  get diff() { return this.mode.diff; }

  setState(s) { this.state = s; this.stateT = 0; }

  goTo(x, z) {
    const S = this.mode.scene;
    const a = S.nearestNode(this.pos.x, this.pos.z), b = S.nearestNode(x, z);
    const p = a && b ? S.path(a.id, b.id) : null;
    this.path = p ? p.map((e) => ({ x: e.node.x, z: e.node.z, door: e.door })) : [];
    this.path.push({ x, z, door: null });
    this.goal = { x, z };
  }

  // идёт по пути; открывает двери; возвращает true, когда дошёл
  follow(speed, dt) {
    const S = this.mode.scene;
    while (this.path.length) {
      const w = this.path[0];
      for (const d of S.doors) {
        if (d.locked || d.target) continue;
        if (Math.hypot(d.x - this.pos.x, d.z - this.pos.z) < 1.8) S.setDoor(d, true);
      }
      if (w.door && !w.door.locked && w.door.open < 0.5 && Math.hypot(w.door.x - this.pos.x, w.door.z - this.pos.z) < 1.9) {
        S.setDoor(w.door, true);
        this.face(w.x, w.z, dt);
        return false; // ждёт, пока дверь откроется
      }
      const d = this.stepTo(w.x, w.z, speed, dt);
      if (d < 0.55) { this.path.shift(); continue; }
      return false;
    }
    return true;
  }

  sense(dt) {
    const M = this.mode, g = M.game, p = g.player.pos, S = M.scene;
    const d = this.distToPlayer();
    let seen = false;
    if (!M.hidden && !M.dead) {
      const lit = S.lightAt(p.x, p.z);
      let range = this.diff.sight * (M.flashOn && M.battery > 0 ? 1 : 0.55 + lit * 0.45) * (M.crouch ? 0.72 : 1);
      if (this.state === 'chase') range *= 1.4;
      const ang = Math.atan2(p.x - this.pos.x, p.z - this.pos.z) - this.yaw;
      const a = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
      if (d < range && (a < 1.05 || d < 2.6 || this.state === 'chase') && S.los(this.pos.x, 1.9, this.pos.z, p.x, p.y + 1.2, p.z)) seen = true;
      if (seen) {
        this.aware = Math.min(1.5, this.aware + dt * (0.6 + 3 * (1 - d / range)) * (this.diff.speed));
        this.lastSeen.copy(p);
        this.lostT = 0;
      }
    }
    if (!seen) this.aware = Math.max(0, this.aware - dt * 0.12);
    // слух
    for (const n of M.noises) {
      if (n.t < this.lastNoiseT) continue;
      const nd = Math.hypot(n.x - this.pos.x, n.z - this.pos.z);
      if (nd < n.r * this.diff.hear) {
        this.aware = Math.min(1.5, this.aware + (n.loud ? 0.6 : 0.3) * (1 - nd / (n.r * this.diff.hear + 0.01)) + 0.1);
        if (this.state !== 'chase' && this.state !== 'attack' && this.state !== 'ambush') {
          this.setState('investigate');
          this.goTo(n.x, n.z);
          if (this.aware >= 1 && nd < 10) { this.lastSeen.set(n.x, 0, n.z); this.startChase(); }
        }
      }
    }
    this.lastNoiseT = performance.now();
    return seen;
  }

  startChase() {
    if (this.state === 'chase') return;
    const M = this.mode;
    this.setState('chase');
    if (this.screamCd <= 0) {
      this.screamCd = 25;
      this.play('Scream', { once: true });
      this.screaming = 0.9;
      M.audio.at('scream', this.pos);
      M.onDetected(this);
    }
  }

  update(dt) {
    const M = this.mode, g = M.game, p = g.player.pos;
    this.mixer.update(dt);
    this.stateT += dt;
    this.screamCd -= dt;
    this.senseT -= dt;
    let seen = this.lastSeenNow;
    if (this.senseT <= 0) { this.senseT = 0.12; seen = this.lastSeenNow = this.sense(0.12); }
    const sp = this.diff.speed;
    const d = this.distToPlayer();
    if (this.screaming > 0) { this.screaming -= dt; this.face(p.x, p.z, dt); return; }
    switch (this.state) {
      case 'patrol': {
        if (this.aware >= 1) { this.startChase(); break; }
        if (!this.path.length || this.stateT > 40) {
          this.stateT = 0;
          const nodes = [...M.scene.nav.nodes.values()];
          let n;
          if (this.diff.shuffle || Math.random() < 0.3) n = nodes[Math.floor(Math.random() * nodes.length)];
          else { this.patrolIdx = (this.patrolIdx + 3) % nodes.length; n = nodes[this.patrolIdx]; }
          // чаще идёт туда, где игрок недавно шумел/был
          if (Math.random() < 0.25 + M.diffIndex * 0.1) n = M.scene.nearestNode(p.x + (Math.random() - 0.5) * 12, p.z + (Math.random() - 0.5) * 8);
          this.goTo(n.x, n.z);
        }
        this.play('Walk', { ts: 0.9 * sp });
        if (this.follow(1.5 * sp, dt)) { this.setState('search'); this.path = []; }
        break;
      }
      case 'investigate': {
        if (this.aware >= 1 && seen) { this.startChase(); break; }
        this.play('Walk', { ts: 1.35 * sp });
        if (this.follow(2.5 * sp, dt) || this.stateT > 25) this.setState('search');
        break;
      }
      case 'search': {
        this.play('Search');
        if (seen && this.aware >= 0.8) { this.startChase(); break; }
        if (this.stateT > 4 + Math.random() * 3) { this.setState('patrol'); this.path = []; }
        break;
      }
      case 'chase': {
        // проверка шкафчика, если видел, как игрок спрятался
        if (M.hidden) {
          if (this.diff.checkLockers && M.hidden.seenBy === this) {
            const L = M.hidden;
            this.play('Chase', { ts: sp });
            if (this.stepTo(L.out.x, L.out.z, 4 * sp, dt) < 0.9) { M.pullOut(this); this.setState('attack'); this.play('Attack', { once: true }); this.attackHit = true; }
            break;
          }
          this.setState('search');
          this.goTo(this.lastSeen.x, this.lastSeen.z);
          break;
        }
        if (seen) this.lostT = 0; else this.lostT += dt;
        if (this.lostT > this.diff.memory) { this.setState('search'); this.aware = 0.5; this.goTo(this.lastSeen.x, this.lastSeen.z); break; }
        this.play('Chase', { ts: 0.9 + 0.25 * sp });
        const speed = (4.1 + M.diffIndex * 0.25) * sp * (M.boss ? 0.9 : 1);
        if (seen && M.scene.los(this.pos.x, 1.2, this.pos.z, p.x, 1.2, p.z)) {
          this.path = [];
          this.stepTo(p.x, p.z, speed, dt);
        } else {
          if (!this.path.length || this.repathT <= 0) { this.goTo(this.lastSeen.x, this.lastSeen.z); this.repathT = 0.6; }
          this.repathT -= dt;
          this.follow(speed, dt);
        }
        if (d < 1.35 && !M.hidden) { this.setState('attack'); this.play('Attack', { once: true, ts: 1.1 + M.diffIndex * 0.1 }); this.attackHit = false; }
        break;
      }
      case 'attack': {
        this.face(p.x, p.z, dt, 12);
        if (!this.attackHit && this.stateT > 0.3) {
          this.attackHit = true;
          if (this.distToPlayer() < 2 && !M.hidden) M.damage(32 * this.diff.damage, this);
        }
        if (this.stateT > 0.85) { this.setState('stunned'); this.play('Idle'); }
        break;
      }
      case 'stunned': {
        if (this.stateT > 2.2 - M.diffIndex * 0.25) { this.setState('chase'); this.lostT = 0; }
        break;
      }
      case 'ambush': {
        this.play('Idle');
        const door = this.ambushDoor;
        if (door && door.open > 0.6 && d < 5) {
          this.setState('appear');
          this.play('Appear', { once: true, ts: 1.3 });
          M.audio.at('scream', this.pos);
          M.fx.screamer('teacher');
        } else if (this.stateT > 30) this.setState('patrol');
        break;
      }
      case 'appear': {
        this.face(p.x, p.z, dt);
        if (this.stateT > 1.2) { this.aware = 1.2; this.lastSeen.copy(p); this.setState('chase'); this.lostT = 0; }
        break;
      }
      default: break;
    }
    // шаги
    if (this.stepAcc > (this.state === 'chase' ? 1.1 : 0.8)) { this.stepAcc = 0; M.audio.at('mstep', this.pos, { heavy: this.state === 'chase' }); }
    // учитель бормочет, когда рядом
    this.mumbleT = (this.mumbleT || 3) - dt;
    if (this.mumbleT <= 0 && d < 14) { this.mumbleT = 4 + Math.random() * 6; M.audio.at('mumble', this.pos); }
  }

  // засада за дверью кабинета
  ambush(room) {
    const S = this.mode.scene;
    const door = S.doors.find((d) => d.id === 'd_' + room.id);
    if (!door || door.locked) return false;
    S.setDoor(door, false);
    door.open = 0; door.target = 0;
    door.leaf.parent.rotation.y = 0;
    this.pos.set(room.doorX, 0, room.side * 3.4);
    this.yaw = room.side > 0 ? Math.PI : 0;
    this.root.rotation.y = this.yaw;
    this.ambushDoor = door;
    this.path = [];
    this.setState('ambush');
    return true;
  }
}

// ======================================================================= ТЕНЬ
export class Shadow extends MonsterBase {
  constructor(mode) {
    super(mode, 'shadow');
    this.mats = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData = { own: true };
      o.material.transparent = true;
      o.castShadow = false;
      this.mats.push(o.material);
    });
    this.state = 'dormant';
    this.timer = 12 + Math.random() * 20;
    this.seen = 0;
    this.opacity = 0;
    this.root.visible = false;
    this.play('Idle');
  }

  observed() {
    const M = this.mode, g = M.game, S = M.scene;
    const cam = g.camera;
    cam.getWorldDirection(tmpV);
    const to = new THREE.Vector3(this.pos.x - cam.position.x, this.pos.y + 1.5 - cam.position.y, this.pos.z - cam.position.z);
    const dist = to.length();
    to.normalize();
    const ang = Math.acos(Math.min(1, tmpV.dot(to)));
    if (ang > 0.42) return false;
    const lit = (M.flashOn && M.battery > 0 && dist < 17 && ang < 0.32) || S.lightAt(this.pos.x, this.pos.z) > 0.35 || dist < 3.5;
    if (!lit) return false;
    return S.los(cam.position.x, cam.position.y, cam.position.z, this.pos.x, 1.5, this.pos.z);
  }

  spawn(behind = false) {
    const M = this.mode, p = M.game.player.pos, S = M.scene;
    let best = null;
    for (let k = 0; k < 30; k++) {
      const a = behind ? M.game.cam.yaw + (Math.random() - 0.5) * 0.8 : Math.random() * Math.PI * 2;
      const r = behind ? 1.2 : 7 + Math.random() * 7;
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (S.world.pointBlocked(x, 1, z, 0.3)) continue;
      if (!behind && S.lightAt(x, z) > 0.3) continue;
      best = { x, z };
      break;
    }
    if (!best) return false;
    this.pos.set(best.x, 0, best.z);
    this.state = 'stalk';
    this.seen = 0;
    this.root.visible = true;
    this.play('Appear', { once: true, ts: 1.5 });
    this.appearT = 0.8;
    M.audio.at('whisper', this.pos);
    return true;
  }

  vanish(quick = false) {
    this.state = 'fade';
    this.fadeT = quick ? 0.25 : 0.8;
    this.mode.audio.at('hiss', this.pos);
    this.mode.fx.smoke(this.pos);
  }

  update(dt) {
    const M = this.mode, p = M.game.player.pos;
    this.mixer.update(dt);
    const need = 1.3 + M.diffIndex * 0.35;
    if (this.state === 'dormant') {
      this.opacity = 0;
      this.timer -= dt * (M.blackout ? 2 : 1) * M.diff.events;
      if (this.timer <= 0 && !M.hidden && !M.puzzleOpen) { if (!this.spawn()) this.timer = 3; }
    } else if (this.state === 'stalk') {
      this.opacity = Math.min(0.92, this.opacity + dt * 2) * (0.85 + Math.random() * 0.15);
      if (this.appearT > 0) { this.appearT -= dt; }
      const obs = this.observed();
      const d = this.distToPlayer();
      if (obs) {
        this.seen += dt;
        this.play('Idle', { ts: 0.2 });
        this.face(p.x, p.z, dt, 3);
        M.shadowWatched = true;
        if (this.seen > need) this.vanish();
      } else if (this.appearT <= 0) {
        this.seen = Math.max(0, this.seen - dt * 0.3);
        const speed = (1.4 + M.diffIndex * 0.3) * M.diff.speed;
        this.play('Walk', { ts: 1.4 });
        this.stepTo(p.x, p.z, speed, dt, false); // Тени проходят сквозь стены
        // внезапно оказывается прямо за спиной
        if (d < 7 && d > 2 && Math.random() < dt * (0.05 + M.diffIndex * 0.03)) {
          const yaw = M.game.cam.yaw;
          this.pos.set(p.x + Math.sin(yaw) * 0.9, 0, p.z + Math.cos(yaw) * 0.9);
          M.audio.at('whisper', this.pos, { close: true });
        }
      }
      if (d < 0.9 && !M.hidden) {
        this.play('Attack', { once: true });
        M.damage(18 * M.diff.damage, this, { shadow: true });
        this.vanish(true);
      }
      if (M.hidden && d < 2) this.vanish();
    } else if (this.state === 'fade') {
      this.fadeT -= dt;
      this.opacity = Math.max(0, this.opacity - dt * 1.6);
      this.pos.y += dt * 0.6;
      if (this.fadeT <= 0) {
        this.state = 'dormant';
        this.root.visible = false;
        this.pos.y = 0;
        this.timer = (20 + Math.random() * 25) / M.diff.events;
      }
    }
    for (const m of this.mats) m.opacity = this.opacity;
  }
}

// ======================================================================= ДИРЕКТОР (босс)
export class Headmaster extends MonsterBase {
  constructor(mode, x, z) {
    super(mode, 'headmaster');
    this.pos.set(x, 0, z);
    this.stage = 1;
    this.state = 'idle';
    this.stateT = 0;
    this.dashCd = 4;
    this.attackHit = false;
    this.play('Idle');
  }

  inHall(p) { return p.x > 44.4 && p.x < 68 && Math.abs(p.z) < 12; }

  roar() {
    this.state = 'roar';
    this.stateT = 0;
    this.play('Scream', { once: true });
    this.mode.audio.at('roar', this.pos);
    this.mode.game.cam.shake = 0.35;
  }

  teleportNear() {
    const p = this.mode.game.player.pos, yaw = this.mode.game.cam.yaw;
    const x = Math.min(67, Math.max(45, p.x + Math.sin(yaw) * 2.6)), z = Math.max(-11, Math.min(11, p.z + Math.cos(yaw) * 2.6));
    this.pos.set(x, 0, z);
    this.play('Appear', { once: true, ts: 1.6 });
    this.state = 'appear';
    this.stateT = 0;
    this.mode.fx.smoke(this.pos);
    this.mode.audio.at('stinger', this.pos);
  }

  update(dt) {
    const M = this.mode, p = M.game.player.pos;
    this.mixer.update(dt);
    this.stateT += dt;
    const d = this.distToPlayer();
    const inside = this.inHall(p) && !M.hidden;
    const sp = M.diff.speed * (0.9 + this.stage * 0.35);
    switch (this.state) {
      case 'idle':
        this.play('Idle');
        if (inside) { this.state = 'hunt'; this.roar(); }
        break;
      case 'roar':
        this.face(p.x, p.z, dt);
        if (this.stateT > 1.3) { this.state = 'hunt'; this.stateT = 0; }
        break;
      case 'appear':
        this.face(p.x, p.z, dt);
        if (this.stateT > 1) { this.state = 'hunt'; this.stateT = 0; }
        break;
      case 'hunt': {
        if (!inside) {
          // ждёт у дверей зала
          this.play('Search');
          if (this.stepTo(46.5, 0, 1.4 * sp, dt) < 0.4) this.face(p.x, p.z, dt);
          break;
        }
        this.dashCd -= dt;
        if (this.stage >= 3 && this.dashCd <= 0 && d > 4) {
          this.state = 'dash';
          this.stateT = 0;
          this.dashDir = new THREE.Vector3(p.x - this.pos.x, 0, p.z - this.pos.z).normalize();
          this.dashCd = 5 - M.diffIndex * 0.5;
          M.audio.at('roar', this.pos);
          break;
        }
        this.play(this.stage >= 2 ? 'Chase' : 'Walk', { ts: 0.8 + this.stage * 0.2 });
        this.stepTo(p.x, p.z, (this.stage >= 2 ? 2.6 : 1.5) * sp, dt);
        if (d < 1.8) { this.state = 'attack'; this.stateT = 0; this.attackHit = false; this.play('Attack', { once: true }); }
        break;
      }
      case 'dash': {
        this.play('Chase', { ts: 1.8 });
        this.stepTo(this.pos.x + this.dashDir.x, this.pos.z + this.dashDir.z, 9.5, dt);
        if (d < 1.6 && !this.attackHit) { this.attackHit = true; M.damage(40 * M.diff.damage, this); }
        if (this.stateT > 1.1) { this.state = 'hunt'; this.attackHit = false; }
        break;
      }
      case 'attack':
        this.face(p.x, p.z, dt, 12);
        if (!this.attackHit && this.stateT > 0.35) { this.attackHit = true; if (d < 2.3 && !M.hidden) M.damage(42 * M.diff.damage, this); }
        if (this.stateT > 1) { this.state = 'stun'; this.stateT = 0; this.play('Idle'); }
        break;
      case 'stun':
        if (this.stateT > 2.6 - this.stage * 0.4) { this.state = 'hunt'; this.stateT = 0; }
        break;
      case 'dying':
        if (this.stateT > 2.2) { this.root.scale.multiplyScalar(1 - dt * 2); this.pos.y -= dt * 0.8; }
        if (this.stateT > 3.6) { this.root.visible = false; this.state = 'dead'; }
        break;
      default: break;
    }
    if (this.stepAcc > 1.3) { this.stepAcc = 0; M.audio.at('mstep', this.pos, { heavy: true }); }
  }

  die() {
    this.state = 'dying';
    this.stateT = 0;
    this.play('Scream', { once: true, ts: 0.7 });
    this.mode.audio.at('roar', this.pos);
    this.mode.fx.smoke(this.pos);
  }
}

// ======================================================================= ЛОЖНЫЕ СИЛУЭТЫ
export class Silhouette extends MonsterBase {
  constructor(mode, x, z, real) {
    super(mode, 'shadow');
    this.real = real;
    this.pos.set(x, 0, z);
    this.yaw = Math.random() * 6;
    this.root.rotation.y = this.yaw;
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData = { own: true };
      if (o.material.name === 'Eye') { this.eye = o.material; o.material.emissive.setScalar(0); o.material.color.set('#111'); }
    });
    this.play('Idle', { ts: real ? 0.35 : 0 });
    if (!real) this.mixer.update(Math.random() * 2);
  }

  update(dt) {
    const M = this.mode, p = M.game.player.pos;
    if (this.real) {
      this.mixer.update(dt);
      // голова медленно поворачивается вслед за игроком
      const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z) - this.yaw;
      const a = Math.atan2(Math.sin(want), Math.cos(want));
      if (this.bones.head) this.bones.head.rotation.y = Math.max(-0.9, Math.min(0.9, a)) * 0.8;
      // глаза блестят в луче фонарика (на HELL — нет)
      const d = this.distToPlayer();
      const cam = M.game.camera;
      cam.getWorldDirection(tmpV);
      const to = new THREE.Vector3(this.pos.x - cam.position.x, 1.6 - cam.position.y, this.pos.z - cam.position.z).normalize();
      const lit = M.flashOn && M.battery > 0 && d < 12 && tmpV.dot(to) > 0.95;
      if (this.eye && M.diffIndex < 4) { const k = lit ? 1 : 0; this.eye.emissive.setRGB(k * 0.9, k * 0.9, k); this.eye.color.set(lit ? '#ffffff' : '#111111'); }
    }
  }
}
