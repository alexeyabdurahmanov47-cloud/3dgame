// Простая «физика» уровня: AABB‑стены, горизонтальные поверхности и пандусы (лестницы).
export class World {
  constructor() {
    this.colliders = [];
    this.surfaces = [];
  }

  addBox(minX, maxX, minY, maxY, minZ, maxZ, extra = {}) {
    const c = { minX, maxX, minY, maxY, minZ, maxZ, enabled: true, camera: true, ...extra };
    this.colliders.push(c);
    return c;
  }

  addSurface(minX, maxX, minZ, maxZ, y) {
    const s = { minX, maxX, minZ, maxZ, y };
    this.surfaces.push(s);
    return s;
  }

  // Пандус: высота плавно меняется вдоль оси axis ('x' | 'z') от y0 (min) до y1 (max)
  addRamp(minX, maxX, minZ, maxZ, axis, y0, y1) {
    const s = { minX, maxX, minZ, maxZ, ramp: { axis, y0, y1 } };
    this.surfaces.push(s);
    return s;
  }

  heightOf(s, x, z) {
    if (!s.ramp) return s.y;
    const { axis, y0, y1 } = s.ramp;
    const t = axis === 'x' ? (x - s.minX) / (s.maxX - s.minX) : (z - s.minZ) / (s.maxZ - s.minZ);
    return y0 + (y1 - y0) * Math.min(1, Math.max(0, t));
  }

  groundAt(x, z, maxY) {
    let best = -Infinity;
    for (const s of this.surfaces) {
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      const h = this.heightOf(s, x, z);
      if (h <= maxY && h > best) best = h;
    }
    return best;
  }

  // Выталкивание цилиндра игрока из стен
  resolve(pos, r, h) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (!c.enabled || c.ghost) continue;
        if (pos.y + h <= c.minY || pos.y + 0.12 >= c.maxY) continue;
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (r - d);
          pos.z += (dz / d) * (r - d);
        } else {
          // центр внутри — выталкиваем по наименьшему проникновению
          const pl = pos.x - c.minX + r, pr = c.maxX - pos.x + r;
          const pb = pos.z - c.minZ + r, pf = c.maxZ - pos.z + r;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) pos.x -= pl;
          else if (m === pr) pos.x += pr;
          else if (m === pb) pos.z -= pb;
          else pos.z += pf;
        }
      }
    }
    return hit;
  }

  pointBlocked(x, y, z, pad = 0.15) {
    for (const c of this.colliders) {
      if (!c.enabled || !c.camera) continue;
      if (x > c.minX - pad && x < c.maxX + pad && y > c.minY - pad && y < c.maxY + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  }
}
