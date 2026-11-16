import { h, shuffle } from '../ui/dom.js';
import { seeded } from '../core/gfx.js';

// Головоломки хоррор-режима. Мир НЕ ставится на паузу: пока ты думаешь, монстры продолжают охоту.
// Каждая головоломка: (root, params, api) → строит интерфейс в root.
// api: wrong(msg) — штраф; solve() — решено; status(text); data(key, fn) — данные, которые
// сохраняются между открытиями (выйдешь и вернёшься — задача та же); extra/hints — сложность.

const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuf = (r, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
const normRu = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

function inputRow(placeholder, onSubmit, { type = 'text', width = '100%' } = {}) {
  const inp = h('input', { class: 'hz-input', type, placeholder, style: { width } });
  const go = () => { const v = inp.value; if (String(v).trim() === '') return; onSubmit(v, inp); };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
  inp.addEventListener('keyup', (e) => e.stopPropagation());
  const btn = h('button', { class: 'btn red small', onclick: go }, 'Проверить');
  setTimeout(() => inp.focus(), 50);
  return h('div', { class: 'hz-row' }, inp, btn);
}

// ---------------------------------------------------------------- 1. Код из осколков
function code(root, params, api) {
  const frs = api.mode.state.fragments; // [{n: вершин, d: цифра}]
  const shift = api.extra >= 3;
  const sorted = frs.slice().sort((a, b) => a.n - b.n);
  const answer = sorted.map((f, i) => (shift ? (f.d + i + 1) % 10 : f.d)).join('');
  const poly = (n) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pts.push(`${50 + Math.cos(a) * 38},${50 + Math.sin(a) * 38}`); }
    return `<svg viewBox="0 0 100 100" width="64" height="64"><polygon points="${pts.join(' ')}" fill="none" stroke="#c7b9a8" stroke-width="4"/></svg>`;
  };
  root.append(
    h('p', { class: 'hz-text' }, 'На каждом осколке — фигура и цифра. Сейф откроется кодом из семи цифр.'),
    h('div', { class: 'hz-note' }, 'Надпись на сейфе: «Цифры стоят в порядке возрастания числа вершин фигуры».' + (shift ? ' Ниже кровью: «К каждой цифре прибавь её место в коде (1…7) и оставь только последнюю цифру».' : '')),
    h('div', { class: 'hz-frags' }, ...frs.map((f) => h('div', { class: 'hz-frag', html: `${poly(f.n)}<b>${f.d}</b>` }))),
    inputRow('7 цифр', (v, inp) => {
      if (v.replace(/\D/g, '') === answer) api.solve();
      else { inp.value = ''; api.wrong('Сейф лязгнул. Неверный код.'); }
    }),
  );
}

// ---------------------------------------------------------------- 2. Цепочка вычислений
function chainStep(r, v, extra) {
  const ops = [];
  const add = (text, f, ok = true) => { if (ok) ops.push({ text, f }); };
  const k = rint(r, 3, 9), m = rint(r, 7, 13), d = rint(r, 2, 5), s = rint(r, 11, 49);
  add(`умножь на ${k}`, (x) => x * k, v < 400);
  add(`прибавь ${s}`, (x) => x + s);
  add(`вычти ${s}`, (x) => x - s, v > s);
  add('найди сумму цифр', (x) => String(x).split('').reduce((a, c) => a + +c, 0), v > 20);
  add(`найди остаток от деления на ${m}`, (x) => x % m, v > m * 2);
  add('возведи в квадрат', (x) => x * x, v < 32 && v > 2);
  add(`раздели на ${d} нацело (отбрось остаток)`, (x) => Math.floor(x / d), v >= d * 3);
  add('запиши цифры в обратном порядке', (x) => +String(x).split('').reverse().join(''), v > 10 && v % 10 !== 0);
  add('прибавь количество его делителей', (x) => { let c = 0; for (let i = 1; i <= x; i++) if (x % i === 0) c++; return x + c; }, v > 1 && v < 500);
  const a = pick(r, ops);
  let text = a.text, f = a.f;
  if (extra >= 2) {
    const v2 = a.f(v);
    const ops2 = [
      { text: `затем прибавь ${k}`, f: (x) => x + k },
      { text: `затем умножь на ${d}`, f: (x) => x * d, ok: v2 < 300 },
      { text: `затем вычти ${d}`, f: (x) => x - d, ok: v2 > d },
    ].filter((o) => o.ok !== false);
    const b = pick(r, ops2);
    text = `${a.text}, ${b.text}`;
    f = (x) => b.f(a.f(x));
  }
  return { text, value: f(v) };
}

function chain(root, params, api) {
  const st = api.mode.state;
  const D = api.data('chain' + params.part, () => {
    const r = seeded(api.seed + params.part * 77);
    let v = params.part === 1 ? rint(r, 6, 19) : null;
    return { start: v, steps: [], i: 0 };
  });
  if (D.start === null) D.start = st.chainValue;
  if (!D.steps.length) {
    const r = seeded(api.seed + params.part * 131);
    let v = D.start;
    for (let i = 0; i < params.steps; i++) { const s = chainStep(r, v, api.extra); D.steps.push(s); v = s.value; }
  }
  const box = h('div');
  const draw = () => {
    box.innerHTML = '';
    const n0 = (params.part - 1) * params.steps;
    const prev = D.i === 0 ? D.start : D.steps[D.i - 1].value;
    const hidePrev = D.i === 0 && params.part > 1 && api.hints === 0;
    box.append(
      h('div', { class: 'hz-note' }, `Шаг ${n0 + D.i + 1} из 15`),
      h('p', { class: 'hz-big' }, hidePrev ? 'Возьми результат последнего шага с прошлой доски' : `Возьми число ${prev}`),
      h('p', { class: 'hz-text' }, `…и ${D.steps[D.i].text}.`),
      h('div', { class: 'hz-steps' }, ...D.steps.map((s, i) => h('span', { class: i < D.i ? 'ok' : i === D.i ? 'cur' : '' }, i < D.i ? String(s.value) : '?'))),
      inputRow('Результат', (v, inp) => {
        if (+v.trim() === D.steps[D.i].value) {
          api.sound('rightH');
          D.i++;
          if (D.i >= D.steps.length) { st.chainValue = D.steps[D.steps.length - 1].value; api.solve(); return; }
          draw();
        } else { inp.value = ''; api.wrong('Мел скрипит по доске. Неверно.'); }
      }, { type: 'number' }),
    );
  };
  draw();
  root.append(h('p', { class: 'hz-text' }, 'Каждый ответ — начало следующего шага. Калькулятора нет.'), box);
}

