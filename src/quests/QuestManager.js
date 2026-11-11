import { CONFIG } from '../config.js';
import { bus } from '../core/EventBus.js';

// Линейная цепочка заданий учебного дня. Задания можно выполнять и не по порядку:
// текущим считается первое невыполненное.
export class QuestManager {
  constructor(game) {
    this.game = game;
    this.steps = [];
  }

  // Уроки на сегодня (по кругу из CONFIG.schedule)
  dayLessons(day = this.game.save.progress.day) {
    const all = CONFIG.schedule.filter((id) => this.game.lessons.byId[id]);
    if (!all.length) return [];
    const res = [];
    const start = ((day - 1) * CONFIG.lessonsPerDay) % all.length;
    for (let i = 0; i < Math.min(CONFIG.lessonsPerDay, all.length); i++) res.push(all[(start + i) % all.length]);
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
      { id: 'wardrobe', scene: 'school', target: 'coatRack', text: 'Сдай куртку в гардероб', icon: '🧥' },
      ...lessons.map((id, i) => {
        const L = this.game.lessons.byId[id];
        return { id: `lesson_${id}`, scene: 'school', target: `desk_${L.room}`, lesson: id, no: i + 1, text: `Урок ${i + 1}: ${L.subject} — кабинет ${L.room}`, icon: L.icon };
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
    if (p && s.route) p = s.route(p);
    return p || null;
  }

  refresh() {
    const step = this.current();
    const hud = this.game.hud;
    if (!step) { hud.setQuest('Свободная игра', '', '🎉'); return; }
    hud.setQuest(step.text, '', step.icon);
  }
}
