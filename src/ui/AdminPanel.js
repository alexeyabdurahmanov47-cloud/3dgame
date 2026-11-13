import { h, esc } from './dom.js';
import { ACHIEVEMENTS } from '../quests/achievements.js';
import { STAR_TOTAL } from '../scenes/entities.js';
import { GRADES, SUBJECTS } from '../lessons/curriculum.js';
import { itemById, CATEGORIES } from '../shop/items.js';
import { SaveManager } from '../save/SaveManager.js';

// «Информация» — панель в стиле админки: всё, что делал игрок.
// Данные берутся из журнала save.data.log (его пишут Game, LessonUI, Shop и др.).

export const LOG_TYPES = {
  lesson: { name: 'Уроки', icon: '📖', color: '#6c5ce7' },
  answer: { name: 'Ответы', icon: '✏️', color: '#0984e3' },
  practice: { name: 'Практика', icon: '🔬', color: '#00a383' },
  quest: { name: 'Задания', icon: '✅', color: '#2e9e5b' },
  action: { name: 'Действия', icon: '✋', color: '#e17055' },
  move: { name: 'Перемещения', icon: '🚶', color: '#7a7799' },
  shop: { name: 'Покупки', icon: '🛍️', color: '#d68910' },
  equip: { name: 'Образ', icon: '👕', color: '#c0569e' },
  achievement: { name: 'Достижения', icon: '🏅', color: '#b8860b' },
  level: { name: 'Уровни', icon: '⭐', color: '#8e44ad' },
  star: { name: 'Звёзды', icon: '🌟', color: '#c9a400' },
  grade: { name: 'Классы', icon: '🎓', color: '#2d3436' },
  day: { name: 'Дни', icon: '📅', color: '#16a085' },
  session: { name: 'Входы в игру', icon: '▶️', color: '#636e72' },
};
const MARK_COLOR = { 5: '#1f9d55', 4: '#2b7bd6', 3: '#d68910', 2: '#d64545' };
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (t) => { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtFull = (t) => { const d = new Date(t); return `${fmtDate(t)}:${pad(d.getSeconds())}`; };
const fmtDur = (s) => { s = Math.round(s || 0); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60); return hh ? `${hh} ч ${mm} мин` : mm ? `${mm} мин ${s % 60} с` : `${s} с`; };
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function openAdmin(game, section = 'overview') {
  const g = game;
  const d = g.save.data;
  const log = d.log || [];
  const state = { section, filter: 'all', query: '', limit: 80, confirmClear: false };

  const lessonEnds = log.filter((e) => e.type === 'lesson' && e.phase === 'end');
  const answers = log.filter((e) => e.type === 'answer');
  const marks = lessonEnds.map((e) => e.mark).filter(Boolean);
  const avg = marks.length ? (marks.reduce((a, b) => a + b, 0) / marks.length) : 0;
  const correct = d.stats.correct, wrong = d.stats.wrong;
  const acc = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
  const gradeAll = g.lessons.forGrade(d.grade);
  const passed = gradeAll.filter((L) => d.lessons[L.id] && d.lessons[L.id].best >= 3).length;

  const main = h('main', { class: 'adm-main' });
  const navItems = [
    ['overview', '📊', 'Обзор', null],
    ['journal', '🧾', 'Журнал действий', log.length],
    ['lessons', '📚', 'Уроки и оценки', lessonEnds.length],
    ['shop', '🛍️', 'Покупки и образ', log.filter((e) => e.type === 'shop').length],
    ['achievements', '🏅', 'Достижения', `${Object.keys(d.achievements).length}/${ACHIEVEMENTS.length}`],
  ];
  const nav = h('nav', { class: 'adm-nav' });
  const renderNav = () => {
    nav.innerHTML = '';
    navItems.forEach(([id, ic, name, count]) => nav.append(h('button', { class: `adm-nav-item ${state.section === id ? 'on' : ''}`, onclick: () => { state.section = id; g.audio.play('click'); render(); } },
      h('span', { class: 'ni' }, ic), h('span', { class: 'nn' }, name), count !== null ? h('span', { class: 'nc' }, count) : null)));
  };

  const skin = itemById(d.equipped.skin);
  const close = () => g.ui.closeModal('admin');
  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), profile: { grade: d.grade, level: d.level, coins: d.coins, playSeconds: Math.round(d.playSeconds) }, lessons: d.lessons, achievements: d.achievements, log }, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `read-practice-otchet-${dayKey(Date.now())}.json` });
      document.body.append(a); a.click(); a.remove();
      g.ui.toast('📥 Отчёт сохранён в файл');
    } catch (_) { g.ui.toast('Не удалось сохранить файл', 'warn'); }
  };
  const side = h('aside', { class: 'adm-side' },
    h('div', { class: 'adm-brand', html: 'READ<span>&amp;</span>PRACTICE<small>панель ученика</small>' }),
    h('div', { class: 'adm-profile' },
      h('div', { class: 'adm-ava' }, skin?.icon || '🧒'),
      h('div', {}, h('b', {}, 'Ученик'), h('small', {}, `${d.grade} класс · ур. ${d.level}`))),
    nav,
    h('div', { class: 'adm-side-foot' },
      h('button', { class: 'adm-btn ghost', onclick: exportJson }, '📥 Скачать отчёт'),
      h('button', { class: 'adm-btn ghost', onclick: close }, '✕ Закрыть')));

  const header = (title, sub, extra) => h('header', { class: 'adm-head' },
    h('div', {}, h('div', { class: 'adm-crumb' }, `Панель / ${title}`), h('h2', {}, title), sub ? h('p', {}, sub) : null),
    extra || h('div', { class: 'adm-now' }, `Обновлено ${fmtDate(Date.now())}`));

  const card = (title, body, cls = '') => h('section', { class: `adm-card ${cls}` }, title ? h('h3', {}, title) : null, body);

  // ---------- графики ----------
  const hbar = (rows) => {
    // rows: [{ label, value(0..100), note, mark }]
    const wrap = h('div', { class: 'adm-hbar' });
    const tip = h('div', { class: 'adm-tip', hidden: true });
    rows.forEach((r) => {
      const row = h('div', { class: 'hb-row', tabindex: 0 },
        h('span', { class: 'hb-label' }, r.label),
        h('span', { class: 'hb-track' }, h('span', { class: `hb-fill ${r.value ? '' : 'empty'}`, style: { width: `${Math.max(r.value ? 2 : 0, r.value)}%` } })),
        h('span', { class: 'hb-val' }, r.value ? `${r.value}%` : '—', r.mark ? h('i', { class: 'mk', style: { background: MARK_COLOR[r.mark] } }, r.mark) : null));
      const show = (e) => { tip.hidden = false; tip.textContent = r.note; const b = wrap.getBoundingClientRect(); tip.style.left = `${Math.min(b.width - 200, Math.max(0, (e.clientX || b.left + 100) - b.left + 12))}px`; tip.style.top = `${row.offsetTop - 30}px`; };
      row.addEventListener('mousemove', show);
      row.addEventListener('focus', show);
      row.addEventListener('mouseleave', () => (tip.hidden = true));
      row.addEventListener('blur', () => (tip.hidden = true));
      wrap.append(row);
    });
    wrap.append(tip);
    return wrap;
  };

  const vbar = (cols) => {
    // cols: [{ label, value, note }]
    const max = Math.max(1, ...cols.map((c) => c.value));
    const nice = Math.ceil(max / 5) * 5 || 5;
    const wrap = h('div', { class: 'adm-vbar' });
    const plot = h('div', { class: 'vb-plot' });
    [1, 0.5, 0].forEach((f) => plot.append(h('div', { class: 'vb-grid', style: { bottom: `${f * 100}%` } }, h('span', {}, Math.round(nice * f)))));
    const tip = h('div', { class: 'adm-tip', hidden: true });
    cols.forEach((c, i) => {
      const col = h('div', { class: 'vb-col', tabindex: 0 },
        h('div', { class: `vb-fill ${i === cols.length - 1 ? 'last' : ''}`, style: { height: `${(c.value / nice) * 100}%` } }));
      const show = () => { tip.hidden = false; tip.textContent = c.note; tip.style.left = `${Math.min(col.offsetLeft, plot.clientWidth - 160)}px`; tip.style.top = '-8px'; };
      col.addEventListener('mouseenter', show); col.addEventListener('focus', show);
      col.addEventListener('mouseleave', () => (tip.hidden = true)); col.addEventListener('blur', () => (tip.hidden = true));
      plot.append(col);
    });
    plot.append(tip);
    wrap.append(plot, h('div', { class: 'vb-axis' }, cols.map((c, i) => h('span', {}, i % 2 === 0 || cols.length < 8 ? c.label : ''))));
    return wrap;
  };

  const typeBadge = (t) => { const T = LOG_TYPES[t] || { name: t, icon: '•', color: '#7a7799' }; return h('span', { class: 'adm-badge', style: { '--c': T.color } }, `${T.icon} ${T.name}`); };
  const where = (e) => e.place || (e.subject ? `${e.subject}${e.cls ? `, ${e.cls} кл.` : ''}` : `день ${e.day}`);

  const logTable = (rows) => {
    if (!rows.length) return h('div', { class: 'adm-empty' }, '🗂️ Записей пока нет. Поиграй — и здесь появится всё, что ты делаешь: уроки, ответы, покупки, переходы.');
    return h('div', { class: 'adm-table-wrap' }, h('table', { class: 'adm-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Время'), h('th', {}, 'Тип'), h('th', {}, 'Действие'), h('th', {}, 'Где / предмет'), h('th', { class: 'r' }, 'День'))),
      h('tbody', {}, rows.map((e) => h('tr', {},
        h('td', { class: 'mono' }, fmtFull(e.t)), h('td', {}, typeBadge(e.type)),
        h('td', { class: 'txt' }, e.text, e.type === 'answer' ? h('i', { class: `ok-dot ${e.ok ? 'ok' : 'bad'}` }) : null),
        h('td', { class: 'muted' }, where(e)), h('td', { class: 'r mono' }, e.day))))));
  };

  // ---------- разделы ----------
  const sections = {
    overview() {
      const kpi = (ic, label, value, sub, tone = '') => h('div', { class: `adm-kpi ${tone}` }, h('div', { class: 'k-top' }, h('span', { class: 'k-ic' }, ic), h('span', { class: 'k-label' }, label)), h('div', { class: 'k-val' }, value), h('div', { class: 'k-sub' }, sub));
      const kpis = h('div', { class: 'adm-kpis' },
        kpi('⏱', 'Время в игре', fmtDur(d.playSeconds), d.firstPlayed ? `с ${fmtDate(d.firstPlayed)}` : 'первая сессия'),
        kpi('📖', 'Уроков пройдено', lessonEnds.length || d.stats.lessons, `сдано предметов ${d.grade} кл.: ${passed}/${gradeAll.length}`),
        kpi('⭐', 'Средняя оценка', avg ? avg.toFixed(1).replace('.', ',') : '—', marks.length ? `по ${marks.length} урокам` : 'нет оценок', avg >= 4.5 ? 'good' : avg && avg < 3 ? 'bad' : ''),
        kpi('🎯', 'Точность ответов', `${acc}%`, `${correct} верных · ${wrong} ошибок`, acc >= 80 ? 'good' : acc && acc < 50 ? 'bad' : ''),
        kpi('🪙', 'Монеты', d.coins, `заработано ${d.totals?.earned ?? 0} · потрачено ${d.totals?.spent ?? 0}`),
        kpi('🎓', 'Класс и уровень', `${d.grade} кл. · ур. ${d.level}`, `опыт ${d.xp}/${SaveManager.xpForLevel(d.level)}`),
        kpi('🏅', 'Достижения', `${Object.keys(d.achievements).length}/${ACHIEVEMENTS.length}`, `звёзд знаний ${Object.keys(d.collected).length}/${STAR_TOTAL}`),
        kpi('📅', 'Учебный день', d.progress.day, `лучшее комбо ×${d.stats.maxCombo}`));
      // результаты по предметам текущего класса
      const rows = gradeAll.map((L) => {
        const r = d.lessons[L.id];
        return { label: `${L.icon} ${L.subject}`, value: r ? r.bestPct : 0, mark: r ? r.best : null, note: r ? `${L.subject}: лучший результат ${r.bestPct}%, оценка ${r.best}, попыток ${r.plays}` : `${L.subject}: ещё не сдан` };
      });
      // активность по дням (последние 14 календарных дней)
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const t = Date.now() - i * 86400000;
        const k = dayKey(t);
        const cnt = log.filter((e) => dayKey(e.t) === k).length;
        const dt = new Date(t);
        days.push({ label: `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}`, value: cnt, note: `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}: ${cnt} действий` });
      }
      const recent = log.slice(-8).reverse();
      return [
        header('Обзор', 'Сводка по всему, что ученик делал в игре'),
        kpis,
        h('div', { class: 'adm-grid2' },
          card(`Результаты по предметам · ${d.grade} класс`, rows.length ? hbar(rows) : h('div', { class: 'adm-empty' }, 'Нет предметов')),
          card('Активность по дням', h('div', {}, vbar(days), h('p', { class: 'adm-note' }, 'Число записей в журнале за последние 14 дней. Наведи на столбец, чтобы увидеть точное число.')))),
        card('Последние действия', logTable(recent)),
      ];
    },

    journal() {
      const counts = {};
      log.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
      const chips = h('div', { class: 'adm-chips' },
        h('button', { class: `adm-chip ${state.filter === 'all' ? 'on' : ''}`, onclick: () => { state.filter = 'all'; state.limit = 80; render(); } }, `Все · ${log.length}`),
        Object.entries(LOG_TYPES).filter(([k]) => counts[k]).map(([k, T]) => h('button', { class: `adm-chip ${state.filter === k ? 'on' : ''}`, style: { '--c': T.color }, onclick: () => { state.filter = k; state.limit = 80; render(); } }, `${T.icon} ${T.name} · ${counts[k]}`)));
      const search = h('input', { class: 'adm-search', id: 'adm-search', type: 'search', placeholder: '🔍 Поиск по журналу…', value: state.query });
      search.addEventListener('input', () => { state.query = search.value; state.limit = 80; renderJournalBody(); });
      const body = h('div');
      const renderJournalBody = () => {
        const q = state.query.trim().toLowerCase();
        const rows = log.filter((e) => (state.filter === 'all' || e.type === state.filter) && (!q || `${e.text} ${where(e)}`.toLowerCase().includes(q))).reverse();
        body.innerHTML = '';
        body.append(h('div', { class: 'adm-note' }, `Найдено записей: ${rows.length}`), logTable(rows.slice(0, state.limit)));
        if (rows.length > state.limit) body.append(h('button', { class: 'adm-btn', onclick: () => { state.limit += 150; renderJournalBody(); } }, `Показать ещё (${rows.length - state.limit})`));
      };
      renderJournalBody();
      const clearBtn = h('button', { class: `adm-btn ${state.confirmClear ? 'danger' : 'ghost-dark'}`, onclick: () => {
        if (!state.confirmClear) { state.confirmClear = true; render(); return; }
        d.log = []; g.save.save(); g.ui.toast('🧹 Журнал очищен'); g.ui.closeModal('admin'); openAdmin(g, 'journal');
      } }, state.confirmClear ? 'Нажми ещё раз, чтобы очистить' : '🧹 Очистить журнал');
      return [header('Журнал действий', 'Каждое действие ученика: уроки, ответы, задания, переходы, покупки', h('div', { class: 'adm-head-tools' }, search, clearBtn)), chips, card(null, body)];
    },

    lessons() {
      const rows = lessonEnds.slice().reverse();
      const table = rows.length ? h('div', { class: 'adm-table-wrap' }, h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Дата'), h('th', {}, 'Класс'), h('th', {}, 'Предмет'), h('th', { class: 'r' }, 'Оценка'), h('th', { class: 'r' }, 'Верно'), h('th', { class: 'r' }, 'Время'), h('th', {}, 'Режим'), h('th', { class: 'r' }, 'Монеты'))),
        h('tbody', {}, rows.map((e) => h('tr', {},
          h('td', { class: 'mono' }, fmtDate(e.t)), h('td', { class: 'mono' }, `${e.cls}`), h('td', {}, e.subject),
          h('td', { class: 'r' }, h('i', { class: 'mk', style: { background: MARK_COLOR[e.mark] } }, e.mark)),
          h('td', { class: 'r mono' }, `${e.pct}%`), h('td', { class: 'r mono' }, fmtDur(e.secs)),
          h('td', { class: 'muted' }, e.timeUp ? '⏰ время вышло' : e.scheduled ? '📅 по расписанию' : '✏️ свободная практика'),
          h('td', { class: 'r mono' }, `+${e.coins ?? 0}`)))))) : h('div', { class: 'adm-empty' }, '📚 Пока нет завершённых уроков.');
      // прогресс по всем классам
      const prog = [];
      for (let gr = 1; gr <= 11; gr++) {
        const all = g.lessons.forGrade(gr);
        const p = all.filter((L) => d.lessons[L.id] && d.lessons[L.id].best >= 3).length;
        prog.push({ label: `${gr} класс`, value: Math.round((p / all.length) * 100), note: `${gr} класс: сдано ${p} из ${all.length} предметов (${GRADES[gr].map((s) => SUBJECTS[s].short || SUBJECTS[s].name).join(', ')})` });
      }
      return [
        header('Уроки и оценки', 'История каждого урока и прогресс по всем 11 классам'),
        h('div', { class: 'adm-grid2' },
          card('Прогресс по классам (сдано на «3» и выше)', hbar(prog)),
          card('Распределение оценок', (() => {
            const c = { 5: 0, 4: 0, 3: 0, 2: 0 };
            marks.forEach((m) => c[m]++);
            const total = marks.length || 1;
            return h('div', { class: 'adm-dist' }, [5, 4, 3, 2].map((m) => h('div', { class: 'dist-row' },
              h('i', { class: 'mk', style: { background: MARK_COLOR[m] } }, m),
              h('span', { class: 'hb-track' }, h('span', { class: 'hb-fill', style: { width: `${(c[m] / total) * 100}%` } })),
              h('span', { class: 'hb-val' }, `${c[m]} шт.`))), h('p', { class: 'adm-note' }, `Всего оценок: ${marks.length}. Ответов дано: ${answers.length}.`));
          })())),
        card('Все уроки', table),
      ];
    },

    shop() {
      const buys = log.filter((e) => e.type === 'shop' || e.type === 'equip').reverse();
      const outfit = h('div', { class: 'adm-outfit' }, CATEGORIES.map((c) => {
        const it = itemById(d.equipped[c.id]);
        return h('div', { class: 'of-item' }, h('span', { class: 'of-ic' }, it?.icon || '—'), h('div', {}, h('small', {}, c.name), h('b', {}, it?.name || 'не надето')));
      }));
      return [
        header('Покупки и образ', `Куплено предметов: ${d.owned.length} · потрачено монет: ${d.totals?.spent ?? 0}`),
        card('Сейчас надето', outfit),
        card('История покупок и переодеваний', logTable(buys)),
      ];
    },

    achievements() {
      const list = h('div', { class: 'adm-ach' }, ACHIEVEMENTS.map((a) => {
        const t = d.achievements[a.id];
        return h('div', { class: `ach-row ${t ? '' : 'locked'}` }, h('span', { class: 'ai' }, a.icon), h('div', {}, h('b', {}, a.name), h('small', {}, a.desc)), h('span', { class: 'ach-date mono' }, t ? fmtDate(t) : 'закрыто'));
      }));
      return [header('Достижения', `Открыто ${Object.keys(d.achievements).length} из ${ACHIEVEMENTS.length}`), card(null, list)];
    },
  };

  const render = () => {
    renderNav();
    main.innerHTML = '';
    main.append(...[].concat(sections[state.section]()));
    main.scrollTop = 0;
  };
  render();

  const el = h('div', { class: 'overlay adm-overlay', onclick: (e) => e.target === el && close() }, h('div', { class: 'adm pop' }, side, main));
  el._close = close;
  g.ui.openModal('admin', el);
  void esc;
}
