import { h } from './dom.js';

// Диалоговые окна с эффектом печатной машинки.
export class Dialog {
  constructor(ui) {
    this.ui = ui;
    this.el = null;
    this.queue = [];
    this.onDone = null;
    addEventListener('keydown', (e) => {
      if (!this.el) return;
      if (['KeyE', 'Space', 'Enter'].includes(e.code)) {
        e.preventDefault();
        this.next();
      }
    });
  }

  get open() { return !!this.el; }

  // lines: [{ name, avatar, text, choices: [{ text, action }] }]
  show(lines, onDone) {
    if (this.el) { // если уже открыт — добавим в очередь
      this.queue.push(...lines);
      const prev = this.onDone;
      this.onDone = () => { prev && prev(); onDone && onDone(); };
      return;
    }
    this.queue = [...lines];
    this.onDone = onDone || null;
    this.el = h('div', { class: 'dialog' });
    this.ui.root.append(this.el);
    this.ui.game.refreshInput();
    this.render();
  }

  render() {
    const line = this.queue[0];
    this.el.innerHTML = '';
    this.current = line;
    const text = h('div', { class: 'text' });
    const box = h('div', { class: 'box', onclick: () => this.next() },
      h('div', { class: 'name' }, line.name || ''), text,
      line.choices ? null : h('div', { class: 'more' }, this.queue.length > 1 ? 'Дальше ▶ (E / клик)' : 'Закрыть ✓ (E / клик)'));
    if (line.choices) {
      const ch = h('div', { class: 'choices' }, line.choices.map((c, i) =>
        h('button', { class: `btn small ${i === 0 ? 'green' : 'white'}`, onclick: (e) => { e.stopPropagation(); this.close(); c.action && c.action(); } }, c.text)));
      box.append(ch);
    }
    this.el.append(h('div', { class: 'avatar' }, line.avatar || '🦉'), box);
    // печатная машинка
    this.full = line.text;
    this.typed = 0;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.typed += 2;
      text.textContent = this.full.slice(0, this.typed);
      if (this.typed % 6 === 0) this.ui.game.audio.play('tick');
      if (this.typed >= this.full.length) clearInterval(this.timer);
    }, 16);
    this.textEl = text;
  }

  next() {
    if (!this.el) return;
    if (this.typed < this.full.length) {
      this.typed = this.full.length;
      this.textEl.textContent = this.full;
      clearInterval(this.timer);
      return;
    }
    if (this.current?.choices) return;
    this.queue.shift();
    this.ui.game.audio.play('click');
    if (this.queue.length) this.render();
    else this.close(true);
  }

  close(callDone = false) {
    clearInterval(this.timer);
    if (this.el) this.el.remove();
    this.el = null;
    const cb = this.onDone;
    this.onDone = null;
    this.queue = [];
    this.ui.game.input.block();
    this.ui.game.refreshInput();
    if (callDone && cb) cb();
  }
}
