import { CONFIG } from '../config.js';
import { bus } from '../core/EventBus.js';

const KEY = 'readpractice_save_v1';

export function defaultSave() {
  return {
    version: 1,
    coins: CONFIG.startCoins,
    xp: 0,
    level: 1,
    owned: ['skin_uniform', 'bp_classic'],
    equipped: { skin: 'skin_uniform', glasses: null, hat: null, backpack: 'bp_classic', watch: null, badge: null },
    log: [], // журнал действий игрока (для раздела «Информация»)
    playSeconds: 0, // сколько времени проведено в игре
    totals: { earned: 0, spent: 0 },
    firstPlayed: null,
    grade: 1, // текущий класс (= этаж школы)
    gradeChosen: false,
    lessons: {}, // id -> { best, bestPct, plays, readAll }
    achievements: {}, // id -> timestamp
    stats: { correct: 0, wrong: 0, flowers: 0, coinsPicked: 0, lessons: 0, maxCombo: 0, pets: 0, signs: 0, kicks: 0 },
    collected: {}, // id звёзд знаний -> true
    seenTips: {},
    settings: {
      music: true,
      musicVol: 0.5,
      sfxVol: 0.8,
      sens: 1,
      invertY: false,
      quality: 'high',
      lessonSeconds: CONFIG.lesson.realSeconds,
      labels: true,
    },
    progress: newDayProgress(1),
  };
}

export function newDayProgress(day) {
  return {
    day,
    scene: 'home',
    spawn: 'start',
    done: [], // выполненные шаги квестов за день
    clock: CONFIG.clock.start,
    lessonNo: 0,
    flags: {}, // dressed, backpack, breakfast...
    picked: {}, // монеты/цветы, собранные сегодня
    schoolFloor: 1,
    dayLessons: null,
  };
}

function merge(base, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data ?? base;
  const out = Array.isArray(base) ? [] : { ...base };
  for (const k of Object.keys(data)) {
    const b = base?.[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? merge(b, data[k]) : data[k];
  }
  return out;
}

export class SaveManager {
  constructor() {
    this.data = defaultSave();
    this.load();
    this._t = null;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaultSave(), JSON.parse(raw));
    } catch (e) {
      console.warn('Save load failed', e);
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      bus.emit('saved');
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  // отложенное сохранение (чтобы не писать в localStorage слишком часто)
  soon() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.save(), 400);
  }

  reset() {
    this.data = defaultSave();
    this.save();
  }

  hasProgress() {
    const p = this.data.progress;
    return p.day > 1 || p.done.length > 0 || this.data.stats.lessons > 0;
  }

  get settings() { return this.data.settings; }
  get progress() { return this.data.progress; }

  // Запись в журнал действий: type — категория, text — что произошло, extra — подробности
  log(type, text, extra = {}) {
    const d = this.data;
    if (!d.firstPlayed) d.firstPlayed = Date.now();
    d.log.push({ t: Date.now(), type, text, day: d.progress.day, grade: d.grade, ...extra });
    if (d.log.length > 2000) d.log.splice(0, d.log.length - 2000);
    bus.emit('log');
    this.soon();
  }

  addCoins(n, reason = '') {
    if (!n) return;
    if (n > 0) this.data.totals.earned += Math.round(n);
    this.data.coins = Math.max(0, this.data.coins + Math.round(n));
    bus.emit('coins', this.data.coins, Math.round(n), reason);
    this.soon();
  }

  spend(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.data.totals.spent += n;
    bus.emit('coins', this.data.coins, -n, 'spend');
    this.soon();
    return true;
  }

  static xpForLevel(level) { return 60 + level * 40; }

  addXp(n) {
    const d = this.data;
    d.xp += Math.round(n);
    let up = false;
    while (d.xp >= SaveManager.xpForLevel(d.level)) {
      d.xp -= SaveManager.xpForLevel(d.level);
      d.level++;
      up = true;
    }
    bus.emit('xp', d.xp, d.level);
    if (up) bus.emit('levelup', d.level);
    this.soon();
  }

  stat(name, inc = 1) {
    this.data.stats[name] = (this.data.stats[name] || 0) + inc;
    bus.emit('stat', name, this.data.stats[name]);
    this.soon();
  }
}
