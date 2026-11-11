// Клавиатура, мышь (pointer lock / перетаскивание) и виртуальный джойстик.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.just = new Set();
    this.look = { x: 0, y: 0 };
    this.joy = { x: 0, y: 0 };
    this.enabled = true; // false, когда открыто окно интерфейса
    this.locked = false;
    this.dragging = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.wantLock = true;

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!e.repeat) this.just.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.dragging = true;
      if (!this.isTouch && this.wantLock && !this.locked && canvas.requestPointerLock) {
        try {
          const p = canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (_) { /* ignore */ }
      }
      e.preventDefault();
    });
    addEventListener('mouseup', () => (this.dragging = false));
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    // Касания: правая половина экрана — вращение камеры
    this.lookTouch = null;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > innerWidth * 0.4 && this.lookTouch === null) {
          this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (this.lookTouch && t.identifier === this.lookTouch.id) {
          this.look.x += (t.clientX - this.lookTouch.x) * 1.6;
          this.look.y += (t.clientY - this.lookTouch.y) * 1.6;
          this.lookTouch.x = t.clientX;
          this.lookTouch.y = t.clientY;
        }
      }
    }, { passive: true });
    const endTouch = (e) => {
      for (const t of e.changedTouches) if (this.lookTouch && t.identifier === this.lookTouch.id) this.lookTouch = null;
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) { return this.enabled && this.keys.has(code); }
  pressed(code) { return this.enabled && performance.now() > (this.blockUntil || 0) && this.just.has(code); }
  block(ms = 200) { this.blockUntil = performance.now() + ms; this.just.clear(); }
  press(code) { this.just.add(code); } // для экранных кнопок

  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.joy.x;
    y += this.joy.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  running() { return this.down('ShiftLeft') || this.down('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.92; }

  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = this.look.y = 0;
    return this.enabled ? l : { x: 0, y: 0 };
  }

  endFrame() { this.just.clear(); }
}
