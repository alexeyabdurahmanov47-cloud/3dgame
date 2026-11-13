import { CONFIG } from '../config.js';
import { bus } from '../core/EventBus.js';

// Линейная цепочка заданий учебного дня. Задания можно выполнять и не по порядку:
// текущим считается первое невыполненное.
export class QuestManager {
  constructor(game) {
    this.game = game;
    this.steps = [];
  }

  // Уроки на сегодня: берутся по кругу из предметов текущего класса и запоминаются на весь день
  dayLessons() {
    const g = this.game;
    const prog = g.save.progress;
    const grade = g.save.data.grade || 1;
    if (prog.dayLessons && prog.dayGrade === grade && prog.dayLessons.every((id) => g.lessons.byId[id])) return prog.dayLessons;
    const all = g.lessons.forGrade(grade).map((l) => l.id);
    if (!all.length) return [];
    // сначала — ещё не сданные предметы, в «перемешанном» на каждый день порядке
    const rec = g.save.data.lessons;
    const pending = all.filter((id) => !(rec[id] && rec[id].best >= 3));
    let seed = prog.day * 7919 + grade * 104729;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const mix = (arr) => arr.map((id) => [rnd(), id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const order = [...mix(pending), ...mix(all.filter((id) => !pending.includes(id)))];
    const res = order.slice(0, Math.min(CONFIG.lessonsPerDay, order.length));
    // уроки в расписании идут в порядке учебного плана
    res.sort((a, b) => all.indexOf(a) - all.indexOf(b));
    prog.dayLessons = res;
    prog.dayGrade = grade;
    g.save.soon();
    return res;
  }

  build() {
    const lessons = this.dayLessons();
    this.steps = [
      { id: 'backpack', scene: 'home', target: 'backpack', text: 'Возьми рюкзак со стула', icon: '🎒' },
      { id: 'dress', scene: 'home', target: 'wardrobe', text: 'Переоденься в форму у шкафа', icon: '👕' },
      { id: 'leave_home', scene: 'home', target: 'door', text: 'Спустись по лестнице и выйди в подъезд', icon: '🚪' },
      { id: 'call_elevator', scene: 'hallway', target: 'elevatorButton', text: 'Вызови лифт кнопкой у дверей', icon: '🛗' },
      { id: 'enter_elevator', scene: 'hallway', target: 'elevator', text: 'Зайди в лифт', icon: '🛗' },
      { id: 'ride_elevator', scene: 'elevator', target: 'panel', text: 'Нажми кнопку «1» на панели лифта', icon: '🔘' },
      { id: 'exit_building', scene: 'elevator', target: 'exitDoor', text: 'Выйди из подъезда на улицу', icon: '🌤️' },
      { id: 'go_school', scene: 'street', target: 'schoolDoor', text: 'Дойди до школы по жёлтым стрелкам', icon: '🏫' },
      { id: 'wardrobe', scene: 'school', floor: 1, target: 'coatRack', text: 'Сдай куртку в гардероб', icon: '🧥' },
      ...lessons.map((id, i) => {
        const L = this.game.lessons.byId[id];
        return { id: `lesson_${id}`, scene: 'school', floor: L.floor, target: `desk_${L.room}`, lesson: id, no: i + 1, text: `Урок ${i + 1}: ${L.subject} — ${L.roomName}`, icon: L.icon };
      }),
      { id: 'go_home', scene: 'street', target: 'homeDoor', text: 'Уроки окончены! Возвращайся домой', icon: '🏠' },
    ];
  }

  isDone(id) { return this.game.save.progress.done.includes(id); }

  current() { return this.steps.find((s) => !this.isDone(s.id)) || null; }

  currentLesson() {
    const c = this.current();
    return c && c.lesson ? c : null;
  }

  complete(id, silent = false) {
    if (this.isDone(id) || !this.steps.find((s) => s.id === id)) return false;
    const prog = this.game.save.progress;
    prog.done.push(id);
    const st = this.steps.find((s) => s.id === id);
    if (st && !st.lesson) this.game.save.log('quest', `Выполнил задание: ${st.text}`);
    this.game.save.addXp(5);
    this.game.save.soon();
    if (!silent) {
      this.game.audio.play('correct');
      this.game.ui.toast('✅ Задание выполнено!');
    }
    bus.emit('quest', id, this.current());
    this.refresh();
    return true;
  }

  // позиция цели для текущей локации
  target() {
    const g = this.game;
    const s = g.scene;
    const step = this.current();
    if (!s || !step) return null;
    let p = step.scene === s.name ? s.points[step.target] : s.navPoint(step.scene);
    if (step.scene === s.name && step.floor && s.floor && s.floor !== step.floor) p = s.points.lift;
    if (p && s.route) p = s.route(p);
    return p || null;
  }

  // подсказка «поднимись на N этаж»
  extraSub() {
    const s = this.game.scene;
    const step = this.current();
    if (!s || !step || step.scene !== 'school' || !step.floor || s.name !== 'school') return '';
    if (s.floor === step.floor) return '';
    return `${step.floor > s.floor ? '⬆ Поднимись' : '⬇ Спустись'} на ${step.floor} этаж (лифт или лестница)`;
  }

  refresh() {
    const step = this.current();
    const hud = this.game.hud;
    if (!step) { hud.setQuest('Свободная игра', '', '🎉'); return; }
    hud.setQuest(step.text, '', step.icon);
  }
}
