// Загружает все уроки из папки lessons/data/*.json автоматически.
// Чтобы добавить урок — просто положите новый JSON‑файл в эту папку.
const modules = import.meta.glob('./data/*.json', { eager: true });

export class LessonManager {
  constructor() {
    this.list = Object.values(modules)
      .map((m) => m.default || m)
      .filter((l) => l && l.id && l.room)
      .sort((a, b) => String(a.room).localeCompare(String(b.room)));
    this.byId = Object.fromEntries(this.list.map((l) => [l.id, l]));
    this.byRoom = Object.fromEntries(this.list.map((l) => [String(l.room), l]));
  }
}
