// Уровни сложности хоррор-режима. Все числа — множители/параметры баланса.
// time      — доля времени на миссию
// speed     — скорость монстров, hear — радиус слуха, sight — дальность зрения (м)
// memory    — сколько секунд монстр помнит, где видел игрока
// damage    — множитель урона, lockers — доля шкафчиков-укрытий
// batteries — запасные батарейки на старте, drain — расход фонарика
// hints     — 2: маркер + карта, 1: только стрелка, 0: ничего
// events    — частота страшных событий, shuffle — случайные маршруты и перестройка школы
// extra     — усложнение головоломок (длиннее цепочки, больше элементов)
// checkLockers — монстр проверяет шкафчик, если видел, как ты в нём спрятался
export const DIFFICULTIES = [
  {
    id: 'nightmare', name: 'NIGHTMARE', ru: 'Кошмар', color: '#7d1d1d',
    desc: 'Монстры медленнее, укрытий много, есть маркер цели и карта. Всё равно страшно.',
    time: 1, speed: 1, hear: 1, sight: 15, memory: 6, damage: 1, lockers: 1, batteries: 3, drain: 1,
    hints: 2, events: 1, shuffle: false, extra: 0, teachers: 1, shadows: 1, checkLockers: false, regen: 1.5,
  },
  {
    id: 'insane', name: 'INSANE', ru: 'Безумие', color: '#951c1c',
    desc: 'Учитель слышит лучше и бегает быстрее. Карты больше нет — только стрелка.',
    time: 0.85, speed: 1.1, hear: 1.15, sight: 18, memory: 8, damage: 1.25, lockers: 0.8, batteries: 2, drain: 1.2,
    hints: 1, events: 1.25, shuffle: false, extra: 1, teachers: 1, shadows: 1, checkLockers: false, regen: 1,
  },
  {
    id: 'extreme', name: 'EXTREME', ru: 'Экстрим', color: '#ad1a1a',
    desc: 'Случайные маршруты патруля, школа перестраивается, монстр проверяет шкафчики.',
    time: 0.72, speed: 1.2, hear: 1.3, sight: 20, memory: 10, damage: 1.5, lockers: 0.6, batteries: 2, drain: 1.4,
    hints: 1, events: 1.5, shuffle: true, extra: 2, teachers: 1, shadows: 2, checkLockers: true, regen: 0.6,
  },
  {
    id: 'impossible', name: 'IMPOSSIBLE', ru: 'Невозможно', color: '#c41616',
    desc: 'Никаких подсказок. Одна батарейка. Две Тени. Урон почти вдвое больше.',
    time: 0.6, speed: 1.32, hear: 1.5, sight: 23, memory: 13, damage: 1.85, lockers: 0.45, batteries: 1, drain: 1.65,
    hints: 0, events: 1.75, shuffle: true, extra: 3, teachers: 1, shadows: 2, checkLockers: true, regen: 0.3,
  },
  {
    id: 'hell', name: 'HELL', ru: 'Ад', color: '#ff1a1a',
    desc: 'Два Учителя, три Тени, монстры быстрее тебя, здоровье не восстанавливается. Шум = смерть.',
    time: 0.5, speed: 1.45, hear: 1.8, sight: 26, memory: 16, damage: 2.3, lockers: 0.3, batteries: 1, drain: 1.9,
    hints: 0, events: 2, shuffle: true, extra: 4, teachers: 2, shadows: 3, checkLockers: true, regen: 0,
  },
];

export const diffById = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];

// Интенсивность скримеров (настройка игрока)
export const SCREAMERS = [
  { id: 'off', name: 'Выкл.', desc: 'Без резких лиц и криков — только красная вспышка' },
  { id: 'low', name: 'Слабо', desc: 'Короткие и тихие' },
  { id: 'mid', name: 'Средне', desc: 'Резкие, со звуком' },
  { id: 'high', name: 'Максимум', desc: 'Громко, на весь экран, с тряской' },
];

export const GORE = [
  { id: 'low', name: 'Меньше крови', desc: 'Тёмные пятна, без брызг на экране' },
  { id: 'high', name: 'Много крови', desc: 'Брызги, следы, отпечатки рук и кровавые надписи' },
];