// ---------------------------------------------------------------- 3. Электрические цепи
function circuitProblems(r, n, extra) {
  const gens = [
    () => { const R = pick(r, [2, 3, 4, 5, 6, 8]); const I = rint(r, 2, 9); return [`U = ${I * R} В, R = ${R} Ом. Найди I`, `${I} А`]; },
    () => { const R = pick(r, [3, 4, 5, 6, 12]); const I = rint(r, 2, 6); return [`I = ${I} А, R = ${R} Ом. Найди U`, `${I * R} В`]; },
    () => { const R = rint(r, 2, 15); const I = pick(r, [2, 3, 4]); return [`U = ${I * R} В, I = ${I} А. Найди R`, `${R} Ом`]; },
    () => { const U = pick(r, [6, 12, 24]); const I = rint(r, 2, 5); return [`U = ${U} В, I = ${I} А. Найди мощность P`, `${U * I} Вт`]; },
    () => { const a = rint(r, 2, 9), b = rint(r, 2, 9), c = rint(r, 1, 9); return [`Последовательно: ${a} Ом + ${b} Ом + ${c} Ом. Найди R общее`, `${a + b + c} Ом`]; },
    () => { const [a, b] = pick(r, [[6, 3], [12, 6], [4, 4], [20, 5], [10, 15], [12, 4], [30, 6], [6, 12], [8, 8], [9, 18]]); return [`Параллельно: ${a} Ом и ${b} Ом. Найди R общее`, `${(a * b) / (a + b)} Ом`]; },
    () => { const R = pick(r, [2, 3, 4, 5]); const I = rint(r, 2, 4); return [`I = ${I} А, R = ${R} Ом. Найди мощность P = I²R`, `${I * I * R} Вт`]; },
  ];
  const pool = extra >= 2 ? gens : gens.slice(0, 5).concat(gens[5]);
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 500) {
    const [q, a] = pick(r, pool)();
    if (used.has(a)) continue;
    used.add(a);
    out.push({ q, a });
  }
  return out;
}

function circuits(root, params, api) {
  const n = Math.min(14, params.n + Math.floor(api.extra / 2));
  const D = api.data('circ' + n, () => {
    const r = seeded(api.seed + 5);
    const probs = circuitProblems(r, n, api.extra);
    return { probs, right: shuf(r, probs.map((p, i) => i)), done: [] };
  });
  const L = 'ABCDEFGHIJKLMN';
  let sel = null;
  const links = new Map(); // left -> right index
  const wrap = h('div', { class: 'hz-circ' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('hz-wires');
  const left = h('div', { class: 'hz-col' });
  const right = h('div', { class: 'hz-col' });
  const lEls = D.probs.map((p, i) => h('button', { class: 'hz-term', onclick: () => { if (D.done.includes(i)) return; sel = i; lEls.forEach((e) => e.classList.remove('sel')); lEls[i].classList.add('sel'); } }, `${L[i]}. ${p.q}`));
  const rEls = D.right.map((pi, j) => h('button', { class: 'hz-term r', onclick: () => {
    if (sel === null) return;
    for (const [k, v] of links) if (v === j) links.delete(k);
    links.set(sel, j);
    lEls[sel].classList.remove('sel');
    sel = null;
    api.sound('switch');
    draw();
  } }, D.probs[pi].a));
  left.append(...lEls);
  right.append(...rEls);
  wrap.append(left, svg, right);
  const draw = () => {
    const box = wrap.getBoundingClientRect();
    svg.setAttribute('width', 60);
    svg.setAttribute('height', box.height);
    svg.innerHTML = '';
    const line = (i, j, color) => {
      const a = lEls[i].getBoundingClientRect(), b = rEls[j].getBoundingClientRect();
      const y1 = a.top + a.height / 2 - box.top, y2 = b.top + b.height / 2 - box.top;
      svg.insertAdjacentHTML('beforeend', `<path d="M0 ${y1} C30 ${y1} 30 ${y2} 60 ${y2}" stroke="${color}" stroke-width="3" fill="none"/>`);
    };
    D.done.forEach((i) => line(i, D.right.indexOf(i), '#3fbf6a'));
    for (const [i, j] of links) line(i, j, '#e0b04a');
    lEls.forEach((e, i) => e.classList.toggle('ok', D.done.includes(i)));
    rEls.forEach((e, j) => e.classList.toggle('ok', D.done.includes(D.right[j])));
    api.status(`Собрано цепей: ${D.done.length} из ${n}`);
  };
  root.append(
    h('p', { class: 'hz-text' }, 'Соедини каждую задачу (слева) с её ответом (справа): нажми слева, затем справа. Потом подай ток. Каждая неверная цепь — короткое замыкание.'),
    wrap,
    h('div', { class: 'hz-row' }, h('button', { class: 'btn red', onclick: () => {
      if (!links.size) return;
      let bad = 0;
      for (const [i, j] of links) {
        if (D.right[j] === i) D.done.push(i); else bad++;
      }
      links.clear();
      if (bad) api.wrong(`Замыкание! Неверных цепей: ${bad}`, bad);
      else api.sound('rightH');
      draw();
      if (D.done.length >= n) api.solve();
    } }, '⚡ Подать ток')),
  );
  requestAnimationFrame(draw);
}

// ---------------------------------------------------------------- 4. Шифры (английский)
const PHRASES = [
  'THE TEACHER IS BEHIND THE THIRD DOOR', 'DO NOT RUN IN THE HALLWAY', 'THE KEY IS UNDER THE BLACK DESK',
  'SHE CAN HEAR YOUR HEARTBEAT', 'NOBODY LEFT THE SCHOOL THAT NIGHT', 'THE BELL WILL RING AT MIDNIGHT',
  'HIDE WHEN THE LIGHTS GO OUT', 'COUNT THE STEPS BEFORE YOU TURN', 'THE HEADMASTER NEVER SLEEPS', 'YOUR NAME IS ON THE LIST',
];
const caesar = (t, k) => t.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k + 26) % 26) + 65));
const atbash = (t) => t.replace(/[A-Z]/g, (c) => String.fromCharCode(90 - (c.charCodeAt(0) - 65)));
const vigenere = (t, key) => { let j = 0; return t.replace(/[A-Z]/g, (c) => { const k = key.charCodeAt(j++ % key.length) - 65; return String.fromCharCode(((c.charCodeAt(0) - 65 + k) % 26) + 65); }); };

