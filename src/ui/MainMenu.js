import { h } from './dom.js';
import { openSettings } from './Settings.js';
import { openDiary } from './Diary.js';
import { openGradePicker } from './GradePicker.js';
import { openAdmin } from './AdminPanel.js';

export class MainMenu {
  constructor(game) {
    this.game = game;
    this.el = null;
  }

  show() {
    const g = this.game;
    if (this.el) this.el.remove();
    const save = g.save;
    const has = save.hasProgress();
    const btn = (label, cls, fn) => h('button', { class: `btn big ${cls}`, onclick: () => { g.audio.init(); g.audio.play('click'); fn(); }, onmouseenter: () => g.audio.play('hover') }, label);
    const playBtn = btn(has ? `▶ Продолжить · день ${save.progress.day}` : '▶ Играть', 'green', () => (save.data.gradeChosen ? g.startGame() : openGradePicker(g, () => g.startGame())));
    const items = [playBtn];
    if (has) {
      items.push(btn('🔄 Начать день заново', 'blue', () => {
        save.data.progress.done = [];
        save.data.progress.scene = 'home';
        save.data.progress.spawn = 'start';
        save.data.progress.flags = {};
        save.data.progress.clock = 7 * 60 + 30;
        save.save();
        g.startGame();
      }));
    }
    items.push(
      btn(`🎓 Класс: ${save.data.grade} (сменить)`, 'blue', () => openGradePicker(g, () => this.show())),
      btn('🛍️ Магазин', 'yellow', () => g.shop.open(() => g.menuScene.refreshLook())),
      btn('📒 Дневник', 'white', () => openDiary(g)),
      btn('📊 Информация', 'white', () => openAdmin(g)),
      btn('⚙️ Настройки', 'white', () => openSettings(g)),
      btn('🚪 Выход', 'red', () => this.exit()),
    );
    this.coins = h('span', {}, save.data.coins);
    this.el = h('div', {},
      h('div', { class: 'main-menu' },
        h('div', { class: 'left' },
          h('div', { class: 'logo', html: 'READ<span class="amp">&amp;</span><br><span class="p">PRACTICE</span>' }),
          h('div', { class: 'tagline' }, 'Читай 📖 · Практикуй ✏️ · Побеждай 🏆'),
          ...items)),
      h('div', { class: 'menu-top' },
        h('div', { class: 'chip' }, '🪙 ', this.coins),
        h('div', { class: 'chip' }, `⭐ Ур. ${save.data.level}`),
        h('div', { class: 'chip' }, `🏅 ${Object.keys(save.data.achievements).length}`)),
      h('div', { class: 'menu-hint' }, g.input.isTouch ? '📱 Сенсорное управление включено' : '🎧 Звук включится после первого клика'));
    g.ui.root.append(this.el);
  }

  hide() {
    if (this.el) this.el.remove();
    this.el = null;
  }

  exit() {
    const g = this.game;
    g.save.save();
    const el = h('div', { class: 'goodbye' },
      h('div', { style: { fontSize: '90px' } }, '👋'),
      h('h1', {}, 'До встречи!'),
      h('div', { style: { fontSize: '20px', fontWeight: 800 } }, 'Твой прогресс сохранён. Возвращайся учиться и играть!'),
      h('button', { class: 'btn yellow big', onclick: () => el.remove() }, '↩ Вернуться в меню'));
    g.ui.root.append(el);
    try { window.close(); } catch (_) { /* браузер может запретить закрытие вкладки */ }
  }
}
