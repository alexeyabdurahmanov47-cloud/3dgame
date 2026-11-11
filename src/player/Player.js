import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from './CharacterModel.js';
import { angleDamp, clamp, damp } from '../core/gfx.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.model = new CharacterModel();
    this.object = this.model.root;
    this.pos = this.object.position;
    this.velY = 0;
    this.onGround = true;
    this.facing = 0;
    this.speed = 0;
    this.stepAcc = 0;
    this.frozen = false; // когда сидит за партой / в катсцене
    this.lastSafe = new THREE.Vector3();
    this.vel = new THREE.Vector3();
  }

  setLook(look) { this.model.build(look); }

  place(x, y, z, facing = 0) {
    this.pos.set(x, y, z);
    this.facing = facing;
    this.object.rotation.y = facing;
    this.velY = 0;
    this.onGround = true;
    this.lastSafe.copy(this.pos);
    this.model.pose = 'stand';
  }

  update(dt, input, camYaw, world) {
    const P = CONFIG.player;
    if (this.frozen) {
      this.model.animate(dt, 0, { onGround: true });
      return;
    }
    const ax = input.axis();
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let wx = fx * ax.y + rx * ax.x;
    let wz = fz * ax.y + rz * ax.x;
    const mag = Math.min(1, Math.hypot(wx, wz));
    const running = input.running();
    const target = mag * (running ? P.runSpeed : P.walkSpeed);
    const l = Math.hypot(wx, wz);
    if (l > 0.01) {
      wx /= l;
      wz /= l;
      this.facing = angleDamp(this.facing, Math.atan2(wx, wz), 14, dt);
    } else { wx = 0; wz = 0; }
    this.mvx = damp(this.mvx || 0, wx * target, 12, dt);
    this.mvz = damp(this.mvz || 0, wz * target, 12, dt);
    this.speed = Math.hypot(this.mvx, this.mvz);
    const prevX = this.pos.x, prevZ = this.pos.z;
    this.pos.x += this.mvx * dt;
    this.pos.z += this.mvz * dt;

    world.resolve(this.pos, P.radius, P.height);

    // гравитация / прыжок
    if (this.onGround && input.pressed('Space')) {
      this.velY = P.jump;
      this.onGround = false;
      this.game.audio.play('jump');
    }
    this.velY -= P.gravity * dt;
    this.pos.y += this.velY * dt;
    const ground = world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.55);
    if (ground > -Infinity && this.pos.y <= ground) {
      this.pos.y = ground;
      this.velY = 0;
      this.onGround = true;
    } else if (this.onGround && this.velY <= 0 && ground > -Infinity && this.pos.y - ground < 0.45) {
      this.pos.y = ground; // прилипание при спуске по лестнице
      this.velY = 0;
    } else {
      this.onGround = this.pos.y - ground < 0.02;
    }
    if (this.pos.y < -25) this.pos.copy(this.lastSafe);
    if (this.onGround && ground > -Infinity) this.lastSafe.copy(this.pos);

    this.vel.set((this.pos.x - prevX) / dt, 0, (this.pos.z - prevZ) / dt);
    this.object.rotation.y = this.facing;
    const moved = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    this.model.animate(dt, clamp(moved / dt / P.walkSpeed, 0, 1.5), { onGround: this.onGround, running });

    // шаги
    if (this.onGround && moved > 0.001) {
      this.stepAcc += moved;
      if (this.stepAcc > (running ? 0.85 : 0.6)) {
        this.stepAcc = 0;
        this.game.audio.play('step');
      }
    }
  }
}
