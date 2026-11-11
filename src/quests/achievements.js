import { bus } from '../core/EventBus.js';
import { STAR_TOTAL } from '../scenes/entities.js';

export const ACHIEVEMENTS = [
  { id: 'first_lesson', icon: '📖', name: 'Первый урок', desc: 'Пройди свой первый урок' },
  { id: 'excellent', icon: '🏆', name: 'Отличник', desc: 'Получи оценку «5»' },
  { id: 'perfect', icon: '💯', name: 'Без единой ошибки', desc: 'Ответь правильно на все вопросы урока' },
  { id: 'combo5', icon: '🔥', name: 'В ударе!', desc: '5 правильных ответов подряд' },
  { id: 'combo10', icon: '⚡', name: 'Неудержимый', desc: '10 правильных ответов подряд' },
  { id: 'promoted', icon: '🎓', name: 'Переведён!', desc: 'Сдай все предметы класса и перейди в следующий' },
  { id: 'all_subjects', icon: '🌍', name: 'Эрудит', desc: 'Сдай все предметы своего класса' },
  { id: 'graduate', icon: '🎉', name: 'Выпускник', desc: 'Окончи 11 класс' },
  { id: 'lab', icon: '🔬', name: 'Юный исследователь', desc: 'Выполни практическую работу' },
  { id: 'athlete', icon: '🏅', name: 'Спортсмен', desc: 'Сдай норматив на физкультуре' },
  { id: 'reader', icon: '📚', name: 'Книгочей', desc: 'Прочитай все страницы трёх уроков' },
  { id: 'day1', icon: '🎒', name: 'Учебный день', desc: 'Заверши полный учебный день' },
  { id: 'early', icon: '🐦', name: 'Ранняя пташка', desc: 'Приди в школу раньше 8:15' },
  { id: 'road', icon: '🚦', name: 'Знаток ПДД', desc: 'Перейди дорогу на зелёный свет' },
  { id: 'rich', icon: '💰', name: 'Копилка', desc: 'Накопи 300 монет' },
  { id: 'fashion', icon: '👗', name: 'Модник', desc: 'Купи первый предмет в магазине' },
  { id: 'stars3', icon: '⭐', name: 'Искатель', desc: 'Найди 3 звезды знаний' },
  { id: 'stars_all', icon: '🌟', name: 'Звездочёт', desc: `Найди все ${STAR_TOTAL} звёзд знаний` },
  { id: 'gardener', icon: '🌷', name: 'Садовник', desc: 'Полей 10 цветов' },
  { id: 'dog', icon: '🐶', name: 'Друг животных', desc: 'Погладь собаку в парке' },
  { id: 'football', icon: '⚽', name: 'Футболист', desc: 'Пни мяч 10 раз' },
  { id: 'breakfast', icon: '🥞', name: 'Завтрак чемпиона', desc: 'Позавтракай перед школой' },
  { id: 'clean', icon: '🪥', name: 'Чистюля', desc: 'Почисти зубы утром' },
  { id: 'level5', icon: '🚀', name: 'Пятый уровень', desc: 'Достигни 5 уровня' },
  { id: 'curious', icon: '🧐', name: 'Любопытный', desc: 'Прочитай 5 табличек' },
];

export class Achievements {
  constructor(game) {
    this.game = game;
    const save = game.save;
    bus.on('stat', (name, v) => {
      if (name === 'flowers' && v >= 10) this.unlock('gardener');
      if (name === 'pets' && v >= 1) this.unlock('dog');
      if (name === 'kicks' && v >= 10) this.unlock('football');
      if (name === 'signs' && v >= 5) this.unlock('curious');
      if (name === 'maxCombo' && v >= 5) this.unlock('combo5');
      if (name === 'maxCombo' && v >= 10) this.unlock('combo10');
    });
    bus.on('coins', (c) => { if (c >= 300) this.unlock('rich'); });
    bus.on('levelup', (l) => { if (l >= 5) this.unlock('level5'); });
    bus.on('star', (n) => {
      if (n >= 3) this.unlock('stars3');
      if (n >= STAR_TOTAL) this.unlock('stars_all');
    });
    this.save = save;
  }

  has(id) { return !!this.save.data.achievements[id]; }

  unlock(id) {
    if (this.has(id)) return false;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return false;
    this.save.data.achievements[id] = Date.now();
    this.save.soon();
    // откладываем, чтобы не наложилось на другие звуки
    setTimeout(() => {
      this.game.audio.play('achievement');
      this.game.ui.toast(`${a.icon} <b>Достижение!</b><br>${a.name} <small>+10 🪙</small>`, 'achv', 4000);
      this.save.addCoins(10, 'achievement');
    }, 300);
    return true;
  }
}
