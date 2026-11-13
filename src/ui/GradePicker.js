import { h } from './dom.js';
import { GRADES, SUBJECTS, STAGE } from '../lessons/curriculum.js';

// Выбор класса (1–11). Этаж школы = номер класса.
export function openGradePicker(game, onPick) {
  const d = game.save.data;
  const cards = [];
  for (let g = 1; g <= 11; g++) {
    const subs = GRADES[g];
    const rec = d.lessons;
    const passed = game.lessons.forGrade(g).filter((L) => rec[L.id] && rec[L.id].best >= 3).length;
    cards.push(h('button', { class: `grade-card ${d.grade === g ? 'on' : ''}`, onclick: () => pick(g) },
      h('div', { class: 'gnum' }, g),
      h('div', { class: 'gname' }, `${g} класс`),
      h('div', { class: 'gstage' }, `${STAGE(g)} · ${g} этаж`),
      h('div', { class: 'gsubs' }, subs.map((s) => SUBJECTS[s].icon).join(' ')),
      h('div', { class: 'gprog' }, `${subs.length} предметов${passed ? ` · сдано ${passed}` : ''}`)));
  }
  const pick = (g) => {
    const changed = d.grade !== g;
    if (changed || !d.gradeChosen) game.save.log('grade', `Выбрал ${g} класс`);
    d.grade = g;
    d.gradeChosen = true;
    if (changed) {
      const p = d.progress;
      p.dayLessons = null;
      p.done = p.done.filter((id) => !id.startsWith('lesson_') && id !== 'go_home');
    }
    game.save.save();
    game.audio.play('buy');
    game.ui.closeModal('grades');
    if (changed && game.state === 'play') { game.quests.build(); game.quests.refresh(); }
    onPick && onPick(g);
  };
  game.ui.modal('grades', '🎓 Выбери свой класс', h('div', {},
    h('p', { style: { marginTop: 0, fontWeight: 700, color: '#7a7799' } }, 'В школе 11 этажей: на каждом учится свой класс. Сдай все предметы на «3» и выше — и тебя переведут в следующий класс!'),
    h('div', { class: 'grade-grid' }, cards)), { wide: true });
}
