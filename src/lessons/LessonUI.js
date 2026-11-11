import { h, esc } from '../ui/dom.js';
import { TASK_TYPES } from './tasks.js';
import { CONFIG } from '../config.js';

// Разметка текста урока:
//   **слово**            — выделение цветом
//   [[слово|подсказка]]  — термин с всплывающей подсказкой
function markup(text) {
  return esc(text)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, w, hint) => `<span class="term" data-hint="${hint}">${w}</span>`)
    .replace(/\*\*([^*]+)\*\*/g, '<span class="hl">$1</span>');
}

const GRADE_COLORS = { 5: '#2ed573', 4: '#3fa7ff', 3: '#ffa502', 2: '#ff6b6b' };
const GRADE_WORDS = { 5: 'Отлично!', 4: 'Хорошо!', 3: 'Неплохо!', 2: 'Нужно повторить' };

export class LessonUI {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.el = null;
  }

  canSpeak() { return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; }

  speak(text, lang = 'ru-RU') {
    if (!this.canSpeak()) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  start(L, { scheduled = false, onFinish } = {}) {
    const g = this.game;
    this.L = L;
    this.scheduled = scheduled;
    this.onFinish = onFinish;
    this.active = true;
    this.phase = 'read';
    this.page = 0;
    this.seen = new Set([0]);
    let tasks = L.practice.slice();
    if (L.practiceCount && L.practiceCount < tasks.length) {
      // случайная выборка заданий, но в исходном порядке
      const idx = tasks.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, L.practiceCount).sort((a, b) => a - b);
      tasks = idx.map((i) => tasks[i]);
    }
    this.tasks = tasks;
    this.ti = 0;
    this.score = 0;
    this.results = [];
    this.combo = 0;
    this.maxCombo = 0;
    this.coins = 0;
    this.xp = 0;
    this.hintsUsed = 0;
    this.total = g.save.settings.lessonSeconds || CONFIG.lesson.realSeconds;
    this.left = this.total;
    this.repeat = !!g.save.data.lessons[L.id];
    g.audio.setMood('calm');

    this.timerEl = h('div', { class: 'timer' }, '⏰ 30:00');
    this.phasesEl = h('div', { class: 'phases' });
    this.body = h('div', { class: 'lesson-body' });
    this.foot = h('div', { class: 'lesson-foot' });
    this.el = h('div', { class: 'lesson' },
      h('div', { class: 'panel lesson-card pop' },
        h('div', { class: 'lesson-top', style: { background: L.color || '#6c5ce7' } },
          h('div', { class: 'subj' }, L.icon),
          h('div', { class: 't' }, h('h2', {}, `${L.subject}: ${L.title}`), h('div', {}, `${L.teacher || 'Учитель'} · кабинет ${L.room}${scheduled ? ' · по расписанию' : ' · свободная практика'}`)),
          this.timerEl),
        this.phasesEl, this.body, this.foot));
    g.ui.root.append(this.el);
    g.refreshInput();
    this.body.addEventListener('click', (e) => this.onTermClick(e));
    this.body.addEventListener('mouseover', (e) => { if (e.target.classList?.contains('term')) this.showTerm(e.target); });
    this.body.addEventListener('mouseout', (e) => { if (e.target.classList?.contains('term')) this.hideTerm(); });
    if (!L.read || !L.read.length) this.startPractice();
    else this.renderRead();
    if (g.ui.tipEl) { g.ui.tipEl.remove(); g.ui.tipEl = null; }
    this.firstTime = !g.save.data.seenTips.tip_lesson;
    g.save.data.seenTips.tip_lesson = true;
  }

  renderPhases() {
    const st = (p) => (this.phase === p ? 'on' : (p === 'read' && this.phase !== 'read') || (p === 'practice' && this.phase === 'result') ? 'done' : '');
    this.phasesEl.innerHTML = '';
    this.phasesEl.append(
      h('div', { class: `phase ${st('read')}`, html: '📖 READ<span class="long"> — чтение</span>' }),
      h('div', { class: `phase ${st('practice')}`, html: '✏️ PRACTICE<span class="long"> — практика</span>' }),
      h('div', { class: `phase ${st('result')}` }, '🏆 Итоги'));
  }

  // ---------- READ ----------
  renderRead() {
    const g = this.game;
    const L = this.L;
    const p = L.read[this.page];
    this.renderPhases();
    this.body.innerHTML = '';
    const paras = (Array.isArray(p.text) ? p.text : String(p.text).split(/\n\n+/)).map((t) => `<p>${markup(t)}</p>`).join('');
    if (this.firstTime && this.page === 0) this.body.append(h('div', { class: 'tipbox', style: { marginTop: 0, marginBottom: '14px', background: '#f0ecff', borderColor: '#6c5ce7' }, html: '🦉 <b>Сова Соня:</b> сначала <b>READ</b> — читай текст и нажимай на <b>жёлтые слова</b>, чтобы увидеть подсказки. Потом <b>PRACTICE</b> — задания по прочитанному!' }));
    this.body.append(h('div', { class: 'read-page pop' },
      p.pic ? h('div', { class: 'pic' }, p.pic) : null,
      h('h3', {}, p.title || ''),
      h('div', { class: 'ptext', html: paras }),
      p.tip ? h('div', { class: 'tipbox', html: `💡 ${markup(p.tip)}` }) : null));
    this.foot.innerHTML = '';
    const dots = h('div', { class: 'dots' }, L.read.map((_, i) => h('span', { class: i === this.page ? 'on' : this.seen.has(i) ? 'ok' : '' })));
    const last = this.page === L.read.length - 1;
    const plain = (Array.isArray(p.text) ? p.text.join(' ') : p.text).replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1').replace(/\*\*/g, '');
    this.foot.append(
      h('div', { class: 'read-tools' },
        h('button', { class: 'btn small white', disabled: this.page === 0, onclick: () => this.goPage(-1) }, '◀ Назад'),
        this.canSpeak() ? h('button', { class: 'btn small blue', onclick: () => this.speak(`${p.title}. ${plain}`, L.lang || 'ru-RU') }, '🔊 Озвучить') : null),
      dots,
      last
        ? h('button', { class: 'btn small green', onclick: () => this.startPractice() }, 'К практике ✏️')
        : h('button', { class: 'btn small', onclick: () => this.goPage(1) }, 'Дальше ▶'));
    void g;
  }

  goPage(d) {
    this.page = Math.max(0, Math.min(this.L.read.length - 1, this.page + d));
    this.seen.add(this.page);
    this.game.audio.play('page');
    if (this.canSpeak()) speechSynthesis.cancel();
    this.renderRead();
  }

  onTermClick(e) {
    const t = e.target.closest?.('.term');
    if (!t) { this.hideTerm(); return; }
    this.showTerm(t);
    this.game.audio.play('pop');
  }

  showTerm(t) {
    this.hideTerm();
    const r = t.getBoundingClientRect(), br = this.body.getBoundingClientRect();
    this.pop = h('div', { class: 'term-pop' }, `💡 ${t.dataset.hint}`);
    this.pop.style.left = Math.max(4, Math.min(br.width - 310, r.left - br.left)) + 'px';
    this.pop.style.top = (r.bottom - br.top + this.body.scrollTop + 6) + 'px';
    this.body.append(this.pop);
    t.classList.add('open');
    this.openTerm = t;
  }

  hideTerm() {
    if (this.pop) this.pop.remove();
    if (this.openTerm) this.openTerm.classList.remove('open');
    this.pop = this.openTerm = null;
  }

  // ---------- PRACTICE ----------
  startPractice() {
    if (this.canSpeak()) speechSynthesis.cancel();
    this.phase = 'practice';
    this.game.audio.play('whoosh');
    if (!this.tasks.length) return this.finish();
    this.renderTask();
  }

  renderTask() {
    const g = this.game;
    const task = this.tasks[this.ti];
    this.renderPhases();
    this.body.innerHTML = '';
    this.answered = false;
    const type = TASK_TYPES[task.type] || TASK_TYPES.choice;
    const wrap = h('div', { class: 'task pop' });
    this.body.append(wrap);
    this.feedback = h('div');
    const ctx = {
      done: (res) => this.onResult(res),
      submit: () => this.submit(),
      speak: (t, l) => this.speak(t, l),
      canSpeak: () => this.canSpeak(),
    };
    this.handler = type.render(wrap, task, ctx) || {};
    this.body.append(this.feedback);

    this.foot.innerHTML = '';
    this.comboEl = h('span', { class: 'combo' }, this.combo >= 2 ? `🔥 Комбо ×${this.combo}` : '');
    const dots = h('div', { class: 'dots' }, this.tasks.map((_, i) => h('span', { class: i === this.ti ? 'on' : this.results[i] ? (this.results[i].frac >= 1 ? 'ok' : 'bad') : '' })));
    this.hintBtn = task.hint ? h('button', { class: 'btn small white', onclick: () => this.useHint(task) }, `💡 Подсказка (${CONFIG.rewards.hintCost} 🪙)`) : null;
    this.actionBtn = this.handler.auto ? null : h('button', { class: 'btn small green', onclick: () => this.submit() }, 'Проверить ✓');
    this.nextBtn = h('button', { class: 'btn small hidden', onclick: () => this.next() }, this.ti === this.tasks.length - 1 ? 'Итоги 🏆' : 'Дальше ▶');
    this.foot.append(
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        h('span', { class: 'chip score-chip' }, `✏️ ${this.ti + 1}/${this.tasks.length}`),
        h('span', { class: 'chip score-chip' }, `🪙 +${this.coins}`), this.comboEl),
      dots,
      h('div', { style: { display: 'flex', gap: '8px' } }, this.hintBtn, this.actionBtn, this.nextBtn));
    void g;
  }

  useHint(task) {
    const g = this.game;
    if (!g.save.spend(CONFIG.rewards.hintCost)) { g.ui.toast('Не хватает монет на подсказку 😅'); return; }
    this.hintsUsed++;
    this.hintBtn.remove();
    this.feedback.prepend(h('div', { class: 'tipbox', html: `💡 ${markup(task.hint)}` }));
  }

  submit() {
    if (this.answered || !this.handler.check) return;
    if (this.handler.empty && this.handler.empty()) {
      this.game.ui.toast('✏️ Сначала ответь на все пункты задания!');
      return;
    }
    this.onResult(this.handler.check());
  }

  onResult(res) {
    if (this.answered) return;
    this.answered = true;
    const g = this.game;
    const task = this.tasks[this.ti];
    const R = CONFIG.rewards;
    this.results[this.ti] = res;
    this.score += res.frac;
    const perfect = res.frac >= 1;
    let coins = 0;
    if (perfect) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      coins = R.correct + (this.combo >= 3 ? R.comboBonus * (this.combo - 2) : 0);
      g.audio.play('correct');
      g.save.stat('correct');
    } else {
      this.combo = 0;
      coins = Math.round(R.correct * res.frac);
      g.audio.play(res.frac > 0 ? 'click' : 'wrong');
      g.save.stat('wrong');
    }
    if (this.repeat) coins = Math.round(coins * R.repeatFactor);
    this.coins += coins;
    this.xp += Math.round(R.xpCorrect * res.frac);
    if (g.save.data.stats.maxCombo < this.maxCombo) {
      g.save.data.stats.maxCombo = this.maxCombo;
      g.save.stat('maxCombo', 0);
    }
    const praise = ['Верно! 🎉', 'Молодец! ⭐', 'Отлично! 💪', 'Супер! 🚀', 'Так держать! 👍'];
    const html = perfect
      ? `${praise[Math.floor(Math.random() * praise.length)]} <b>+${coins} 🪙</b>${task.explain ? `<div class="exp">${markup(task.explain)}</div>` : ''}`
      : `${res.frac > 0 ? `Частично верно (${Math.round(res.frac * 100)}%)` : 'Не совсем так 🤔'}${coins ? ` <b>+${coins} 🪙</b>` : ''}
         <div class="exp">✅ Правильный ответ: <b>${esc(res.answer ?? '')}</b></div>${task.explain ? `<div class="exp">📘 ${markup(task.explain)}</div>` : ''}`;
    this.feedback.innerHTML = '';
    this.feedback.append(h('div', { class: `feedback ${perfect ? 'ok' : 'bad'}`, html }));
    requestAnimationFrame(() => { this.body.scrollTop = this.body.scrollHeight; });
    if (this.actionBtn) this.actionBtn.classList.add('hidden');
    if (this.hintBtn) this.hintBtn.remove();
    this.nextBtn.classList.remove('hidden');
    this.comboEl.textContent = this.combo >= 2 ? `🔥 Комбо ×${this.combo}` : '';
    setTimeout(() => this.nextBtn.focus(), 50);
  }

  next() {
    this.game.audio.play('click');
    this.ti++;
    if (this.ti >= this.tasks.length) this.finish();
    else this.renderTask();
  }

  // ---------- ИТОГИ ----------
  finish(timeUp = false) {
    const g = this.game;
    const L = this.L;
    const R = CONFIG.rewards;
    this.phase = 'result';
    if (this.canSpeak()) speechSynthesis.cancel();
    const max = this.tasks.length || 1;
    const pct = Math.round((this.score / max) * 100);
    const grade = pct >= 90 ? 5 : pct >= 70 ? 4 : pct >= 50 ? 3 : 2;
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
    let bonus = 0;
    const bonusLines = [];
    if (pct === 100) { bonus += R.perfectBonus; bonusLines.push(`💯 Без ошибок: +${R.perfectBonus}`); }
    if (this.scheduled) { bonus += R.scheduleBonus; bonusLines.push(`📅 Урок по расписанию: +${R.scheduleBonus}`); }
    const readAll = (L.read || []).length > 0 && this.seen.size >= L.read.length;
    if (readAll) { bonus += 5; bonusLines.push('📖 Прочитал все страницы: +5'); }
    if (this.repeat) bonus = Math.round(bonus * R.repeatFactor);
    const totalCoins = this.coins + bonus;
    const totalXp = this.xp + 20 + grade * 5;

    // сохраняем результат
    const rec = g.save.data.lessons[L.id] || { best: 0, bestPct: 0, plays: 0 };
    rec.plays++;
    rec.last = grade;
    rec.best = Math.max(rec.best, grade);
    rec.bestPct = Math.max(rec.bestPct, pct);
    rec.readAll = rec.readAll || readAll;
    g.save.data.lessons[L.id] = rec;
    g.save.stat('lessons');
    g.save.addCoins(totalCoins, 'lesson');
    g.save.addXp(totalXp);

    // достижения
    const A = g.achievements;
    A.unlock('first_lesson');
    if (grade === 5) A.unlock('excellent');
    if (pct === 100) A.unlock('perfect');
    const done = g.save.data.lessons;
    if (done.math && done.russian && done.english) A.unlock('big3');
    if (g.lessons.list.every((x) => done[x.id])) A.unlock('all_subjects');
    if (Object.values(done).filter((x) => x.readAll).length >= 3) A.unlock('reader');
    g.save.save();

    if (grade >= 4) { g.ui.confetti(); g.audio.play('levelup'); } else g.audio.play('achievement');

    this.renderPhases();
    this.body.innerHTML = '';
    const starEls = [0, 1, 2].map((i) => h('span', { class: i < stars ? '' : 'off', style: { animationDelay: `${0.3 + i * 0.25}s` } }, '⭐'));
    this.body.append(h('div', { class: 'result' },
      timeUp ? h('div', { class: 'chip', style: { background: '#ffe1e1' } }, '⏰ Время урока закончилось!') : null,
      h('div', { class: 'grade', style: { background: GRADE_COLORS[grade] } }, grade),
      h('h2', { style: { fontSize: '32px' } }, GRADE_WORDS[grade]),
      h('div', { class: 'stars' }, starEls),
      h('div', { class: 'res-grid' },
        h('div', { class: 'chip' }, `✅ ${pct}% правильно`),
        h('div', { class: 'chip' }, `🪙 +${totalCoins}`),
        h('div', { class: 'chip' }, `⭐ +${totalXp} XP`),
        h('div', { class: 'chip' }, `🔥 Лучшее комбо: ${this.maxCombo}`)),
      bonusLines.length ? h('div', { style: { fontWeight: 800, color: '#7a7799' } }, bonusLines.join(' · ')) : null,
      this.repeat ? h('div', { style: { fontWeight: 700, color: '#7a7799' } }, 'Повторное прохождение: монеты ×0.5') : null,
      h('div', { style: { fontWeight: 800, fontSize: '18px', maxWidth: '560px' } }, grade >= 4 ? (L.praise || 'Ты отлично поработал! Знания — твоя суперсила!') : 'Перечитай текст ещё раз и попробуй снова — у тебя всё получится!')));
    this.foot.innerHTML = '';
    this.foot.append(
      h('button', { class: 'btn small white', onclick: () => { const l = this.L, s = this.scheduled, f = this.onFinish; this.close(); this.start(l, { scheduled: false, onFinish: f }); void s; } }, '🔁 Пройти ещё раз'),
      h('button', { class: 'btn green', onclick: () => this.closeAndReturn({ grade, pct, coins: totalCoins }) }, 'Продолжить ▶'));
  }

  closeAndReturn(res) {
    const cb = this.onFinish;
    this.close();
    cb && cb(res);
  }

  close() {
    if (this.canSpeak()) speechSynthesis.cancel();
    this.hideTerm();
    if (this.el) this.el.remove();
    this.el = null;
    this.active = false;
    this.game.audio.setMood('happy');
    this.game.input.block(300);
    this.game.refreshInput();
  }

  abort() { if (this.active) this.close(); }

  update(dt) {
    if (!this.active || this.phase === 'result') return;
    if (this.game.ui.dialog.open) return;
    this.left -= dt;
    // игровые часы идут вместе с уроком
    this.game.save.progress.clock += (dt / this.total) * CONFIG.lesson.gameMinutes;
    const gameSec = Math.max(0, (this.left / this.total) * CONFIG.lesson.gameMinutes * 60);
    const mm = Math.floor(gameSec / 60), ss = Math.floor(gameSec % 60);
    const txt = `⏰ ${mm}:${String(ss).padStart(2, '0')}`;
    if (this.timerEl.textContent !== txt) this.timerEl.textContent = txt;
    this.timerEl.classList.toggle('low', mm < 5);
    if (this.left <= 0) {
      this.game.ringBell('Урок окончен!');
      this.finish(true);
    }
  }
}
