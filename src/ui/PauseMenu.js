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
