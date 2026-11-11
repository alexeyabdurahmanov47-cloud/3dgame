import { SUBJECTS, GRADES, teacherFor } from './curriculum.js';

// Загружает все уроки из lessons/data/<предмет>.json.
// Формат файла: { "subject": "math", "lessons": { "1": {урок 1 класса}, "2": {...} } }
// Кабинет урока назначается автоматически: этаж = класс, номер = этаж*100 + порядковый номер предмета.
const modules = import.meta.glob('./data/*.json', { eager: true });

export function roomOf(subj, grade) {
  if (subj === 'pe') return { room: 'gym', floor: 1, roomName: 'спортзал (1 этаж)' };
  const idx = GRADES[grade].filter((s) => s !== 'pe').indexOf(subj);
  const room = String(grade * 100 + idx + 1);
  return { room, floor: grade, roomName: `каб. ${room}` };
}

export class LessonManager {
  constructor() {
    this.list = [];
    for (const m of Object.values(modules)) {
      const data = m.default || m;
      const meta = SUBJECTS[data.subject];
      if (!meta || !data.lessons) { console.warn('Неизвестный предмет в уроках:', data.subject); continue; }
      for (const [g, lesson] of Object.entries(data.lessons)) {
        const grade = +g;
        if (!GRADES[grade] || !GRADES[grade].includes(data.subject)) { console.warn(`Предмет ${data.subject} не изучается в ${grade} классе — урок пропущен`); continue; }
        this.list.push({
          id: `${data.subject}_${grade}`,
          subjectId: data.subject,
          grade,
          subject: meta.short || meta.name,
          subjectFull: meta.full || meta.name,
          icon: meta.icon,
          color: meta.color,
          kind: meta.kind,
          lang: meta.lang,
          ...teacherFor(data.subject, grade),
          teacherAvatar: teacherFor(data.subject, grade).avatar,
          ...roomOf(data.subject, grade),
          ...lesson,
        });
      }
    }
    this.list.sort((a, b) => a.grade - b.grade || GRADES[a.grade].indexOf(a.subjectId) - GRADES[b.grade].indexOf(b.subjectId));
    this.byId = Object.fromEntries(this.list.map((l) => [l.id, l]));
    for (let g = 1; g <= 11; g++) {
      const missing = GRADES[g].filter((s) => !this.byId[`${s}_${g}`]);
      if (missing.length) console.warn(`${g} класс: нет уроков по предметам`, missing.join(', '));
    }
  }

  forGrade(g) { return GRADES[g].map((s) => this.byId[`${s}_${g}`]).filter(Boolean); }
  get(subj, g) { return this.byId[`${subj}_${g}`]; }
}
