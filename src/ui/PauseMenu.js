import { h } from './dom.js';
import { openSettings } from './Settings.js';
import { openDiary } from './Diary.js';
import { openGradePicker } from './GradePicker.js';
import { openAdmin } from './AdminPanel.js';

export class PauseMenu {
  constructor(game) { this.game = game; }

  open() {
    const g = this.game;
    const b = (label, cls, fn) => h('button', { class: `btn ${cls}`, onclick: () => { g.audio.play('click'); fn(); } }, label);
    if (g.horror.active) {
      const H = g.save.data.horror;
      const el2 = h('div', { class: 'overlay hz-overlay' },
        h('div', { class: 'panel pause-menu hz-panel pop' },
          h('h2', {}, 'Пауза'),
          h('div', { style: { opacity: 0.7 } }, `${g.horror.mission.name} · ${g.horror.diff.name}`),
          b('▶ Продолжить', 'green', () => g.togglePause(false)),
          b('↺ Перезапустить миссию', 'white', () => { g.togglePause(false); g.horror.restart(); }),
          b(`Скримеры: ${({ off: 'выкл.', low: 'слабо', mid: 'средне', high: 'максимум' })[H.screamers]}`, 'white', (e) => {
            const order = ['off', 'low', 'mid', 'high'];
            H.screamers = order[(order.indexOf(H.screamers) + 1) % 4];
            g.save.soon(); this.close(); this.open();
          }),
          b(`Мигание света: ${H.flashSafe ? 'мягкое' : 'резкое'}`, 'white', () => { H.flashSafe = !H.flashSafe; g.save.soon(); this.close(); this.open(); }),
          b('⚙️ Настройки', 'white', () => openSettings(g)),
          b('Выйти в меню', 'red', () => g.toMainMenu())));
      g.ui.openModal('pause', el2);
      return;
    }
    const el = h('div', { class: 'overlay' },
      h('div', { class: 'panel pause-menu pop' },
        h('h2', {}, '⏸ Пауза'),
        h('div', { style: { fontWeight: 800, color: '#7a7799' } }, `День ${g.save.progress.day} · ${g.timeStr()}`),
        b('▶ Продолжить', 'green', () => g.togglePause(false)),
        b('📒 Дневник', 'white', () => openDiary(g)),
        b('📊 Информация', 'white', () => openAdmin(g)),
        b(`🎓 Класс: ${g.save.data.grade}`, 'blue', () => openGradePicker(g)),
        b('🛍️ Магазин', 'yellow', () => g.shop.open()),
        b('⚙️ Настройки', 'white', () => openSettings(g)),
        b('🏠 Главное меню', 'red', () => g.toMainMenu())));
    g.ui.openModal('pause', el);
  }

  close() { this.game.ui.closeModal('pause'); }
}
