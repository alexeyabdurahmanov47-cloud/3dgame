import { h } from './dom.js';
import { Dialog } from './Dialog.js';
import { Loading } from './Loading.js';

// Менеджер интерфейса: модальные окна, тосты, подсказки совёнка, конфетти.
export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.modals = new Map();
    this.toastBox = h('div', { class: 'toasts' });
    this.root.append(this.toastBox);
    this.dialog = new Dialog(this);
    this.loading = new Loading(this.root);
    this.tipEl = null;
  }

  openModal(name, el) {
    this.closeModal(name);
    this.modals.set(name, el);
    this.root.append(el);
    this.game.audio.play('pop');
    this.game.refreshInput();
    return el;
  }

  closeModal(name) {
    const el = this.modals.get(name);
    if (el) {
      el.remove();
      this.modals.delete(name);
    }
    this.game.refreshInput();
  }

  closeAllModals() {
    for (const k of [...this.modals.keys()]) this.closeModal(k);
  }

  hasModal() { return this.modals.size > 0; }

  // Простое модальное окно
  modal(name, title, body, { onClose, wide = false } = {}) {
    const close = () => { this.closeModal(name); onClose && onClose(); };
    const el = h('div', { class: 'overlay', onclick: (e) => e.target === el && close() },
      h('div', { class: 'panel modal pop', style: wide ? { width: 'min(1000px,96vw)' } : null },
        h('div', { class: 'head' }, h('h2', {}, title), h('button', { class: 'close-x', onclick: close }, '✕')),
        body));
    el._close = close;
    return this.openModal(name, el);
  }

  toast(text, kind = '', ms = 2600) {
    const t = h('div', { class: `toast ${kind}` });
    t.innerHTML = text;
    this.toastBox.append(t);
    while (this.toastBox.children.length > 5) this.toastBox.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 450);
  }

  floatText(text, x, y) {
    const el = h('div', { class: 'coin-float', style: { left: x + 'px', top: y + 'px' } }, text);
    this.root.append(el);
    setTimeout(() => el.remove(), 1200);
  }

  bigMessage(html, ms = 2200) {
    const el = h('div', { class: 'bigmsg passthru', html });
    this.root.append(el);
    setTimeout(() => el.remove(), ms);
  }

  // Подсказка совёнка Сони. key — показать только один раз за игру.
  tip(html, key = null, ms = 9000) {
    const seen = this.game.save.data.seenTips;
    if (key) {
      if (seen[key]) return;
      seen[key] = true;
      this.game.save.soon();
    }
    if (this.tipEl) this.tipEl.remove();
    const close = () => { el.remove(); if (this.tipEl === el) this.tipEl = null; };
    const el = h('div', { class: 'tip' },
      h('div', { class: 'owl' }, '🦉'),
      h('div', { class: 'bubble', html: `<b>Сова Соня:</b> ${html}` }, h('button', { class: 'x', onclick: close }, '✕')));
    this.root.append(el);
    this.tipEl = el;
    this.game.audio.play('pop');
    clearTimeout(this._tipT);
    this._tipT = setTimeout(close, ms);
  }

  confetti(ms = 2600) {
    const c = h('canvas', { class: 'confetti' });
    c.width = innerWidth;
    c.height = innerHeight;
    this.root.append(c);
    const ctx = c.getContext('2d');
    const colors = ['#ff6b6b', '#ffc93c', '#2ed573', '#3fa7ff', '#a29bfe', '#ff8fd8'];
    const ps = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 18 - 6,
      r: Math.random() * 6 + 4, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4,
    }));
    const t0 = performance.now();
    const loop = (t) => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.vy += 0.5; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      }
      if (t - t0 < ms) requestAnimationFrame(loop); else c.remove();
    };
    requestAnimationFrame(loop);
  }
}
