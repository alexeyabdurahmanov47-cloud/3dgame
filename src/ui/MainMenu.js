import { h } from './dom.js';
import { openSettings } from './Settings.js';
import { openDiary } from './Diary.js';
import { openGradePicker } from './GradePicker.js';
import { openAdmin } from './AdminPanel.js';
import { openHorrorMenu } from '../horror/HorrorMenu.js';
import { defaultSave } from '../save/SaveManager.js';

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
    const playBtn = btn(has ? `▶ Дальше · день ${save.progress.day}` : '▶ Играть', 'green', () => (save.data.gradeChosen ? g.startGame() : openGradePicker(g, () => g.startGame())));
    const items = [playBtn];
    if (has) {
      items.push(btn('↺ Начать заново', 'blue', () => this.confirmRestart()));
    }
    items.push(
      btn('🩸 HORROR MODE', 'red horror-btn', () => openHorrorMenu(g)),
      btn(`Класс: ${save.data.grade} — сменить`, 'blue', () => openGradePicker(g, () => this.show())),
      btn('Магазин', 'yellow', () => g.shop.open(() => g.menuScene.refreshLook())),
      btn('Дневник', 'white', () => openDiary(g)),
      btn('Информация', 'white', () => openAdmin(g)),
      btn('Настройки', 'white', () => openSettings(g)),
      btn('Выход', 'red', () => this.exit()),
    );
    this.coins = h('span', {}, save.data.coins);
    this.el = h('div', {},
      h('div', { class: 'main-menu' },
        h('div', { class: 'left' },
          h('div', { class: 'logo', html: 'READ<span class="amp">&amp;</span><br><span class="p">PRACTICE</span>' }),
          h('div', { class: 'tagline' }, 'Читай · Практикуй · Побеждай'),
          ...items)),
      h('div', { class: 'menu-top' },
        h('div', { class: 'chip' }, 'Монеты ', this.coins),
        h('div', { class: 'chip' }, `Уровень ${save.data.level}`),
        h('div', { class: 'chip' }, `Награды ${Object.keys(save.data.achievements).length}`)),
      h('div', { class: 'menu-hint' }, g.input.isTouch ? 'Сенсорное управление включено' : 'Звук включится после первого клика'));
    g.ui.root.append(this.el);
  }

  // «Начать заново»: только текущий день или вся игра с нуля
  confirmRestart() {
    const g = this.game, save = g.save;
    const close = () => g.ui.closeModal('restart');
    const day = () => {
      const p = save.data.progress;
      p.done = []; p.scene = 'home'; p.spawn = 'start'; p.flags = {}; p.clock = 7 * 60 + 30; p.picked = {}; p.lessonNo = 0;
      save.log('session', `Начал день ${p.day} заново`);
      save.save();
      close();
      g.startGame();
    };
    const all = () => {
      const keep = { settings: save.data.settings, horror: { ...save.data.horror, done: {}, deaths: 0 }, seenTips: save.data.seenTips };
      save.data = { ...defaultSave(), ...keep };
      save.log('session', 'Начал игру заново с нуля');
      save.save();
      close();
      g.hud.updateXp();
      g.mainMenu.show();
      g.menuScene.refreshLook();
      openGradePicker(g, () => g.startGame());
    };
    const body = h('div', { class: 'restart' },
      h('p', {}, 'Что начать заново?'),
      h('button', { class: 'btn blue', onclick: day }, `Только день ${save.progress.day} — с утра`),
      h('button', { class: 'btn red', onclick: all }, 'Всю игру с нуля'),
      h('p', { class: 'muted small' }, 'Вся игра: удалятся дни, оценки, монеты и покупки. Настройки сохранятся.'),
      h('button', { class: 'btn white', onclick: close }, 'Отмена'));
    g.ui.modal('restart', 'Начать заново', body);
  }

  hide() {
    if (this.el) this.el.remove();
    this.el = null;
  }

  exit() {
    const g = this.game;
    g.save.save();
    const el = h('div', { class: 'goodbye' },
            h('h1', {}, 'До встречи!'),
      h('div', { style: { fontSize: '20px', fontWeight: 500, opacity: 0.8 } }, 'Прогресс сохранён.'),
      h('button', { class: 'btn yellow big', onclick: () => el.remove() }, 'Вернуться в меню'));
    g.ui.root.append(el);
    try { window.close(); } catch (_) { /* браузер может запретить закрытие вкладки */ }
  }
}
