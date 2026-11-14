import { h } from './dom.js';

// Виртуальный джойстик и кнопки для сенсорных экранов
export class Joystick {
  constructor(game) {
    this.game = game;
    this.knob = h('div', { class: 'knob' });
    this.pad = h('div', { class: 'joy' }, this.knob);
    const btn = (label, code, cls = '') => {
      const b = h('button', { class: `mbtn ${cls}` }, label);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); game.input.press(code); game.input.keys.add(code); }, { passive: false });
      b.addEventListener('touchend', () => game.input.keys.delete(code));
      return b;
    };
    this.el = h('div', { class: 'mobile' }, this.pad, h('div', { class: 'mbtns' }, btn('⚡', 'KeyF'), btn('⤒', 'Space'), btn('E', 'KeyE', 'act')));
    let id = null, ox = 0, oy = 0;
    const R = 55;
    const move = (t) => {
      let dx = t.clientX - ox, dy = t.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      game.input.joy.x = dx / R;
      game.input.joy.y = -dy / R;
    };
    this.pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = this.pad.getBoundingClientRect();
      ox = r.left + r.width / 2;
      oy = r.top + r.height / 2;
      move(t);
    }, { passive: false });
    this.pad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) move(t);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) {
        id = null;
        this.knob.style.transform = '';
        game.input.joy.x = game.input.joy.y = 0;
      }
    };
    this.pad.addEventListener('touchend', end);
    this.pad.addEventListener('touchcancel', end);
  }
}