function cipher(root, params, api) {
  const mode = params.mode;
  const D = api.data('ci_' + mode, () => {
    const r = seeded(api.seed + mode.length * 13);
    const plain = pick(r, PHRASES);
    const shift = rint(r, 3, 23);
    return { plain, shift };
  });
  let enc, title, how;
  if (mode === 'caesar') {
    enc = caesar(D.plain, D.shift);
    title = 'Шифр Цезаря';
    how = api.hints >= 1 ? 'Каждая буква сдвинута по алфавиту на одно и то же число. Подсказка: самое частое короткое слово в английском — THE.' : 'Каждая буква сдвинута на одно и то же число.';
  } else if (mode === 'atbash') {
    enc = atbash(D.plain);
    title = 'Атбаш';
    how = api.hints >= 1 ? 'Алфавит перевёрнут: A↔Z, B↔Y, C↔X…' : 'Древний шифр «зеркального» алфавита.';
  } else {
    const key = api.mode.state.vkey;
    enc = vigenere(D.plain, key);
    title = 'Шифр Виженера';
    const found = api.mode.state.vkeyParts.map((p) => `буква №${p.i + 1}: ${p.c}`).join(', ');
    how = `Каждая буква сдвигается на номер соответствующей буквы ключа (A=0, B=1…), ключ повторяется. Найденные клочки ключа: ${found || 'нет'}.`;
  }
  const strip = h('div', { class: 'hz-strip' });
  if (mode === 'caesar' && api.hints >= 2) {
    let s = 0;
    const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const drawS = () => { strip.innerHTML = `<div>${AB}</div><div>${caesar(AB, s)}</div><small>сдвиг ${s}</small>`; };
    strip.onclick = () => { s = (s + 1) % 26; drawS(); };
    drawS();
  }
  root.append(
    h('div', { class: 'hz-note' }, title),
    h('p', { class: 'hz-text' }, how),
    h('div', { class: 'hz-cipher' }, enc),
    strip,
    h('p', { class: 'hz-text' }, 'Напиши расшифрованное сообщение по-английски:'),
    inputRow('Расшифровка', (v, inp) => {
      if (letters(v) === letters(D.plain)) api.solve();
      else api.wrong('Шёпот в голове: «не так…»');
    }),
  );
}

// ---------------------------------------------------------------- 5. Хронология
export const DOCS = [
  'Директор раздал всем новые ключи от кабинетов. Свой я потерял в тот же день.',
  'На следующий день после раздачи ключей кто-то запер архив изнутри.',
  'Через два дня после того, как заперли архив, в учительской в обед погас свет — и больше не включался.',
  'Вечером того дня, когда в учительской погас свет, Мария Петровна осталась проверять тетради.',
  'Утром Мария Петровна не пришла на первый урок. Звонок прозвенел сам — на десять минут раньше.',
  'На следующий день был выходной, но сторож слышал скрип мела на третьем этаже.',
  'Шесть дней прошло с тех пор, как нам раздали ключи. Сегодня ночью шаги остановились прямо за моей дверью.',
];

function order(root, params, api) {
  const D = api.data('order', () => ({ cur: shuffle(DOCS.map((_, i) => i)) }));
  const list = h('div', { class: 'hz-order' });
  const draw = () => {
    list.innerHTML = '';
    D.cur.forEach((di, pos) => {
      list.append(h('div', { class: 'hz-doc' },
        h('b', {}, pos + 1),
        h('span', {}, DOCS[di]),
        h('div', { class: 'hz-ud' },
          h('button', { onclick: () => { if (pos > 0) { [D.cur[pos - 1], D.cur[pos]] = [D.cur[pos], D.cur[pos - 1]]; api.sound('page'); draw(); } } }, '▲'),
          h('button', { onclick: () => { if (pos < D.cur.length - 1) { [D.cur[pos + 1], D.cur[pos]] = [D.cur[pos], D.cur[pos + 1]]; api.sound('page'); draw(); } } }, '▼'))));
    });
  };
  draw();
  root.append(
    h('p', { class: 'hz-text' }, 'Расположи страницы дневника в порядке событий. Дат почти нет — рассуждай по связям между записями.'),
    list,
    h('div', { class: 'hz-row' }, h('button', { class: 'btn red', onclick: () => {
      if (D.cur.every((v, i) => v === i)) api.solve();
      else api.wrong('Нет. Всё было не так.');
    } }, 'Проверить порядок')),
  );
}

// ---------------------------------------------------------------- 6. Кодовые замки с загадками
const FACTS = [
  ['количество простых чисел меньше 10', 4], ['число граней у куба', 6], ['квадратный корень из 81', 9], ['число ног у паука', 8],
  ['2 в кубе минус 1', 7], ['число букв в слове «ТЬМА»', 4], ['число рабочих дней в неделе', 5], ['последняя цифра числа 7²', 9],
  ['число сторон у треугольника', 3], ['наименьшее простое число', 2], ['сумма цифр числа 2024', 8], ['число месяцев в году минус 10', 2],
  ['число нулей в записи миллиона', 6], ['число планет Солнечной системы', 8], ['число гласных в слове «ШКОЛА»', 2], ['остаток от деления 13 на 5', 3],
  ['номер буквы «Е» в русском алфавите', 6], ['число вершин у пятиугольника', 5], ['1 + 2 + 3 + 4 − 9', 1], ['ноль в пятой степени', 0],
  ['число полных недель в 20 днях', 2], ['последняя цифра числа 3⁴', 1], ['число букв в слове «КРОВЬ»', 5], ['15 % от 60', 9],
  ['число углов у квадрата, умноженное на 2', 8], ['число двузначных чисел, делящихся на 33', 3], ['наибольшая цифра в записи числа 2+2·2', 6],
];

