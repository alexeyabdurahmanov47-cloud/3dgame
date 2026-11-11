// Глобальные настройки игры. Меняйте значения здесь, чтобы настроить баланс.
export const CONFIG = {
  lesson: {
    gameMinutes: 30, // длительность урока в игровых минутах
    realSeconds: 300, // сколько это реальных секунд (по умолчанию 30 мин = 5 реальных минут)
    breakMinutes: 15, // длина перемены в игровых минутах
    firstLessonStart: 8 * 60 + 30, // 8:30
  },
  clock: {
    start: 7 * 60 + 30, // 7:30 — время пробуждения
    realSecondsPerGameMinute: 6, // скорость игровых часов вне урока
    earlyBird: 8 * 60 + 15, // прийти в школу раньше этого времени = достижение
  },
  rewards: {
    correct: 5, // монеты за правильный ответ
    xpCorrect: 10,
    comboBonus: 2, // доп. монеты за каждый шаг комбо (с 3-го ответа подряд)
    perfectBonus: 20, // всё правильно
    scheduleBonus: 10, // урок по расписанию
    repeatFactor: 0.5, // повторное прохождение урока
    hintCost: 2,
    coinPickup: 3,
    waterFlower: 2,
    readSign: 1,
    star: 15,
  },
  player: {
    walkSpeed: 4.2,
    runSpeed: 7.2,
    jump: 6.2,
    gravity: 18,
    radius: 0.32,
    height: 1.6,
  },
  // Сколько уроков в учебном дне. Предметы берутся из учебного плана класса
  // (src/lessons/curriculum.js), сначала — ещё не сданные.
  lessonsPerDay: 4,
  startCoins: 50,
};
