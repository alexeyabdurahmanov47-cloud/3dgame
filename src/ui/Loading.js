import { h } from './dom.js';

const TIPS = [
  '💡 Удерживай <b>Shift</b>, чтобы бежать быстрее.',
  '💡 Зажми <b>правую кнопку мыши</b> и двигай мышь, чтобы осмотреться.',
  '💡 Ищи <b>звёзды знаний</b> — они спрятаны в разных местах!',
  '💡 Читай внимательно: в практике будут вопросы по тексту.',
  '💡 Жёлтые слова в тексте можно нажать — появится подсказка.',
  '💡 Отвечай правильно подряд, чтобы получить <b>комбо</b> и больше монет!',
  '💡 За монеты в магазине можно купить новые образы и аксессуары.',
  '💡 Переходи дорогу только на <b>зелёный</b> свет светофора.',
  '💡 Поливай цветы в парке — они скажут спасибо монеткой.',
  '💡 Не знаешь, куда идти? Смотри на стрелку цели и мини‑карту.',
  '💡 Нажми <b>Esc</b>, чтобы открыть меню и дневник с оценками.',
];

export class Loading {
  constructor(root) {
    this.root = root;
    this.el = null;
  }

  show(title = 'Загрузка...') {
    if (this.el) this.el.remove();
    this.bar = h('div');
    this.el = h('div', { class: 'loading' },
      h('div', { class: 'books' }, '📚'),
      h('div', { class: 'title' }, title),
      h('div', { class: 'bar' }, this.bar),
      h('div', { class: 'tip', html: TIPS[Math.floor(Math.random() * TIPS.length)] }));
    this.root.append(this.el);
    this.set(0.05);
  }

  set(p) { if (this.bar) this.bar.style.width = Math.round(p * 100) + '%'; }

  hide() {
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    el.classList.add('fade');
    setTimeout(() => el.remove(), 400);
  }
}
