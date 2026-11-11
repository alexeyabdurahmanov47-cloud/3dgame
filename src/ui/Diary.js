import { h } from './dom.js';
import { ACHIEVEMENTS } from '../quests/achievements.js';
import { STAR_TOTAL } from '../scenes/entities.js';

// Дневник: оценки по предметам, достижения и статистика
export function openDiary(game) {
  const d = game.save.data;
  const gradeColor = { 5: '#2ed573', 4: '#3fa7ff', 3: '#ffa502', 2: '#ff6b6b' };
  const subjects = game.lessons.list.map((L) => {
    const r = d.lessons[L.id];
    return h('div', { class: 'subj-card', style: { background: L.color } },
      h('div', { class: 'ic' }, L.icon),
      h('div', { style: { fontSize: '18px' } }, L.subject),
      h('div', { style: { opacity: 0.9, fontSize: '14px' } }, `Кабинет ${L.room} · ${L.title}`),
      h('div', { style: { opacity: 0.9, fontSize: '14px', marginTop: '4px' } }, r ? `Попыток: ${r.plays} · лучший результат ${r.bestPct}%` : 'Ещё не пройден'),
      r ? h('div', { class: 'g', style: { color: '#fff', textShadow: `0 2px 0 ${gradeColor[r.best] || '#999'}` } }, r.best) : null);
  });
  const achs = ACHIEVEMENTS.map((a) => h('div', { class: `ach ${d.achievements[a.id] ? '' : 'locked'}` },
    h('div', { class: 'ai' }, a.icon), h('div', {}, h('b', {}, a.name), h('small', {}, a.desc))));
  const st = d.stats;
  const chip = (t) => h('div', { class: 'chip' }, t);
  const body = h('div', {},
    h('div', { class: 'stats' },
      chip(`⭐ Уровень ${d.level}`), chip(`🪙 ${d.coins}`), chip(`📅 День ${d.progress.day}`),
      chip(`✅ Верных ответов: ${st.correct}`), chip(`📖 Уроков: ${st.lessons}`), chip(`🌟 Звёзд: ${Object.keys(d.collected).length}/${STAR_TOTAL}`),
      chip(`🔥 Лучшее комбо: ${st.maxCombo}`), chip(`🌷 Цветов: ${st.flowers}`)),
    h('h3', { class: 'section-title' }, '📚 Предметы и оценки'),
    h('div', { class: 'diary-grid' }, subjects),
    h('h3', { class: 'section-title' }, `🏅 Достижения (${Object.keys(d.achievements).length}/${ACHIEVEMENTS.length})`),
    h('div', { class: 'ach-grid' }, achs));
  game.ui.modal('diary', '📒 Дневник', body, { wide: true });
}
