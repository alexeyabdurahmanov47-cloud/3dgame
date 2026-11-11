import { h } from '../ui/dom.js';
import { CATEGORIES, ITEMS, itemById, lookFromEquipped } from './items.js';
import { Preview } from './Preview.js';
import { bus } from '../core/EventBus.js';

// Магазин скинов и аксессуаров
export class Shop {
  constructor(game) {
    this.game = game;
    this.preview = null;
    this.cat = 'skin';
    bus.on('coins', (c) => { if (this.coins) this.coins.textContent = `🪙 ${c}`; });
  }

  open(onClose) {
    const g = this.game;
    if (!this.preview) this.preview = new Preview();
    const eq = g.save.data.equipped;
    this.sel = itemById(eq[this.cat]) || ITEMS.find((i) => i.slot === this.cat);
    this.onClose = onClose;

    this.tabs = h('div', { class: 'tabs' });
    this.grid = h('div', { class: 'grid' });
    this.info = h('div', { class: 'item-info' });
    this.actions = h('div', { class: 'actions' });
    this.coins = h('div', { class: 'chip' });
    this.prevBox = h('div', { class: 'preview' }, h('div', { class: 'hint' }, '↔ Покрути персонажа мышкой или пальцем'));
    const close = () => {
      this.preview.stop();
      g.ui.closeModal('shop');
      g.applyLook();
      if (g.state === 'menu') g.mainMenu.show();
      this.onClose && this.onClose();
    };
    const el = h('div', { class: 'overlay', onclick: (e) => e.target === el && close() },
      h('div', { class: 'panel shop pop' },
        h('div', { class: 'catalog' },
          h('div', { class: 'head', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
            h('h2', { style: { fontSize: '30px' } }, '🛍️ Магазин'), this.coins),
          this.tabs, this.grid),
        h('div', { class: 'side' },
          h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, h('button', { class: 'close-x', onclick: close }, '✕')),
          this.prevBox, this.info, this.actions)));
    el._close = close;
    g.ui.openModal('shop', el);
    this.render();
    this.preview.start(this.prevBox);
  }

  owned(id) { return this.game.save.data.owned.includes(id); }

  render() {
    const g = this.game;
    const d = g.save.data;
    this.coins.textContent = `🪙 ${d.coins}`;
    this.tabs.innerHTML = '';
    CATEGORIES.forEach((c) => this.tabs.append(h('button', { class: `tab ${this.cat === c.id ? 'on' : ''}`, onclick: () => {
      this.cat = c.id;
      this.sel = itemById(d.equipped[c.id]) || ITEMS.find((i) => i.slot === c.id);
      g.audio.play('click');
      this.render();
    } }, `${c.icon} ${c.name}`)));
    this.grid.innerHTML = '';
    ITEMS.filter((i) => i.slot === this.cat).forEach((it) => {
      const own = this.owned(it.id);
      const on = d.equipped[it.slot] === it.id;
      this.grid.append(h('div', { class: `card ${this.sel?.id === it.id ? 'sel' : ''}`, onclick: () => { this.sel = it; g.audio.play('hover'); this.render(); } },
        on ? h('div', { class: 'badge' }, 'Надето') : own ? h('div', { class: 'badge own' }, 'Есть') : null,
        h('div', { class: 'em' }, it.icon),
        h('div', { class: 'nm' }, it.name),
        h('div', { class: 'pr' }, own ? '✓ куплено' : it.price ? `🪙 ${it.price}` : 'Бесплатно')));
    });
    // примерка
    const tryEq = { ...d.equipped };
    if (this.sel) tryEq[this.sel.slot] = this.sel.id;
    this.preview.setLook(lookFromEquipped(tryEq));
    this.renderInfo();
  }

  renderInfo() {
    const g = this.game;
    const d = g.save.data;
    const it = this.sel;
    this.info.innerHTML = '';
    this.actions.innerHTML = '';
    if (!it) return;
    this.info.append(h('h3', {}, `${it.icon} ${it.name}`), h('p', {}, it.desc || ''));
    const own = this.owned(it.id);
    const on = d.equipped[it.slot] === it.id;
    if (!own) {
      const can = d.coins >= it.price;
      this.actions.append(h('button', { class: 'btn yellow', disabled: !can, onclick: () => this.buy(it) }, `Купить за 🪙 ${it.price}`));
      if (!can) this.info.append(h('p', { style: { color: '#d64545' } }, `Не хватает ${it.price - d.coins} 🪙 — пройди уроки, чтобы заработать!`));
    } else if (!on) {
      this.actions.append(h('button', { class: 'btn green', onclick: () => this.equip(it) }, '👕 Надеть'));
    } else if (it.slot !== 'skin') {
      this.actions.append(h('button', { class: 'btn red', onclick: () => this.unequip(it.slot) }, '✖ Снять'));
    } else {
      this.actions.append(h('button', { class: 'btn white', disabled: true }, '✓ Надето'));
    }
  }

  buy(it) {
    const g = this.game;
    if (!g.save.spend(it.price)) return;
    g.save.data.owned.push(it.id);
    g.audio.play('buy');
    g.ui.toast(`🛍️ Куплено: <b>${it.name}</b>!`);
    g.achievements.unlock('fashion');
    this.equip(it, true);
  }

  equip(it, silent) {
    const g = this.game;
    g.save.data.equipped[it.slot] = it.id;
    g.save.save();
    if (!silent) g.audio.play('pop');
    this.render();
  }

  unequip(slot) {
    const g = this.game;
    g.save.data.equipped[slot] = null;
    g.save.save();
    g.audio.play('pop');
    this.render();
  }
}
