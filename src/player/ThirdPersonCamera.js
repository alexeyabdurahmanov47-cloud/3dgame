import * as THREE from 'three';
import { clamp, damp } from '../core/gfx.js';

// Камера от третьего лица с защитой от проникновения в стены
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.35;
    this.maxDist = 5;
    this.dist = 5;
    this.target = new THREE.Vector3();
    this.shake = 0;
    this.override = null; // { pos, look } для катсцен
  }

  snap(playerPos, yaw) {
    if (yaw !== undefined) this.yaw = yaw;
    this.target.set(playerPos.x, playerPos.y + 1.35, playerPos.z);
    this.dist = this.maxDist;
  }

  update(dt, playerPos, look, world, settings) {
    const sens = 0.0026 * (settings?.sens ?? 1);
    this.yaw -= look.x * sens;
    this.pitch += look.y * sens * (settings?.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.25, 1.25);

    if (this.override) {
      const o = this.override;
      this.camera.position.lerp(o.pos, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(o.look);
      return;
    }

    const tx = playerPos.x, ty = playerPos.y + 1.35, tz = playerPos.z;
    this.target.x = damp(this.target.x, tx, 20, dt);
    this.target.y = damp(this.target.y, ty, 10, dt);
    this.target.z = damp(this.target.z, tz, 20, dt);

    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    // луч от игрока к камере — укорачиваем при столкновении
    let free = this.maxDist;
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const d = (i / steps) * this.maxDist;
      if (world.pointBlocked(this.target.x + dx * d, this.target.y + dy * d, this.target.z + dz * d, 0.18)) {
        free = Math.max(0.6, d - this.maxDist / steps - 0.1);
        break;
      }
    }
    this.dist = free < this.dist ? free : damp(this.dist, free, 3, dt);
    const s = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 0.5);
    this.camera.position.set(this.target.x + dx * this.dist + s, this.target.y + dy * this.dist + s, this.target.z + dz * this.dist);
    this.camera.lookAt(this.target.x, this.target.y + 0.1, this.target.z);
  }
}
