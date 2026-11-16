import { h } from '../ui/dom.js';
import { DIFFICULTIES, SCREAMERS, GORE, diffById } from './config.js';
import { MISSIONS } from './missions.js';

// Меню хоррор-режима: предупреждение, сложность, настройки страха, список миссий с подробностями.
export function openHorrorMenu(game) {
  const H = game.save.data.horror;
  if (!H.ageOk) return openWarning(game);
  let diff = diffById(H.diff);
  let sel = MISSIONS.find((m) => m.id === H.last) || MISSIONS[0];
  const doneCount = Object.keys(H.done).length;

  const close = () => game.ui.closeModal('horror');
  const detail = h('div', { class: 'hzm-detail' });
  const grid = h('div', { class: 'hzm-grid' });
  const diffBox = h('div', { class: 'hzm-diffs' });

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const locked = (m) => m.needs && doneCount < m.needs;

  const drawDiff = () => {
    diffBox.innerHTML = '';
    DIFFICULTIES.forEach((d) => diffBox.append(h('button', {
      class: 'hzm-diff' + (d === diff ? ' on' : ''), style: { '--c': d.color },
      onclick: () => { diff = d; H.diff = d.id; game.save.soon(); drawDiff(); drawDetail(); },
    }, h('b', {}, d.name), h('small', {}, d.ru))));
    diffBox.append(h('div', { class: 'hzm-ddesc' }, diff.desc));
  };

  const drawGrid = () => {
    grid.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const rec = H.done[m.id];
      grid.append(h('button', {
        class: 'hzm-card' + (m === sel ? ' on' : '') + (locked(m) ? ' locked' : '') + (rec ? ' done' : ''),
        onclick: () => { sel = m; H.last = m.id; drawGrid(); drawDetail(); },
      },
      h('span', { class: 'n' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'ic' }, locked(m) ? '🔒' : m.icon),
      h('span', { class: 'nm' }, m.name),
      rec ? h('span', { class: 'sk' }, '💀'.repeat(rec.best + 1)) : null));
    });
  };

  const drawDetail = () => {
    const m = sel;
    const t = Math.round(m.time * diff.time);
    const surv = m.survive ? m.stages[0].sec + diff.extra * 30 : null;
    detail.innerHTML = '';
    detail.append(
      h('div', { class: 'hzm-title' }, h('span', {}, m.icon), h('h2', {}, m.name)),
      h('p', { class: 'hzm-desc' }, m.desc),
      h('div', { class: 'hzm-sec' }, h('b', {}, 'Цель'), h('p', {}, m.goal)),
      h('div', { class: 'hzm-sec' }, h('b', {}, 'Этапы'), h('ol', {}, ...m.stages.map((s) => h('li', {}, s.label)))),
      h('div', { class: 'hzm-facts' },
        h('div', {}, h('small', {}, 'Лимит времени'), h('b', {}, surv ? `выжить ${fmt(surv)}` : fmt(t))),
        h('div', {}, h('small', {}, 'Награда'), h('b', {}, `${Math.round(m.reward.coins * (1 + DIFFICULTIES.indexOf(diff) * 0.5))} 🪙 · ${Math.round(m.reward.xp * (1 + DIFFICULTIES.indexOf(diff) * 0.5))} XP`))),
      h('div', { class: 'hzm-sec' }, h('b', {}, 'Штрафы'), h('ul', {}, ...m.penText.map((p) => h('li', {}, p)))),
      h('div', { class: 'hzm-sec fail' }, h('b', {}, 'Провал'), h('p', {}, m.fail)),
      locked(m)
        ? h('div', { class: 'hzm-lock' }, `🔒 Откроется после прохождения ${m.needs} миссий (пройдено: ${doneCount})`)
        : h('button', { class: 'btn red big hzm-go', onclick: () => { close(); game.horror.launch(m.id, diff.id); } }, `Начать · ${diff.name}`),
    );
  };

  const seg = (list, key) => {
    const box = h('div', { class: 'seg' });
    const draw = () => {
      box.innerHTML = '';
      list.forEach((o) => box.append(h('button', { class: H[key] === o.id ? 'on' : '', title: o.desc, onclick: () => { H[key] = o.id; game.save.soon(); draw(); } }, o.name)));
    };
    draw();
    return box;
  };
  const flashT = h('button', { class: 'toggle' + (H.flashSafe ? ' on' : ''), onclick: () => { H.flashSafe = !H.flashSafe; flashT.classList.toggle('on', H.flashSafe); game.save.soon(); } });

  drawDiff();
  drawGrid();
  drawDetail();
  const el = h('div', { class: 'overlay hz-overlay hzm', onclick: (e) => e.target === el && close() },
    h('div', { class: 'panel hz-panel hzm-panel pop' },
      h('div', { class: 'hz-phead' }, h('div', {}, h('h2', { class: 'hzm-logo' }, 'HORROR MODE'), h('small', {}, `Пройдено миссий: ${doneCount} из ${MISSIONS.length} · Смертей: ${H.deaths || 0}`)), h('button', { class: 'close-x', onclick: close }, '✕')),
      diffBox,
      h('div', { class: 'hzm-body' }, grid, detail),
      h('div', { class: 'hzm-opts' },
        h('div', {}, h('small', {}, 'Скримеры'), seg(SCREAMERS, 'screamers')),
        h('div', {}, h('small', {}, 'Кровь'), seg(GORE, 'gore')),
        h('div', {}, h('small', {}, 'Без резкого мигания'), flashT))));
  el._close = close;
  game.ui.openModal('horror', el);
}

function openWarning(game) {
  const H = game.save.data.horror;
  const close = () => game.ui.closeModal('horror');
  const el = h('div', { class: 'overlay hz-overlay' },
    h('div', { class: 'panel hz-panel hz-warn pop' },
      h('h2', {}, '⚠ HORROR MODE · 16+'),
      h('p', {}, 'Этот режим содержит:'),
      h('ul', {}, h('li', {}, 'кровь, кровавые надписи и следы'), h('li', {}, 'внезапные скримеры и громкие звуки'), h('li', {}, 'мигающий свет (можно отключить)'), h('li', {}, 'преследование монстрами и очень сложные задания')),
      h('p', { class: 'hz-text' }, 'Интенсивность скримеров, количество крови и мигание света можно настроить в меню режима и в паузе.'),
      h('div', { class: 'hz-row' },
        h('button', { class: 'btn red', onclick: () => { H.ageOk = true; game.save.save(); close(); openHorrorMenu(game); } }, 'Мне есть 16, я готов'),
        h('button', { class: 'btn white', onclick: close }, 'Назад'))));
  el._close = close;
  game.ui.openModal('horror', el);
}
