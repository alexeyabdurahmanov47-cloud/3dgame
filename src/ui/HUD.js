import { h, fmtTime } from './dom.js';
import { bus } from '../core/EventBus.js';
import { SaveManager } from '../save/SaveManager.js';
import { Joystick } from './Joystick.js';

// Игровой интерфейс: монеты, уровень, цель, часы, мини‑карта, подсказки действий.
export class HUD {
  constructor(game) {
    this.game = game;
    const save = game.save;
    this.coinsEl = h('span', {}, save.data.coins);
    this.coinChip = h('div', { class: 'chip coins' }, '🪙', this.coinsEl);
    this.lvEl = h('span', { class: 'lv' }, 'Ур. 1');
    this.xpFill = h('div');
    this.clockEl = h('span', { class: 'clock' }, '7:30');
    this.dayEl = h('span', {}, 'День 1');
    this.qIco = h('div', { class: 'ico' }, '🎯');
    this.qTxt = h('div', { class: 'txt' }, '');
    this.qSub = h('div', { class: 'sub' }, '');
    this.compass = h('div', { class: 'compass' }, '⬆');
    this.quest = h('div', { class: 'quest' }, this.qIco, h('div', { style: { flex: 1, minWidth: 0 } }, this.qTxt, this.qSub), this.compass);
    this.promptEl = h('div', { class: 'prompt hidden', onclick: () => game.input.press('KeyE') });
    this.mapCanvas = h('canvas', { width: 340, height: 340 });
    this.mapTitle = h('div', { class: 'chip map-title' }, '');
    this.el = h('div', { class: 'hud hidden' },
      h('div', { class: 'hud-tl' },
        this.coinChip,
        h('div', { class: 'chip level' }, this.lvEl, h('div', { class: 'xpbar' }, this.xpFill))),
      h('div', { class: 'hud-tr' },
        h('div', { class: 'chip' }, '🕗', this.clockEl),
        h('div', { class: 'chip day-chip' }, '📅', this.dayEl),
        h('button', { class: 'btn icon white', title: 'Меню (Esc)', onclick: () => game.togglePause() }, '☰')),
      this.quest,
      this.promptEl,
      this.mapTitle,
      h('div', { class: 'minimap' }, this.mapCanvas));
    game.ui.root.prepend(this.el);
    this.ctx = this.mapCanvas.getContext('2d');

    if (game.input.isTouch) {
      this.joystick = new Joystick(game);
      this.el.append(this.joystick.el);
    }

    bus.on('coins', (c, delta) => {
      this.coinsEl.textContent = c;
      if (delta > 0) {
        this.coinChip.classList.remove('flash');
        void this.coinChip.offsetWidth;
        this.coinChip.classList.add('flash');
        const r = this.coinChip.getBoundingClientRect();
        game.ui.floatText(`+${delta}`, r.right - 10, r.top + 30);
      }
    });
    bus.on('xp', () => this.updateXp());
    this.updateXp();
  }

  updateXp() {
    const d = this.game.save.data;
    this.lvEl.textContent = `Ур. ${d.level}`;
    this.xpFill.style.width = Math.min(100, (d.xp / SaveManager.xpForLevel(d.level)) * 100) + '%';
    this.coinsEl.textContent = d.coins;
  }

  show(v = true) { this.el.classList.toggle('hidden', !v); }

  setQuest(text, sub = '', icon = '🎯') {
    if (this.qTxt.textContent !== text) {
      this.quest.classList.remove('done');
      void this.quest.offsetWidth;
      this.quest.classList.add('done');
    }
    this.qTxt.textContent = text;
    this.qSub.textContent = sub;
    this.qIco.textContent = icon;
  }

  setPrompt(text) {
    if (!text) { this.promptEl.classList.add('hidden'); this._p = null; return; }
    if (this._p === text) return;
    this._p = text;
    this.promptEl.classList.remove('hidden');
    this.promptEl.innerHTML = `<span class="key">${this.game.input.isTouch ? '✋' : 'E'}</span> ${text}`;
  }

  update(target) {
    const g = this.game;
    const prog = g.save.progress;
    this.clockEl.textContent = fmtTime(prog.clock);
    this.dayEl.textContent = `День ${prog.day}`;
    const p = g.player.pos;
    const yaw = g.cam.yaw;
    // компас и расстояние до цели
    if (target) {
      const dx = target.x - p.x, dz = target.z - p.z;
      const f = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
      const r = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      const ang = Math.atan2(r, f);
      this.compass.style.transform = `rotate(${ang}rad)`;
      this.compass.style.visibility = 'visible';
      const dist = Math.round(Math.hypot(dx, dz));
      const dy = target.y - p.y;
      let sub = dist > 1 ? `До цели: ${dist} м` : 'Ты на месте!';
      if (Math.abs(dy) > 2.5) sub += dy > 0 ? ' • поднимись выше ⬆' : ' • спустись ниже ⬇';
      this.qSub.textContent = this._extraSub ? `${this._extraSub} • ${sub}` : sub;
    } else {
      this.compass.style.visibility = 'hidden';
      this.qSub.textContent = this._extraSub || '';
    }
    this.drawMap(target);
  }

  drawMap(target) {
    const g = this.game, s = g.scene, ctx = this.ctx;
    if (!s) return;
    const W = 340, cx = W / 2, cy = W / 2;
    const zoom = s.mapZoom * 2;
    const p = g.player.pos, yaw = g.cam.yaw;
    this.mapTitle.textContent = s.title;
    ctx.fillStyle = s.mapBg || '#9be3a6';
    ctx.fillRect(0, 0, W, W);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(yaw);
    ctx.scale(zoom, zoom);
    ctx.translate(-p.x, -p.z);
    const fh = s.mapFloorH;
    const base = fh ? Math.floor((p.y + 0.5) / fh) * fh : 0;
    const view = W / zoom;
    for (const r of s.mapRects) {
      if (fh && (r.y0 < base - 0.5 || r.y0 > base + fh - 0.5)) continue;
      if (Math.abs(r.x - p.x) > view + r.w || Math.abs(r.z - p.z) > view + r.d) continue;
      ctx.fillStyle = r.color;
      if (r.round) {
        ctx.beginPath();
        ctx.arc(r.x, r.z, r.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
    }
    // игрок
    ctx.translate(p.x, p.z);
    ctx.rotate(-g.player.facing);
    const a = 9 / zoom * 2;
    ctx.fillStyle = '#6c5ce7';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, a * 1.3);
    ctx.lineTo(a, -a);
    ctx.lineTo(0, -a * 0.4);
    ctx.lineTo(-a, -a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // цель
    if (target) {
      const dx = target.x - p.x, dz = target.z - p.z;
      const f = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
      const r = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      let mx = r * zoom, my = -f * zoom;
      const d = Math.hypot(mx, my), R = W / 2 - 22;
      if (d > R) { mx *= R / d; my *= R / d; }
      const t = performance.now() / 300;
      ctx.fillStyle = '#ffc93c';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx + mx, cy + my, 12 + Math.sin(t) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5a3e00';
      ctx.font = 'bold 16px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx + mx, cy + my + 1);
    }
    // север
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(yaw);
    ctx.fillStyle = '#d63031';
    ctx.font = 'bold 22px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('С', 0, -W / 2 + 26);
    ctx.restore();
  }
}
