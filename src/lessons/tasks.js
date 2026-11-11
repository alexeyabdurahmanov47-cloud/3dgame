import { h, shuffle, esc } from '../ui/dom.js';
import { PRACTICALS } from './practicals.js';

// Типы заданий PRACTICE. Каждый тип: render(el, task, ctx) → { check(): result, auto?: boolean }
// result: { frac: 0..1 (доля правильного), answer: 'правильный ответ для показа' }
// ctx.done(result) — для заданий, которые проверяются сразу по клику.
// Чтобы добавить новый тип — добавьте сюда объект и используйте "type": "<имя>" в JSON.

export const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:«»"']/g, '').replace(/\s+/g, ' ').trim();
const answers = (a) => (Array.isArray(a) ? a : [a]).map(norm);

function question(el, task, extra) {
  el.append(h('div', { class: 'q', html: `${esc(task.q || '')}${extra ? `<small>${esc(extra)}</small>` : ''}` }));
  if (task.big) el.append(h('div', { class: 'big-ex' }, task.big));
}

export const TASK_TYPES = {
  // Выбор одного ответа
  choice: {
    render(el, task, ctx) {
      question(el, task, 'Выбери правильный ответ');
      const correct = typeof task.answer === 'number' ? task.options[task.answer] : task.answer;
      const box = h('div', { class: 'opts' });
      const btns = shuffle(task.options).map((o) => {
        const b = h('button', { class: 'opt', onclick: () => {
          btns.forEach((x) => (x.disabled = true));
          const ok = o === correct;
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) btns.find((x) => x.dataset.v === correct)?.classList.add('right');
          ctx.done({ frac: ok ? 1 : 0, answer: correct });
        } }, o);
        b.dataset.v = o;
        return b;
      });
      box.append(...btns);
      el.append(box);
      return { auto: true };
    },
  },

  // Верно / неверно
  truefalse: {
    render(el, task, ctx) {
      question(el, task, 'Это утверждение верно?');
      const box = h('div', { class: 'opts' });
      const mk = (val, label) => h('button', { class: 'opt', style: { textAlign: 'center' }, onclick: (e) => {
        box.querySelectorAll('button').forEach((x) => (x.disabled = true));
        const ok = val === !!task.answer;
        e.currentTarget.classList.add(ok ? 'right' : 'wrong');
        ctx.done({ frac: ok ? 1 : 0, answer: task.answer ? 'Верно' : 'Неверно' });
      } }, label);
      box.append(mk(true, '✅ Верно'), mk(false, '❌ Неверно'));
      el.append(box);
      return { auto: true };
    },
  },

  // Ввод ответа
  input: {
    render(el, task, ctx) {
      question(el, task, task.sub || 'Напиши ответ и нажми «Проверить»');
      const inp = h('input', { class: 'answer-input', placeholder: task.placeholder || 'Твой ответ...', autocomplete: 'off', spellcheck: 'false' });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctx.submit(); });
      el.append(inp);
      setTimeout(() => inp.focus(), 50);
      return {
        check() {
          const ok = answers(task.answer).includes(norm(inp.value));
          inp.classList.add(ok ? 'right' : 'wrong');
          inp.disabled = true;
          return { frac: ok ? 1 : 0, answer: Array.isArray(task.answer) ? task.answer[0] : task.answer };
        },
        empty: () => !inp.value.trim(),
      };
    },
  },

  // Сопоставление пар
  match: {
    render(el, task) {
      question(el, task, 'Нажми слово слева, затем пару справа');
      const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#e84393', '#fdcb6e', '#00cec9'];
      const pairs = task.pairs;
      const left = shuffle(pairs.map((p, i) => ({ t: p[0], i })));
      const right = shuffle(pairs.map((p, i) => ({ t: p[1], i })));
      const link = new Map(); // leftIndex -> rightIndex
      let sel = null;
      const lb = new Map(), rb = new Map();
      const paint = () => {
        lb.forEach((b, i) => { b.classList.toggle('sel', sel === i); });
        let k = 0;
        lb.forEach((b) => { b.style.background = ''; b.classList.remove('paired'); });
        rb.forEach((b) => { b.style.background = ''; b.classList.remove('paired'); });
        for (const [li, ri] of link) {
          const c = colors[k++ % colors.length];
          Object.assign(lb.get(li).style, { background: c });
          Object.assign(rb.get(ri).style, { background: c });
          lb.get(li).classList.add('paired');
          rb.get(ri).classList.add('paired');
        }
      };
      const L = h('div', { class: 'col' }, left.map((x) => {
        const b = h('button', { class: 'chipbtn', onclick: () => { sel = x.i; link.delete(x.i); paint(); } }, x.t);
        lb.set(x.i, b);
        return b;
      }));
      const R = h('div', { class: 'col' }, right.map((x) => {
        const b = h('button', { class: 'chipbtn', onclick: () => {
          if (sel === null) return;
          for (const [li, ri] of link) if (ri === x.i) link.delete(li);
          link.set(sel, x.i);
          sel = null;
          paint();
        } }, x.t);
        rb.set(x.i, b);
        return b;
      }));
      el.append(h('div', { class: 'match' }, L, R));
      return {
        empty: () => link.size < pairs.length,
        check() {
          let good = 0;
          for (const [li, ri] of link) {
            const ok = li === ri;
            if (ok) good++;
            lb.get(li).classList.add(ok ? 'right' : 'wrong');
            rb.get(ri).classList.add(ok ? 'right' : 'wrong');
          }
          [...lb.values(), ...rb.values()].forEach((b) => (b.disabled = true));
          return { frac: good / pairs.length, answer: pairs.map((p) => `${p[0]} — ${p[1]}`).join('; ') };
        },
      };
    },
  },

  // Правильный порядок
  order: {
    render(el, task) {
      question(el, task, task.sub || 'Нажимай на карточки по порядку');
      const area = h('div', { class: 'order-area' });
      const pool = h('div', { class: 'order-pool' });
      const chosen = [];
      const items = shuffle(task.items.map((t, i) => ({ t, i })));
      // не показываем уже правильный порядок
      if (items.every((x, k) => x.i === k) && items.length > 1) items.push(items.shift());
      const render = () => {
        area.innerHTML = '';
        pool.innerHTML = '';
        chosen.forEach((x, k) => area.append(h('button', { class: 'chipbtn sel', onclick: () => { chosen.splice(k, 1); render(); } }, x.t)));
        if (!chosen.length) area.append(h('span', { style: { color: '#b0a8d9', fontWeight: 800 } }, 'Сюда попадут выбранные карточки'));
        items.filter((x) => !chosen.includes(x)).forEach((x) => pool.append(h('button', { class: 'chipbtn', onclick: () => { chosen.push(x); render(); } }, x.t)));
      };
      render();
      el.append(area, pool);
      return {
        empty: () => chosen.length < items.length,
        check() {
          // сравниваем по тексту — на случай одинаковых элементов
          const ok = chosen.map((x) => x.t).join('|') === task.items.join('|');
          area.classList.add(ok ? 'right' : 'wrong');
          area.querySelectorAll('button').forEach((b) => (b.disabled = true));
          return { frac: ok ? 1 : 0, answer: task.items.join(task.join ?? ' ') };
        },
      };
    },
  },

  // Примеры по математике (генерируются случайно или задаются списком)
  math: {
    render(el, task) {
      question(el, task, 'Реши примеры');
      let ex = task.examples;
      if (!ex) {
        const { ops = ['+'], min = 1, max = 20, count = 3, kind } = task.gen || {};
        const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
        ex = Array.from({ length: count }, () => {
          if (kind === 'eq') { // линейное уравнение ax + b = c
            const x = r(min, max), a = r(2, 9), b = r(1, 20);
            return [`${a}x + ${b} = ${a * x + b}, x`, x];
          }
          if (kind === 'pow') { const a = r(min, max); return [`${a}²`, a * a]; }
          if (kind === 'neg') { const a = r(-max, max), b = r(-max, max); const op = Math.random() < 0.5 ? '+' : '−'; return [`(${a}) ${op} (${b})`, op === '+' ? a + b : a - b]; }
          if (kind === 'dec') { const a = r(min * 10, max * 10) / 10, b = r(min * 10, max * 10) / 10; return [`${String(a).replace('.', ',')} + ${String(b).replace('.', ',')}`, Math.round((a + b) * 10) / 10]; }
          if (kind === 'sqrt') { const a = r(min, max); return [`√${a * a}`, a]; }
          if (kind === 'percent') { const p = [10, 20, 25, 50][r(0, 3)], n = r(2, 20) * 20; return [`${p}% от ${n}`, (n * p) / 100]; }
          const op = ops[Math.floor(Math.random() * ops.length)];
          let a = r(min, max), b = r(min, max);
          if (op === '-') { if (b > a) [a, b] = [b, a]; return [`${a} − ${b}`, a - b]; }
          if (op === '×') return [`${a} × ${b}`, a * b];
          if (op === '÷') { const q = r(min, max); return [`${q * b} : ${b}`, q]; }
          return [`${a} + ${b}`, a + b];
        });
      }
      const rows = ex.map(([e, a]) => {
        const inp = h('input', { class: 'answer-input', inputmode: 'numeric', autocomplete: 'off' });
        const mark = h('span', { class: 'mark' });
        return { e, a, inp, mark, el: h('div', { class: 'mathrow' }, h('span', {}, `${e} =`), inp, mark) };
      });
      rows.forEach((r, i) => r.inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') rows[i + 1]?.inp.focus(); }));
      el.append(h('div', { class: 'mathrows' }, rows.map((r) => r.el)));
      setTimeout(() => rows[0]?.inp.focus(), 50);
      return {
        empty: () => rows.some((r) => !r.inp.value.trim()),
        check() {
          let good = 0;
          rows.forEach((r) => {
            const ok = Math.abs(parseFloat(String(r.inp.value).replace(',', '.').replace('−', '-')) - r.a) < 1e-6;
            if (ok) good++;
            r.inp.classList.add(ok ? 'right' : 'wrong');
            r.inp.disabled = true;
            r.mark.textContent = ok ? '✅' : `❌ ${r.a}`;
          });
          return { frac: good / rows.length, answer: rows.map((r) => `${r.e} = ${r.a}`).join(', ') };
        },
      };
    },
  },

  // Диктант: слово произносится голосом (или показывается на 2 секунды)
  dictation: {
    render(el, task, ctx) {
      const tts = ctx.canSpeak();
      question(el, task, tts ? 'Нажми 🔊, послушай слово и запиши его' : 'Нажми 👁, запомни слово и запиши его');
      const rows = task.words.map((w) => {
        const inp = h('input', { class: 'answer-input', autocomplete: 'off', spellcheck: 'false', style: { width: '260px' } });
        const flash = h('span', { style: { fontWeight: 900, fontSize: '24px', color: '#6c5ce7', minWidth: '120px' } });
        const btn = h('button', { class: 'btn small blue', onclick: () => {
          if (tts) ctx.speak(w, task.lang || 'ru-RU');
          else { flash.textContent = w; setTimeout(() => (flash.textContent = ''), 1800); }
        } }, tts ? '🔊' : '👁');
        const mark = h('span', { class: 'mark' });
        return { w, inp, mark, el: h('div', { class: 'mathrow' }, btn, inp, flash, mark) };
      });
      el.append(h('div', { class: 'mathrows' }, rows.map((r) => r.el)));
      if (tts) setTimeout(() => ctx.speak(rows[0].w, task.lang || 'ru-RU'), 300);
      return {
        empty: () => rows.some((r) => !r.inp.value.trim()),
        check() {
          let good = 0;
          rows.forEach((r) => {
            const ok = norm(r.inp.value) === norm(r.w);
            if (ok) good++;
            r.inp.classList.add(ok ? 'right' : 'wrong');
            r.inp.disabled = true;
            r.mark.textContent = ok ? '✅' : `❌ ${r.w}`;
          });
          return { frac: good / rows.length, answer: task.words.join(', ') };
        },
      };
    },
  },

  // Вставь пропущенную букву/слово с выбором вариантов: "text": "м_локо", "options": ["о","а"]
  gap: {
    render(el, task, ctx) {
      question(el, task, 'Выбери, что нужно вставить вместо пропуска');
      const word = h('div', { class: 'big-ex' });
      const show = (fill, cls = '') => { word.innerHTML = esc(task.text).replace('_', `<span class="${cls}" style="border-bottom:5px solid #6c5ce7;padding:0 6px">${fill ? esc(fill) : '&nbsp;?&nbsp;'}</span>`); };
      show('');
      el.append(word);
      const box = h('div', { class: 'opts' });
      const btns = shuffle(task.options).map((o) => h('button', { class: 'opt', style: { textAlign: 'center' }, onclick: (e) => {
        btns.forEach((b) => (b.disabled = true));
        const ok = norm(o) === norm(task.answer);
        e.currentTarget.classList.add(ok ? 'right' : 'wrong');
        show(task.answer, ok ? 'hl' : '');
        ctx.done({ frac: ok ? 1 : 0, answer: task.text.replace('_', task.answer) });
      } }, o));
      box.append(...btns);
      el.append(box);
      return { auto: true };
    },
  },
  ...PRACTICALS,
};