function combo(root, params, api) {
  const len = 3 + (api.extra >= 2 ? 1 : 0);
  const D = api.data('combo' + params.k, () => {
    const r = seeded(api.seed + params.k * 911);
    return { facts: shuf(r, FACTS).slice(0, len), fails: 0, lockUntil: 0 };
  });
  const answer = D.facts.map((f) => f[1]).join('');
  const dials = D.facts.map(() => 0);
  const dEls = [];
  const box = h('div', { class: 'hz-dials' }, ...D.facts.map((f, i) => {
    const v = h('div', { class: 'v' }, '0');
    dEls.push(v);
    return h('div', { class: 'hz-dial' },
      h('button', { onclick: () => { dials[i] = (dials[i] + 1) % 10; v.textContent = dials[i]; api.sound('tickH'); } }, '▲'), v,
      h('button', { onclick: () => { dials[i] = (dials[i] + 9) % 10; v.textContent = dials[i]; api.sound('tickH'); } }, '▼'));
  }));
  root.append(
    h('p', { class: 'hz-text' }, 'Рядом с замком нацарапано:'),
    h('ol', { class: 'hz-riddles' }, ...D.facts.map((f) => h('li', {}, f[0]))),
    box,
    h('div', { class: 'hz-row' }, h('button', { class: 'btn red', onclick: () => {
      if (Date.now() < D.lockUntil) { api.status(`Замок заблокирован ещё ${Math.ceil((D.lockUntil - Date.now()) / 1000)} сек`); return; }
      if (dials.join('') === answer) { api.solve(); return; }
      D.fails++;
      if (D.fails % 3 === 0) { D.lockUntil = Date.now() + 20000; api.wrong('Замок заблокирован на 20 секунд!'); }
      else api.wrong(`Неверно. Попыток до блокировки: ${3 - (D.fails % 3)}`);
    } }, 'Открыть')),
  );
}

// ---------------------------------------------------------------- 7. Логика
const LOGIC = [
  {
    q: 'Четверо: А, Б, В и Г. Ровно один из них — монстр, и он всегда лжёт. Остальные всегда говорят правду.',
    s: ['А: «Б — не монстр».', 'Б: «Монстр — В или Г».', 'В: «Б лжёт».', 'Г: «А — человек».'],
    ask: 'Кто монстр?', opts: ['А', 'Б', 'В', 'Г'], a: 2,
  },
  {
    q: 'Четверо. Ровно двое из них — лжецы (всегда лгут), двое всегда говорят правду.',
    s: ['А: «Б лжёт».', 'Б: «В и Г оба лгут».', 'В: «А говорит правду».', 'Г: «Б говорит правду».'],
    ask: 'Кто лжецы?', opts: ['А и Б', 'А и В', 'Б и Г', 'В и Г', 'Б и В', 'А и Г'], a: 2,
  },
  {
    q: 'Пять парт в ряд, слева направо — 1…5. За ними сидели Аня, Борис, Вика, Глеб и Дима.',
    s: ['Глеб сидел за крайней партой.', 'Вика сидела рядом с Глебом.', 'Аня не сидела рядом с Викой.', 'Борис сидел левее Димы.', 'Аня тоже сидела за крайней партой.', 'Борис сидел рядом с Аней.'],
    ask: 'Кто сидел за партой №3 — там, где нашли кровь?', opts: ['Аня', 'Борис', 'Вика', 'Глеб', 'Дима'], a: 4,
  },
  {
    q: 'Три шкафчика. Ключ лежит ровно в одном. Из трёх надписей правдива ровно одна.',
    s: ['Шкафчик 1: «Ключ здесь».', 'Шкафчик 2: «Ключа здесь нет».', 'Шкафчик 3: «Ключа нет в первом».'],
    ask: 'Где ключ?', opts: ['В шкафчике 1', 'В шкафчике 2', 'В шкафчике 3'], a: 1,
  },
  {
    q: 'Учитель появляется в коридоре каждые 7 минут, Тень — каждые 12. В полночь (00:00) они появились одновременно.',
    s: ['Тебе нужно пройти коридор, когда они появятся вместе впервые после 03:00.'],
    ask: 'Во сколько это будет?', opts: ['03:24', '04:12', '03:36', '04:00', '05:36'], a: 1,
  },
  {
    q: 'Трое — А, Б и В. Каждый либо всегда говорит правду, либо всегда лжёт.',
    s: ['А: «Мы все трое — лжецы».', 'Б: «Ровно один из нас говорит правду».', 'В молчит.'],
    ask: 'Кто говорит правду?', opts: ['Только А', 'Только Б', 'Только В', 'Б и В', 'Никто'], a: 1,
  },
  {
    q: 'Я задумал число от 1 до 30.',
    s: ['Оно делится на 3, но не делится на 9.', 'При делении на 5 даёт остаток 1.', 'Оно нечётное.'],
    ask: 'Какое это число?', opts: ['3', '6', '15', '21', '27'], a: 3,
  },
];

function logic(root, params, api) {
  const D = api.data('logic' + params.k, () => {
    const r = seeded(api.seed + 3);
    const order = shuf(r, LOGIC.map((_, i) => i));
    return { k: order[params.k % order.length] };
  });
  const P = LOGIC[D.k];
  const opts = h('div', { class: 'hz-opts' }, ...P.opts.map((o, i) => h('button', { class: 'hz-opt', onclick: () => {
    if (i === P.a) api.solve(); else api.wrong('Неверно. Где-то хлопнула дверь.');
  } }, o)));
  root.append(
    h('p', { class: 'hz-text' }, P.q),
    h('ul', { class: 'hz-riddles' }, ...P.s.map((s) => h('li', {}, s))),
    h('p', { class: 'hz-big' }, P.ask),
    opts,
  );
}

