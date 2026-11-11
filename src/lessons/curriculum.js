// Школьная программа: предметы и учебный план по классам.
// Этаж школы = номер класса (1 этаж — 1 класс ... 11 этаж — 11 класс).
// kind — тип кабинета (как он выглядит и какое оборудование в нём стоит).

export const SUBJECTS = {
  russian: { name: 'Русский язык', icon: '📝', color: '#3fa7ff', kind: 'class', teacher: 'Мария Ивановна', avatar: '👩‍🏫' },
  reading: { name: 'Литературное чтение', icon: '📖', color: '#e17055', kind: 'class', teacher: 'Ольга Сергеевна', avatar: '👩‍🏫' },
  literature: { name: 'Литература', icon: '📚', color: '#e17055', kind: 'class', teacher: 'Ольга Сергеевна', avatar: '👩‍🏫' },
  english: { name: 'Английский язык', icon: '🇬🇧', color: '#a55eea', kind: 'class', teacher: 'Mr. Smith (Джон Смит)', avatar: '👨‍🏫', lang: 'en-US' },
  german: { name: 'Немецкий язык (2-й иностранный)', short: 'Немецкий язык', icon: '🇩🇪', color: '#636e72', kind: 'class', teacher: 'Frau Müller (Анна Мюллер)', avatar: '👩‍🏫', lang: 'de-DE' },
  math: { name: 'Математика', icon: '🔢', color: '#ff6b6b', kind: 'class', teacher: 'Анна Петровна', avatar: '👩‍🏫' },
  algebra: { name: 'Алгебра', icon: '➗', color: '#ff6b6b', kind: 'class', teacher: 'Анна Петровна', avatar: '👩‍🏫' },
  geometry: { name: 'Геометрия', icon: '📐', color: '#fd9644', kind: 'class', teacher: 'Сергей Викторович', avatar: '👨‍🏫' },
  probability: { name: 'Вероятность и статистика', short: 'Вероятность', icon: '🎲', color: '#fa8231', kind: 'class', teacher: 'Сергей Викторович', avatar: '👨‍🏫' },
  world: { name: 'Окружающий мир', icon: '🌿', color: '#2ed573', kind: 'bio', teacher: 'Светлана Николаевна', avatar: '👩‍🏫' },
  history: { name: 'История', icon: '🏛️', color: '#e1b12c', kind: 'class', teacher: 'Игорь Васильевич', avatar: '👨‍🏫' },
  social: { name: 'Обществознание', icon: '⚖️', color: '#8c7ae6', kind: 'class', teacher: 'Наталья Андреевна', avatar: '👩‍💼' },
  geography: { name: 'География', icon: '🗺️', color: '#00cec9', kind: 'geo', teacher: 'Елена Викторовна', avatar: '👩‍🏫' },
  biology: { name: 'Биология', icon: '🧬', color: '#20bf6b', kind: 'bio', teacher: 'Пётр Николаевич', avatar: '👨‍🔬' },
  physics: { name: 'Физика', icon: '⚡', color: '#4b7bec', kind: 'phys', teacher: 'Виктор Павлович', avatar: '👨‍🔬' },
  chemistry: { name: 'Химия', icon: '⚗️', color: '#eb3b5a', kind: 'chem', teacher: 'Людмила Ивановна', avatar: '👩‍🔬' },
  informatics: { name: 'Информатика', icon: '💻', color: '#0984e3', kind: 'it', teacher: 'Дмитрий Алексеевич', avatar: '👨‍💻' },
  odnknr: { name: 'ОДНКНР', icon: '🕊️', color: '#e58e26', kind: 'class', teacher: 'Галина Петровна', avatar: '👩‍🏫', full: 'Основы духовно-нравственной культуры народов России' },
  orkse: { name: 'ОРКСЭ', icon: '🕊️', color: '#e58e26', kind: 'class', teacher: 'Галина Петровна', avatar: '👩‍🏫', full: 'Основы религиозных культур и светской этики' },
  music: { name: 'Музыка', icon: '🎵', color: '#e84393', kind: 'music', teacher: 'Анна Викторовна', avatar: '👩‍🎤' },
  art: { name: 'ИЗО', icon: '🎨', color: '#f368e0', kind: 'art', teacher: 'Кира Олеговна', avatar: '👩‍🎨', full: 'Изобразительное искусство' },
  mhk: { name: 'МХК (Искусство)', short: 'МХК', icon: '🖼️', color: '#c44569', kind: 'art', teacher: 'Кира Олеговна', avatar: '👩‍🎨', full: 'Мировая художественная культура' },
  tech: { name: 'Труд (Технология)', short: 'Труд', icon: '🔨', color: '#a0522d', kind: 'tech', teacher: 'Николай Степанович', avatar: '👨‍🔧' },
  obzr: { name: 'ОБЗР', icon: '🛡️', color: '#2d3436', kind: 'obzr', teacher: 'Майор Орлов', avatar: '👮', full: 'Основы безопасности и защиты Родины' },
  pe: { name: 'Физическая культура', short: 'Физкультура', icon: '⚽', color: '#10ac84', kind: 'gym', teacher: 'Тренер Алексей', avatar: '🏋️' },
};

// Учебный план: какие предметы изучаются в каком классе
const RANGES = {
  russian: [1, 11], reading: [1, 4], literature: [5, 11], english: [2, 11], german: [7, 9],
  math: [1, 6], algebra: [7, 11], geometry: [7, 11], probability: [7, 11],
  world: [1, 4], history: [5, 11], social: [6, 11], geography: [5, 11], biology: [6, 11],
  physics: [7, 11], chemistry: [8, 11], informatics: [7, 11], odnknr: [5, 9], orkse: [4, 4],
  music: [1, 8], art: [1, 7], mhk: [9, 11], tech: [1, 9], obzr: [8, 11], pe: [1, 11],
};

export const GRADES = {};
for (let g = 1; g <= 11; g++) {
  GRADES[g] = Object.keys(SUBJECTS).filter((s) => RANGES[s][0] <= g && g <= RANGES[s][1]);
}

export const STAGE = (g) => (g <= 4 ? 'начальная школа' : g <= 9 ? 'основная школа' : 'старшая школа');

// В начальной школе основные предметы ведёт классный учитель
export function teacherFor(subj, grade) {
  const s = SUBJECTS[subj];
  if (grade <= 4 && ['russian', 'reading', 'math', 'world', 'tech'].includes(subj)) return { teacher: 'Светлана Николаевна', avatar: '👩‍🏫' };
  return { teacher: s.teacher, avatar: s.avatar };
}