// ---------------------------------------------------------------- 8. Мелодия (Саймон)
function simon(root, params, api) {
  const len = 7 + Math.round(api.extra * 1.3);
  const speed = 520 - api.extra * 60;
  const D = api.data('simon', () => { const r = seeded(api.seed + 42); return { seq: Array.from({ length: len }, () => rint(r, 0, 5)) }; });
  const notes = [0, 3, 5, 7, 10, 12];
  const names = ['До', 'Ми♭', 'Фа', 'Соль', 'Си♭', 'До²'];
  let round = 1, input = [], playing = false;
  const pads = names.map((n, i) => h('button', { class: 'hz-pad', onclick: () => press(i) }, n));
  const info = h('p', { class: 'hz-big' }, '');
  const light = (i, ms) => { pads[i].classList.add('on'); api.note(notes[i]); setTimeout(() => pads[i].classList.remove('on'), ms * 0.8); };
  const play = () => {
    playing = true;
    input = [];
    info.textContent = `Слушай… (нот: ${round} из ${len})`;
    D.seq.slice(0, round).forEach((n, k) => setTimeout(() => light(n, speed), 500 + k * speed));
    setTimeout(() => { playing = false; info.textContent = `Повтори ${round} нот`; }, 500 + round * speed);
  };
  const press = (i) => {
    if (playing) return;
    light(i, 300);
    input.push(i);
    const k = input.length - 1;
    if (D.seq[k] !== i) {
      api.wrong('Фальшь! Звон разносится по школе.');
      if (api.extra >= 3) round = 1;
      setTimeout(play, 900);
      return;
    }
    if (input.length === round) {
      if (round >= len) { api.solve(); return; }
      round++;
      setTimeout(play, 700);
    }
  };
  root.append(h('p', { class: 'hz-text' }, `Повтори мелодию звонка. Каждый раз добавляется новая нота. Всего — ${len}.` + (api.extra >= 3 ? ' Ошибка — начинаешь с первой ноты.' : '')), info, h('div', { class: 'hz-pads' }, ...pads));
  setTimeout(play, 400);
}

// ---------------------------------------------------------------- 9. Lights Out (зеркальная панель)
function lights(root, params, api) {
  const N = 5;
  const D = api.data('lights' + params.k, () => {
    const r = seeded(api.seed + params.k * 31 + 9);
    const g = Array(N * N).fill(0);
    const presses = 7 + api.extra * 2;
    for (let i = 0; i < presses; i++) toggle(g, rint(r, 0, N * N - 1));
    if (g.every((v) => !v)) toggle(g, 12);
    return { g, moves: 0 };
  });
  function toggle(g, i) {
    const x = i % N, y = Math.floor(i / N);
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) g[ny * N + nx] ^= 1;
    });
  }
  const cells = D.g.map((_, i) => h('button', { class: 'hz-light', onclick: () => {
    toggle(D.g, i);
    D.moves++;
    api.sound('switch');
    if (D.moves % 25 === 0) api.mode.shadowStep();
    draw();
    if (D.g.every((v) => !v)) api.solve();
  } }));
  const draw = () => { cells.forEach((c, i) => c.classList.toggle('on', !!D.g[i])); api.status(`Нажатий: ${D.moves}`); };
  root.append(
    h('p', { class: 'hz-text' }, 'Нажатие на лампу переключает её и четыре соседние (сверху, снизу, слева, справа). Погаси все лампы.'),
    h('div', { class: 'hz-grid', style: { gridTemplateColumns: `repeat(${N}, 1fr)` } }, ...cells),
    h('div', { class: 'hz-row' }, h('button', { class: 'btn white small', onclick: () => { api.mode.addTime(-60); api.solve(); } }, 'Сдаться (−60 сек)')),
  );
  draw();
}

// ---------------------------------------------------------------- 10. 12 монет (три взвешивания)
function coins(root, params, api) {
  const D = api.data('coins' + params.k, () => ({ weighs: [], hyps: Array.from({ length: 24 }, (_, i) => ({ c: i >> 1, heavy: !(i & 1) })) }));
  const side = Array(12).fill(0); // 0 нет, 1 лево, 2 право
  const btns = side.map((_, i) => h('button', { class: 'hz-coin', onclick: () => { if (D.weighs.length >= 3) return; side[i] = (side[i] + 1) % 3; draw(); } }, String(i + 1)));
  const log = h('div', { class: 'hz-weighs' });
  const scale = h('div', { class: 'hz-scale' });
  const result = (hyp, L, R) => {
    const wl = L.includes(hyp.c) ? (hyp.heavy ? 1 : -1) : 0;
    const wr = R.includes(hyp.c) ? (hyp.heavy ? 1 : -1) : 0;
    return Math.sign(wl - wr); // 1 — левая тяжелее
  };
  const draw = () => {
    btns.forEach((b, i) => { b.className = 'hz-coin' + (side[i] === 1 ? ' l' : side[i] === 2 ? ' r' : ''); });
    log.innerHTML = D.weighs.map((w, k) => `<div>${k + 1}) [${w.L.map((x) => x + 1).join(', ')}] vs [${w.R.map((x) => x + 1).join(', ')}] → <b>${w.res === 0 ? 'равновесие' : w.res > 0 ? 'левая тяжелее' : 'правая тяжелее'}</b></div>`).join('');
    api.status(`Взвешиваний осталось: ${3 - D.weighs.length}`);
  };
  const weigh = () => {
    const L = [], R = [];
    side.forEach((s, i) => { if (s === 1) L.push(i); else if (s === 2) R.push(i); });
    if (!L.length || L.length !== R.length) { api.status('На чашах должно быть одинаковое число монет'); return; }
    if (D.weighs.length >= 3) return;
    // «злой» противник: выбирает исход, оставляющий больше всего вариантов — угадать невозможно, нужно решить
    const groups = { '-1': [], 0: [], 1: [] };
    D.hyps.forEach((hy) => groups[result(hy, L, R)].push(hy));
    const res = +Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length)[0];
    D.hyps = groups[res];
    D.weighs.push({ L, R, res });
    scale.style.transform = `rotate(${res * -12}deg)`;
    api.sound('thud');
    side.fill(0);
    draw();
  };
  let pickC = null, pickH = null;
  const ansC = h('select', { class: 'hz-input' }, h('option', { value: '' }, 'монета…'), ...Array.from({ length: 12 }, (_, i) => h('option', { value: i }, `№${i + 1}`)));
  const ansH = h('select', { class: 'hz-input' }, h('option', { value: '' }, 'она…'), h('option', { value: 'h' }, 'тяжелее'), h('option', { value: 'l' }, 'легче'));
  ansC.onchange = () => (pickC = ansC.value === '' ? null : +ansC.value);
  ansH.onchange = () => (pickH = ansH.value || null);
  root.append(
    h('p', { class: 'hz-text' }, 'Среди 12 монет одна фальшивая — она легче или тяжелее остальных. Найди её и узнай, легче она или тяжелее, за три взвешивания. Нажимай на монеты: 1 раз — левая чаша, 2 — правая, 3 — убрать.'),
    h('div', { class: 'hz-coins' }, ...btns),
    h('div', { class: 'hz-row' }, h('div', { class: 'hz-scalebox' }, scale), h('button', { class: 'btn white', onclick: weigh }, '⚖️ Взвесить')),
    log,
    h('div', { class: 'hz-row' }, ansC, ansH, h('button', { class: 'btn red', onclick: () => {
      if (pickC === null || !pickH) { api.status('Выбери монету и легче/тяжелее'); return; }
      const ok = D.hyps.length === 1 && D.hyps[0].c === pickC && D.hyps[0].heavy === (pickH === 'h');
      if (ok) { api.solve(); return; }
      api.wrong('Монеты со звоном рассыпались. Начни заново.');
      D.weighs = [];
      D.hyps = Array.from({ length: 24 }, (_, i) => ({ c: i >> 1, heavy: !(i & 1) }));
      scale.style.transform = '';
      draw();
    } }, 'Ответить')),
  );
  draw();
}

// ---------------------------------------------------------------- 11. Судоку 6×6
function sudoku(root, params, api) {
  const D = api.data('sudoku', () => {
    const r = seeded(api.seed + 66);
    const base = (row, col) => ((row % 2) * 3 + Math.floor(row / 2) + col) % 6;
    const digits = shuf(r, [1, 2, 3, 4, 5, 6]);
    const bands = shuf(r, [0, 1, 2]);
    const rows = []; bands.forEach((b) => shuf(r, [0, 1]).forEach((k) => rows.push(b * 2 + k)));
    const stacks = shuf(r, [0, 1]);
    const cols = []; stacks.forEach((s) => shuf(r, [0, 1, 2]).forEach((k) => cols.push(s * 3 + k)));
    const sol = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) sol.push(digits[base(rows[y], cols[x])]);
    const keep = Math.max(11, 17 - api.extra);
    const idx = shuf(r, sol.map((_, i) => i)).slice(0, keep);
    return { given: sol.map((v, i) => (idx.includes(i) ? v : 0)), cur: sol.map((v, i) => (idx.includes(i) ? v : 0)) };
  });
  const cells = D.cur.map((v, i) => {
    const giv = D.given[i] > 0;
    const inp = h('input', { class: 'hz-sd' + (giv ? ' g' : ''), maxlength: 1, value: v || '', disabled: giv ? true : null });
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    inp.addEventListener('input', () => { const n = +inp.value.replace(/[^1-6]/g, ''); inp.value = n || ''; D.cur[i] = n || 0; });
    const x = i % 6, y = Math.floor(i / 6);
    if (x === 2) inp.style.marginRight = '6px';
    if (y === 1 || y === 3) inp.style.marginBottom = '6px';
    return inp;
  });
  const valid = () => {
    const g = D.cur;
    if (g.some((v) => !v)) return false;
    const ok = (arr) => new Set(arr).size === 6;
    for (let y = 0; y < 6; y++) if (!ok(g.slice(y * 6, y * 6 + 6))) return false;
    for (let x = 0; x < 6; x++) if (!ok([0, 1, 2, 3, 4, 5].map((y) => g[y * 6 + x]))) return false;
    for (let by = 0; by < 3; by++) for (let bx = 0; bx < 2; bx++) {
      const a = [];
      for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) a.push(g[(by * 2 + y) * 6 + bx * 3 + x]);
      if (!ok(a)) return false;
    }
    return true;
  };
  root.append(
    h('p', { class: 'hz-text' }, 'Заполни поле цифрами 1–6: в каждой строке, столбце и прямоугольнике 2×3 — все цифры разные.'),
    h('div', { class: 'hz-sudoku' }, ...cells),
    h('div', { class: 'hz-row' }, h('button', { class: 'btn red', onclick: () => (valid() ? api.solve() : api.wrong('Замок не поддался.')) }, 'Повернуть замок')),
  );
}

// ---------------------------------------------------------------- 12. Химия: уравнять реакции
const REACTIONS = [
  { l: ['H₂', 'O₂'], r: ['H₂O'], c: [2, 1, 2] },
  { l: ['N₂', 'H₂'], r: ['NH₃'], c: [1, 3, 2] },
  { l: ['CH₄', 'O₂'], r: ['CO₂', 'H₂O'], c: [1, 2, 1, 2] },
  { l: ['Na', 'H₂O'], r: ['NaOH', 'H₂'], c: [2, 2, 2, 1] },
  { l: ['Fe', 'Cl₂'], r: ['FeCl₃'], c: [2, 3, 2] },
  { l: ['Al', 'O₂'], r: ['Al₂O₃'], c: [4, 3, 2] },
  { l: ['KClO₃'], r: ['KCl', 'O₂'], c: [2, 2, 3] },
  { l: ['P', 'O₂'], r: ['P₂O₅'], c: [4, 5, 2] },
  { l: ['C₃H₈', 'O₂'], r: ['CO₂', 'H₂O'], c: [1, 5, 3, 4] },
  { l: ['Al', 'HCl'], r: ['AlCl₃', 'H₂'], c: [2, 6, 2, 3] },
  { l: ['C₂H₆', 'O₂'], r: ['CO₂', 'H₂O'], c: [2, 7, 4, 6] },
  { l: ['Fe₂O₃', 'CO'], r: ['Fe', 'CO₂'], c: [1, 3, 2, 3] },
];

function chem(root, params, api) {
  const n = 3 + Math.floor(api.extra / 1.5);
  const D = api.data('chem', () => {
    const r = seeded(api.seed + 17);
    const easy = shuf(r, REACTIONS.slice(0, 6)).slice(0, Math.max(1, n - 2 - Math.floor(api.extra / 2)));
    const hard = shuf(r, REACTIONS.slice(6)).slice(0, n - easy.length);
    return { list: easy.concat(hard), i: 0 };
  });
  const box = h('div');
  const draw = () => {
    box.innerHTML = '';
    const R = D.list[D.i];
    const ins = R.c.map(() => {
      const i = h('input', { class: 'hz-coef', type: 'number', min: 1, max: 20, value: '' });
      i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') check(); });
      return i;
    });
    const parts = [];
    R.l.forEach((f, k) => { if (k) parts.push(' + '); parts.push(ins[k], h('b', {}, f)); });
    parts.push(' → ');
    R.r.forEach((f, k) => { if (k) parts.push(' + '); parts.push(ins[R.l.length + k], h('b', {}, f)); });
    const check = () => {
      const v = ins.map((i) => +i.value || 0);
      if (v.every((x, k) => x === R.c[k])) {
        api.sound('rightH');
        D.i++;
        if (D.i >= D.list.length) api.solve(); else draw();
      } else api.wrong('Колба лопнула! Коэффициенты неверны (нужны наименьшие целые).');
    };
    box.append(
      h('div', { class: 'hz-note' }, `Реакция ${D.i + 1} из ${D.list.length}`),
      h('div', { class: 'hz-eq' }, ...parts),
      h('div', { class: 'hz-row' }, h('button', { class: 'btn red', onclick: check }, 'Смешать')),
    );
    setTimeout(() => ins[0].focus(), 30);
  };
  root.append(h('p', { class: 'hz-text' }, 'Расставь наименьшие целые коэффициенты, чтобы атомов каждого элемента слева и справа было поровну (коэффициент 1 тоже пиши).'), box);
  draw();
}

// ---------------------------------------------------------------- 13. Анаграммы (английский)
const WORDS = [
  ['TEACHER', 'учитель'], ['LIBRARY', 'библиотека'], ['CORRIDOR', 'коридор'], ['DETENTION', 'оставление после уроков'],
  ['BLACKBOARD', 'классная доска'], ['CLASSROOM', 'класс'], ['HOMEWORK', 'домашнее задание'], ['PRINCIPAL', 'директор'],
  ['SILENCE', 'тишина'], ['SHADOW', 'тень'], ['SCREAM', 'крик'], ['LOCKER', 'шкафчик'], ['CHEMISTRY', 'химия'],
  ['MIDNIGHT', 'полночь'], ['BASEMENT', 'подвал'], ['NIGHTMARE', 'кошмар'], ['STAIRCASE', 'лестница'], ['FLASHLIGHT', 'фонарик'],
  ['WHISPER', 'шёпот'], ['EXAMINATION', 'экзамен'],
];

function anagram(root, params, api) {
  const n = 3 + Math.ceil(api.extra / 2);
  const D = api.data('ana' + params.k, () => {
    const r = seeded(api.seed + params.k * 57 + 1);
    const words = shuf(r, WORDS).slice(0, n).map(([w, ru]) => {
      let s = w;
      for (let t = 0; t < 10 && s === w; t++) s = shuf(r, w.split('')).join('');
      return { w, ru, s };
    });
    return { words, i: 0 };
  });
  const box = h('div');
  const draw = () => {
    box.innerHTML = '';
    const W = D.words[D.i];
    box.append(
      h('div', { class: 'hz-note' }, `Слово ${D.i + 1} из ${D.words.length}`),
      h('div', { class: 'hz-cipher' }, W.s.split('').join(' ')),
      api.hints >= 1 ? h('p', { class: 'hz-text' }, `Перевод: «${W.ru}»` + (api.hints >= 2 ? `, начинается на ${W.w[0]}` : '')) : null,
      inputRow('Слово по-английски', (v, inp) => {
        if (letters(v) === W.w) { api.sound('rightH'); D.i++; if (D.i >= D.words.length) api.solve(); else draw(); }
        else { inp.value = ''; api.wrong('Свет гаснет…'); }
      }),
    );
  };
  root.append(h('p', { class: 'hz-text' }, 'Буквы английских слов перемешаны. Составь слово.'), box);
  draw();
}

// ---------------------------------------------------------------- 14. Расписание с условиями
const SUBJ = ['Математика', 'Физика', 'Химия', 'История', 'Литература', 'Биология'];
function genSchedule(r, extra) {
  const sol = shuf(r, [0, 1, 2, 3, 4, 5]); // sol[slot] = subject
  const pos = []; sol.forEach((s, i) => (pos[s] = i));
  const cands = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
    if (a === b) continue;
    if (pos[a] + 1 === pos[b]) cands.push({ t: `${SUBJ[b]} — сразу после урока «${SUBJ[a]}».`, f: (p) => p[a] + 1 === p[b] });
    if (pos[a] < pos[b]) cands.push({ t: `${SUBJ[a]} — раньше, чем ${SUBJ[b]}.`, f: (p) => p[a] < p[b] });
    if (Math.abs(pos[a] - pos[b]) === 2 && a < b) cands.push({ t: `Между уроками «${SUBJ[a]}» и «${SUBJ[b]}» ровно один урок.`, f: (p) => Math.abs(p[a] - p[b]) === 2 });
  }
  for (let a = 0; a < 6; a++) {
    for (let k = 0; k < 6; k++) if (pos[a] !== k) cands.push({ t: `${SUBJ[a]} — не ${k + 1}-м уроком.`, f: (p) => p[a] !== k });
    cands.push({ t: `${SUBJ[a]} — ${pos[a] % 2 ? 'чётным' : 'нечётным'} по счёту уроком.`, f: (p) => p[a] % 2 === pos[a] % 2 });
    if (pos[a] === 0 || pos[a] === 5) cands.push({ t: `${SUBJ[a]} — ${pos[a] === 0 ? 'первым' : 'последним'} уроком.`, f: (p) => p[a] === pos[a] });
  }
  const perms = [];
  const rec = (arr, rest) => { if (!rest.length) { perms.push(arr); return; } rest.forEach((x, i) => rec(arr.concat(x), rest.filter((_, j) => j !== i))); };
  rec([], [0, 1, 2, 3, 4, 5]);
  const toPos = (slotArr) => { const p = []; slotArr.forEach((s, i) => (p[s] = i)); return p; };
  const all = perms.map(toPos);
  const chosen = [];
  let alive = all;
  // сначала добавляем «слабые» условия, чтобы задача была длинной и требовала рассуждений
  const pool = shuf(r, cands).sort((x, y) => (x.t.includes('первым') || x.t.includes('последним') ? 1 : 0) - (y.t.includes('первым') || y.t.includes('последним') ? 1 : 0));
  for (const c of pool) {
    const next = alive.filter(c.f);
    if (next.length < alive.length) { chosen.push(c); alive = next; }
    if (alive.length === 1) break;
  }
  return { sol, cons: shuf(r, chosen) };
}

function schedule(root, params, api) {
  const D = api.data('sched', () => {
    const r = seeded(api.seed + 404);
    const g = genSchedule(r, api.extra);
    return { cons: g.cons.map((c) => c.t), cur: Array(6).fill(-1), sol: g.sol };
  });
  // восстановление функций проверки по тексту не нужно: проверяем через решение-ответ на единственность
  const sels = D.cur.map((v, i) => {
    const s = h('select', { class: 'hz-input' }, h('option', { value: -1 }, '—'), ...SUBJ.map((n, k) => h('option', { value: k }, n)));
    s.value = v;
    s.onchange = () => (D.cur[i] = +s.value);
    return h('div', { class: 'hz-slot' }, h('b', {}, `${i + 1} урок`), s);
  });
  root.append(
    h('p', { class: 'hz-text' }, 'Найденные страницы с условиями. Составь расписание из 6 уроков так, чтобы выполнялись ВСЕ условия (решение единственное).'),
    h('ol', { class: 'hz-riddles small' }, ...D.cons.map((c) => h('li', {}, c))),
    h('div', { class: 'hz-slots' }, ...sels),
    h('div', { class: 'hz-row' }, h('button', { class: 'btn red', onclick: () => {
      if (D.cur.every((v, i) => v === D.sol[i])) api.solve(); else api.wrong('Расписание не сходится.');
    } }, 'Повесить расписание')),
  );
}

// ---------------------------------------------------------------- 15. Финальный экзамен Директора
function examQuestion(r, extra) {
  const t = rint(r, 0, 3);
  if (t === 0) {
    const a = rint(r, 2, 9), b = rint(r, 2, 9), c = rint(r, 2, 9), d = rint(r, 1, 9);
    return { q: `${a} + ${b} × ${c} − ${d}² ÷ ${d} = ?`, a: String(a + b * c - d) };
  }
  if (t === 1) {
    const kind = rint(r, 0, 3);
    if (kind === 0) { const s = rint(r, 2, 9), k = rint(r, 3, 7); const arr = [0, 1, 2, 3, 4].map((i) => s + k * i); return { q: `Продолжи: ${arr.join(', ')}, ?`, a: String(s + k * 5) }; }
    if (kind === 1) { const s = rint(r, 1, 3), k = rint(r, 2, 3); const arr = [0, 1, 2, 3].map((i) => s * k ** i); return { q: `Продолжи: ${arr.join(', ')}, ?`, a: String(s * k ** 4) }; }
    if (kind === 2) { const a = rint(r, 1, 4), b = rint(r, 2, 5); const arr = [a, b]; while (arr.length < 6) arr.push(arr[arr.length - 1] + arr[arr.length - 2]); return { q: `Продолжи: ${arr.join(', ')}, ?`, a: String(arr[4] + arr[5]) }; }
    const k = rint(r, 1, 3); const arr = [1, 2, 3, 4, 5].map((i) => i * i + k); return { q: `Продолжи: ${arr.join(', ')}, ?`, a: String(36 + k) };
  }
  if (t === 2) {
    const [w, ru] = pick(r, WORDS);
    return { q: `Переведи на английский: «${ru}»`, a: w };
  }
  const P = pick(r, LOGIC.filter((l) => l.opts.length <= 5));
  return { q: `${P.q} ${P.s.join(' ')} ${P.ask} Варианты: ${P.opts.join(' / ')}`, a: P.opts[P.a] };
}

function exam(root, params, api) {
  const n = 5 + api.extra;
  const D = api.data('exam', () => { const r = seeded(api.seed + 999); return { qs: Array.from({ length: n }, () => examQuestion(r, api.extra)), i: 0 }; });
  const box = h('div');
  const draw = () => {
    box.innerHTML = '';
    const Q = D.qs[D.i];
    box.append(
      h('div', { class: 'hz-note' }, `Вопрос ${D.i + 1} из ${D.qs.length}`),
      h('p', { class: 'hz-big' }, Q.q),
      inputRow('Ответ', (v, inp) => {
        const ok = /^[A-Z]+$/.test(Q.a) ? letters(v) === Q.a : normRu(v) === normRu(Q.a);
        if (ok) { api.sound('rightH'); D.i++; if (D.i >= D.qs.length) api.solve(); else draw(); }
        else { inp.value = ''; api.wrong('«НЕВЕРНО», — шепчет Директор прямо у тебя за спиной.'); }
      }),
    );
  };
  root.append(h('p', { class: 'hz-text' }, 'Последний экзамен. Директор не прощает ошибок.'), box);
  draw();
}

export const PUZZLES = { code, chain, circuits, cipher, order, combo, logic, simon, lights, coins, sudoku, chem, anagram, schedule, exam };
export const PUZZLE_TITLES = {
  code: 'Сейф', chain: 'Доска: цепочка вычислений', circuits: 'Электрощит: 12 цепей', cipher: 'Зашифрованная записка', order: 'Хронология событий',
  combo: 'Кодовый замок', logic: 'Логическая задача', simon: 'Мелодия звонка', lights: 'Зеркальная панель', coins: '12 монет',
  sudoku: 'Замок-судоку', chem: 'Уравнения реакций', anagram: 'Анаграммы', schedule: 'Расписание', exam: 'Экзамен Директора',
};
