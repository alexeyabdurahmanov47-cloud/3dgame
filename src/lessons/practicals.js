import { h, shuffle } from '../ui/dom.js';

// Практические работы. Подключаются в TASK_TYPES (tasks.js) и помечаются practical: true.
// Каждая проверяется сама и вызывает ctx.done({ frac, answer }).

function q(el, task, sub) {
  el.append(h('div', { class: 'q' }, task.q || '', sub ? h('small', {}, sub) : null));
  if (task.goal) el.append(h('div', { class: 'tipbox', style: { marginTop: 0, marginBottom: '14px' } }, `🎯 Цель: ${task.goal}`));
}
const msg = (text, ok) => h('div', { class: `lab-msg ${ok === true ? 'ok' : ok === false ? 'bad' : ''}` }, text);

// ---------- ⚗️ Химическая лаборатория ----------
function mixColors(cols) {
  if (!cols.length) return 'transparent';
  let r = 0, g = 0, b = 0;
  cols.forEach((c) => { const n = parseInt(c.slice(1), 16); r += n >> 16; g += (n >> 8) & 255; b += n & 255; });
  const k = cols.length;
  return `rgb(${Math.round(r / k)},${Math.round(g / k)},${Math.round(b / k)})`;
}
const chem = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, 'Нажимай на колбы, чтобы налить реактив в стакан, затем — «Смешать»');
    const max = task.max || 2;
    let added = [];
    let tries = 0;
    const liquid = h('div', { class: 'liquid' });
    const bubbles = h('div', { class: 'bubbles' });
    const precip = h('div', { class: 'precip' });
    const beaker = h('div', { class: 'beaker' }, liquid, precip, bubbles);
    const contents = h('div', { class: 'lab-contents' });
    const out = h('div');
    const draw = (color) => {
      liquid.style.height = `${Math.min(85, added.length * 35)}%`;
      liquid.style.background = color || mixColors(added.map((a) => a.color));
      contents.textContent = added.length ? `В стакане: ${added.map((a) => a.name).join(' + ')}` : 'Стакан пуст';
    };
    const flasks = h('div', { class: 'flasks' }, task.reagents.map((r) => h('button', { class: 'flask', onclick: () => {
      if (added.length >= max || added.includes(r)) return;
      added.push(r);
      ctx.sound('water');
      bubbles.classList.remove('on');
      precip.style.height = '0';
      draw();
    } }, h('div', { class: 'flask-body', style: { background: r.color } }), h('span', {}, r.name))));
    const mixBtn = h('button', { class: 'btn small green', onclick: () => {
      if (added.length < 2) { out.replaceChildren(msg('Налей хотя бы два реактива!')); return; }
      const ids = added.map((a) => a.id).sort().join('+');
      const re = task.reactions.find((x) => [...x.mix].sort().join('+') === ids);
      tries++;
      if (re) {
        draw(re.color || mixColors(added.map((a) => a.color)));
        if (re.gas) bubbles.classList.add('on');
        if (re.precipitate) { precip.style.background = re.precipitate; precip.style.height = '22%'; }
        ctx.sound(re.ok ? 'star' : 'pop');
      } else ctx.sound('click');
      const text = re ? re.text : 'Видимых изменений нет 🤔';
      if (re && re.ok) {
        out.replaceChildren(msg(`✅ ${text}`, true));
        lock();
        ctx.done({ frac: tries === 1 ? 1 : 0.7, answer: text });
      } else if (tries >= 3) {
        out.replaceChildren(msg(`❌ ${text}`, false));
        lock();
        const right = task.reactions.find((x) => x.ok);
        ctx.done({ frac: 0, answer: right ? right.mix.map((id) => task.reagents.find((r) => r.id === id).name).join(' + ') : '' });
      } else out.replaceChildren(msg(`${text} Попробуй другой опыт (попыток: ${3 - tries}).`));
    } }, '🔥 Смешать');
    const clearBtn = h('button', { class: 'btn small white', onclick: () => { added = []; bubbles.classList.remove('on'); precip.style.height = '0'; draw(); } }, '♻ Вылить');
    const lock = () => { mixBtn.disabled = clearBtn.disabled = true; flasks.querySelectorAll('button').forEach((b) => (b.disabled = true)); };
    draw();
    el.append(h('div', { class: 'lab' }, flasks, h('div', { class: 'lab-bench' }, beaker, contents, h('div', { class: 'lab-btns' }, mixBtn, clearBtn))), out);
    return { auto: true };
  },
};

// ---------- 🔬 Микроскоп ----------
const SPECIMENS = {
  plant: {
    title: 'Клетка кожицы лука (растительная)',
    parts: [
      { name: 'клеточная стенка', shape: 'rect', x: 150, y: 150, w: 230, h: 170, color: '#7bd36b', line: 10, hit: 'edge' },
      { name: 'вакуоль', shape: 'ellipse', x: 175, y: 160, rx: 60, ry: 45, color: '#bfe9ff' },
      { name: 'ядро', shape: 'circle', x: 95, y: 120, r: 20, color: '#8e44ad' },
      { name: 'хлоропласт', shape: 'dots', pts: [[85, 195], [235, 100], [230, 205], [110, 90]], r: 9, color: '#27ae60' },
      { name: 'цитоплазма', shape: 'bg', color: '#fff3c4' },
    ],
  },
  animal: {
    title: 'Клетка животного',
    parts: [
      { name: 'мембрана', shape: 'circle', x: 150, y: 150, r: 110, color: '#ffc0cb', line: 8, hit: 'edge' },
      { name: 'ядро', shape: 'circle', x: 150, y: 140, r: 28, color: '#8e44ad' },
      { name: 'митохондрия', shape: 'dots', pts: [[95, 200], [205, 95], [210, 195]], r: 12, color: '#e67e22', ellipse: true },
      { name: 'цитоплазма', shape: 'bg', color: '#ffe9ec' },
    ],
  },
  bacteria: {
    title: 'Бактерии (палочки)',
    parts: [
      { name: 'бактерия', shape: 'dots', pts: [[90, 100], [200, 120], [140, 200], [220, 210]], r: 14, color: '#16a085', ellipse: true },
      { name: 'жгутик', shape: 'line', x1: 228, y1: 120, x2: 270, y2: 100, color: '#0e6655' },
    ],
  },
  blood: {
    title: 'Кровь человека',
    parts: [
      { name: 'эритроцит', shape: 'dots', pts: [[80, 90], [130, 70], [200, 90], [240, 150], [90, 200], [160, 230], [220, 210], [70, 150]], r: 16, color: '#e74c3c' },
      { name: 'лейкоцит', shape: 'circle', x: 150, y: 150, r: 26, color: '#a29bfe' },
      { name: 'плазма', shape: 'bg', color: '#fff2cc' },
    ],
  },
};
function drawSpecimen(ctx2, spec) {
  ctx2.fillStyle = (spec.parts.find((p) => p.shape === 'bg') || { color: '#fffde8' }).color;
  ctx2.fillRect(0, 0, 300, 300);
  for (const p of spec.parts) {
    ctx2.fillStyle = p.color;
    ctx2.strokeStyle = p.color;
    if (p.shape === 'rect') { ctx2.lineWidth = p.line; ctx2.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); }
    if (p.shape === 'circle') {
      ctx2.beginPath(); ctx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.line) { ctx2.lineWidth = p.line; ctx2.stroke(); } else ctx2.fill();
    }
    if (p.shape === 'ellipse') { ctx2.beginPath(); ctx2.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2); ctx2.fill(); }
    if (p.shape === 'dots') p.pts.forEach(([x, y]) => { ctx2.beginPath(); if (p.ellipse) ctx2.ellipse(x, y, p.r * 1.8, p.r, 0.5, 0, Math.PI * 2); else ctx2.arc(x, y, p.r, 0, Math.PI * 2); ctx2.fill(); });
    if (p.shape === 'line') { ctx2.lineWidth = 3; ctx2.beginPath(); ctx2.moveTo(p.x1, p.y1); ctx2.quadraticCurveTo((p.x1 + p.x2) / 2, p.y1 + 25, p.x2, p.y2); ctx2.stroke(); }
  }
}
function hitPart(spec, x, y) {
  const d = (ax, ay) => Math.hypot(x - ax, y - ay);
  for (const p of spec.parts) {
    if (p.shape === 'dots' && p.pts.some(([px, py]) => d(px, py) < p.r * 2)) return p.name;
    if (p.shape === 'circle' && p.hit === 'edge' && Math.abs(d(p.x, p.y) - p.r) < 14) return p.name;
    if (p.shape === 'circle' && !p.hit && d(p.x, p.y) < p.r + 4) return p.name;
    if (p.shape === 'ellipse' && ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1) return p.name;
    if (p.shape === 'line' && d((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2 + 10) < 25) return p.name;
    if (p.shape === 'rect') {
      const ex = Math.abs(Math.abs(x - p.x) - p.w / 2) < 14 && Math.abs(y - p.y) < p.h / 2 + 10;
      const ey = Math.abs(Math.abs(y - p.y) - p.h / 2) < 14 && Math.abs(x - p.x) < p.w / 2 + 10;
      if (ex || ey) return p.name;
    }
  }
  const bg = spec.parts.find((p) => p.shape === 'bg');
  return bg ? bg.name : null;
}
const microscope = {
  practical: true,
  render(el, task, ctx) {
    const spec = SPECIMENS[task.specimen] || SPECIMENS.plant;
    q(el, task, `Препарат: ${spec.title}. Сначала наведи резкость, потом найди части клетки`);
    const cv = h('canvas', { width: 300, height: 300, class: 'scope-view' });
    const c2 = cv.getContext('2d');
    drawSpecimen(c2, spec);
    let focus = 0;
    const target = 60 + Math.floor(Math.random() * 30);
    const ask = h('div', { class: 'scope-ask' }, 'Покрути винт фокусировки 🔧');
    const slider = h('input', { type: 'range', min: 0, max: 100, value: 0, class: 'scope-focus' });
    const apply = () => { const blur = Math.abs(focus - target) / 6; cv.style.filter = `blur(${blur.toFixed(1)}px)`; };
    apply();
    let step = 0, good = 0, ready = false;
    const find = task.find || spec.parts.filter((p) => p.shape !== 'bg').map((p) => p.name);
    const marks = h('div', { class: 'scope-marks' });
    slider.addEventListener('input', () => {
      if (ready) return;
      focus = +slider.value;
      apply();
      if (!ready && Math.abs(focus - target) < 6) {
        ready = true;
        cv.style.filter = 'none';
        slider.disabled = true;
        ctx.sound('pop');
        ask.innerHTML = `Резкость наведена ✅ Найди и нажми: <b>${find[0]}</b>`;
      }
    });
    cv.addEventListener('click', (e) => {
      if (!ready || step >= find.length) return;
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 300, y = ((e.clientY - r.top) / r.height) * 300;
      const name = hitPart(spec, x, y);
      const ok = name === find[step];
      if (ok) good++;
      ctx.sound(ok ? 'correct' : 'wrong');
      c2.fillStyle = ok ? '#2ed573' : '#ff4757';
      c2.font = 'bold 26px sans-serif';
      c2.fillText(ok ? '✓' : '✗', x - 8, y + 9);
      marks.append(h('span', { class: `chip ${ok ? 'okc' : 'badc'}` }, `${ok ? '✅' : '❌'} ${find[step]}${ok ? '' : ` (это: ${name || 'пусто'})`}`));
      step++;
      if (step < find.length) ask.innerHTML = `Теперь найди: <b>${find[step]}</b>`;
      else { ask.textContent = 'Наблюдение завершено! 🔬'; ctx.done({ frac: good / find.length, answer: find.join(', ') }); }
    });
    el.append(h('div', { class: 'scope' }, h('div', { class: 'scope-tube' }, cv), h('div', { class: 'scope-side' }, ask, h('label', { class: 'scope-label' }, '🔧 Фокус', slider), marks)));
    return { auto: true };
  },
};

// ---------- ⚡ Электрическая цепь ----------
const ELEMENTS = {
  wire: { icon: '➖', name: 'провод' },
  gap: { icon: '✂️', name: 'разрыв' },
  battery: { icon: '🔋', name: 'батарейка' },
  lamp: { icon: '💡', name: 'лампа' },
  switch: { icon: '🔘', name: 'ключ' },
  ammeter: { icon: 'Ⓐ', name: 'амперметр' },
  resistor: { icon: '▭', name: 'резистор' },
};
const circuit = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, 'Нажимай на ячейки цепи, чтобы поставить нужный элемент. Потом замкни ключ и проверь');
    const opts = task.options || ['gap', 'wire', 'battery', 'lamp', 'switch'];
    const need = task.need || ['battery', 'lamp', 'switch'];
    const n = task.slots || 6;
    const slots = Array.from({ length: n }, () => 'gap');
    let closed = false, tries = 0;
    const cells = slots.map((_, i) => {
      const b = h('button', { class: 'cell', onclick: () => { slots[i] = opts[(opts.indexOf(slots[i]) + 1) % opts.length]; render(); ctx.sound('click'); } });
      return b;
    });
    const bulb = h('div', { class: 'bulb' }, '💡');
    const sw = h('button', { class: 'btn small white', onclick: () => { closed = !closed; render(); ctx.sound('click'); } });
    const out = h('div');
    const render = () => {
      cells.forEach((c, i) => { c.innerHTML = `<b>${ELEMENTS[slots[i]].icon}</b><small>${ELEMENTS[slots[i]].name}</small>`; c.classList.toggle('gapc', slots[i] === 'gap'); });
      sw.textContent = closed ? '🔘 Ключ замкнут' : '⭕ Ключ разомкнут';
    };
    render();
    const loop = h('div', { class: 'circuit' }, h('div', { class: 'loop' }, cells), bulb);
    const check = h('button', { class: 'btn small green', onclick: () => {
      tries++;
      const has = (k) => slots.includes(k);
      const works = !has('gap') && need.every(has) && (!has('switch') || closed);
      bulb.classList.toggle('on', works);
      if (works) {
        ctx.sound('star');
        out.replaceChildren(msg(`✅ ${task.success || 'Лампа горит! Цепь замкнута, ток идёт.'}`, true));
        check.disabled = true; cells.forEach((c) => (c.disabled = true));
        ctx.done({ frac: tries === 1 ? 1 : 0.7, answer: need.map((k) => ELEMENTS[k].name).join(', ') });
      } else {
        ctx.sound('wrong');
        const why = has('gap') ? 'В цепи есть разрыв ✂️.' : !need.every(has) ? `Не хватает: ${need.filter((k) => !has(k)).map((k) => ELEMENTS[k].name).join(', ')}.` : 'Ключ разомкнут — замкни его.';
        if (tries >= 3) { out.replaceChildren(msg(`❌ ${why}`, false)); check.disabled = true; ctx.done({ frac: 0, answer: `нужны: ${need.map((k) => ELEMENTS[k].name).join(', ')}, без разрывов, ключ замкнут` }); }
        else out.replaceChildren(msg(`Лампа не горит. ${why} (попыток: ${3 - tries})`));
      }
    } }, '⚡ Проверить цепь');
    el.append(loop, h('div', { class: 'lab-btns' }, sw, check), out);
    return { auto: true };
  },
};

// ---------- 🤖 Робот / эвакуация ----------
const THEMES = {
  robot: { me: '🤖', goal: '🔋', wall: '🧱' },
  turtle: { me: '🐢', goal: '🥬', wall: '🪨' },
  evac: { me: '🧑', goal: '🚪', wall: '🔥' },
};
const DIRS = { up: [0, -1, '⬆'], down: [0, 1, '⬇'], left: [-1, 0, '⬅'], right: [1, 0, '➡'] };
const robot = {
  practical: true,
  render(el, task, ctx) {
    const T = THEMES[task.theme] || THEMES.robot;
    q(el, task, task.loops ? 'Составь программу. Нажми на команду ещё раз — она повторится больше раз (цикл)' : 'Составь программу из команд и нажми «Запуск»');
    const N = task.size || 5;
    const walls = new Set((task.walls || []).map(([x, y]) => `${x},${y}`));
    const grid = h('div', { class: 'rgrid', style: { gridTemplateColumns: `repeat(${N}, 1fr)` } });
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = h('div', { class: 'rcell' });
      cells.push(c);
      grid.append(c);
    }
    let pos = [...task.start];
    const prog = [];
    let tries = 0, running = false;
    const draw = () => {
      cells.forEach((c, i) => {
        const x = i % N, y = Math.floor(i / N);
        c.textContent = x === pos[0] && y === pos[1] ? T.me : x === task.goal[0] && y === task.goal[1] ? T.goal : walls.has(`${x},${y}`) ? T.wall : '';
      });
    };
    draw();
    const list = h('div', { class: 'rprog' });
    const showProg = () => {
      list.innerHTML = '';
      if (!prog.length) list.append(h('span', { style: { color: '#b0a8d9', fontWeight: 800 } }, 'Программа пуста'));
      prog.forEach((p, i) => list.append(h('button', { class: 'chipbtn sel', onclick: () => { if (running) return; prog.splice(i, 1); showProg(); } }, `${DIRS[p.d][2]}${p.n > 1 ? ' ×' + p.n : ''}`)));
    };
    showProg();
    const cmd = (d) => h('button', { class: 'btn small blue', onclick: () => {
      if (running) return;
      const last = prog[prog.length - 1];
      if (task.loops && last && last.d === d) last.n++;
      else if (prog.length < (task.max || 14)) prog.push({ d, n: 1 });
      showProg();
    } }, DIRS[d][2]);
    const out = h('div');
    const run = h('button', { class: 'btn small green', onclick: async () => {
      if (running || !prog.length) return;
      running = true;
      tries++;
      pos = [...task.start];
      draw();
      let fail = null;
      const steps = [];
      prog.forEach((p) => { for (let k = 0; k < p.n; k++) steps.push(p.d); });
      for (const d of steps) {
        await new Promise((r) => setTimeout(r, 280));
        const nx = pos[0] + DIRS[d][0], ny = pos[1] + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) { fail = 'Ой! Вышли за край поля.'; break; }
        if (walls.has(`${nx},${ny}`)) { fail = `Ой! Впереди препятствие ${T.wall}`; break; }
        pos = [nx, ny];
        draw();
        ctx.sound('tick');
      }
      running = false;
      const ok = !fail && pos[0] === task.goal[0] && pos[1] === task.goal[1];
      const short = !task.loops || prog.length <= (task.maxCmds || 99);
      if (ok && short) {
        ctx.sound('star');
        out.replaceChildren(msg(`✅ ${task.success || 'Цель достигнута! Программа работает.'}`, true));
        run.disabled = true;
        ctx.done({ frac: tries === 1 ? 1 : 0.7, answer: 'программа выполнена' });
      } else {
        ctx.sound('wrong');
        const why = fail || (ok ? `Слишком длинная программа — используй циклы (не больше ${task.maxCmds} команд).` : 'Цель не достигнута.');
        if (tries >= 3) { out.replaceChildren(msg(`❌ ${why}`, false)); run.disabled = true; ctx.done({ frac: 0, answer: 'нужно дойти до цели, обходя препятствия' }); }
        else out.replaceChildren(msg(`${why} Исправь программу (попыток: ${3 - tries}).`));
      }
    } }, '▶ Запуск');
    const reset = h('button', { class: 'btn small white', onclick: () => { if (running) return; prog.length = 0; pos = [...task.start]; draw(); showProg(); } }, '⟲ Очистить');
    el.append(h('div', { class: 'robot' }, grid, h('div', { class: 'rside' }, h('div', { class: 'lab-btns' }, cmd('up'), cmd('down'), cmd('left'), cmd('right')), list, h('div', { class: 'lab-btns' }, run, reset))), out);
    return { auto: true };
  },
};

// ---------- 🎨 Рисование ----------
const paint = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, `Рисуй мышкой или пальцем. Используй минимум ${task.minColors || 3} цвета`);
    const cv = h('canvas', { width: 560, height: 320, class: 'paint' });
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#ffffff';
    c2.fillRect(0, 0, 560, 320);
    if (task.guide) { c2.globalAlpha = 0.12; c2.font = '240px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(task.guide, 280, 165); c2.globalAlpha = 1; }
    const colors = task.colors || ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#af52de', '#8d5524', '#111111'];
    let color = colors[0], size = 10, down = false, last = null;
    const used = new Set();
    let ink = 0;
    const pal = h('div', { class: 'palette' }, colors.map((c) => {
      const b = h('button', { class: `swatch ${c === color ? 'on' : ''}`, style: { background: c }, onclick: () => { color = c; pal.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b)); } });
      return b;
    }), h('button', { class: 'btn small white', onclick: () => { size = size === 10 ? 22 : size === 22 ? 4 : 10; } }, '🖌 Кисть'));
    const pt = (e) => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [((t.clientX - r.left) / r.width) * 560, ((t.clientY - r.top) / r.height) * 320]; };
    const stroke = (p) => {
      c2.strokeStyle = color; c2.lineWidth = size; c2.lineCap = 'round';
      c2.beginPath(); c2.moveTo(...(last || p)); c2.lineTo(...p); c2.stroke();
      ink += last ? Math.hypot(p[0] - last[0], p[1] - last[1]) * size : size;
      used.add(color);
      last = p;
    };
    cv.addEventListener('mousedown', (e) => { down = true; last = null; stroke(pt(e)); });
    addEventListener('mouseup', () => (down = false));
    cv.addEventListener('mousemove', (e) => down && stroke(pt(e)));
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); down = true; last = null; stroke(pt(e)); }, { passive: false });
    cv.addEventListener('touchmove', (e) => { e.preventDefault(); stroke(pt(e)); }, { passive: false });
    cv.addEventListener('touchend', () => (down = false));
    el.append(pal, cv);
    return {
      empty: () => ink < 200,
      check() {
        const need = task.minColors || 3;
        const enough = ink > 560 * 320 * 0.04;
        const frac = Math.min(1, (used.size >= need ? 0.5 : (used.size / need) * 0.5) + (enough ? 0.5 : 0.25));
        ctx.sound(frac >= 1 ? 'star' : 'pop');
        return { frac, answer: frac >= 1 ? 'Красивый рисунок!' : `Используй ${need} цвета и заполни больше места на листе` };
      },
    };
  },
};

// ---------- 🎹 Повтори мелодию ----------
const NOTES = [['до', 60], ['ре', 62], ['ми', 64], ['фа', 65], ['соль', 67], ['ля', 69], ['си', 71]];
const melody = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, 'Послушай мелодию и повтори её на клавишах');
    const len = task.length || 4;
    const seq = task.notes ? task.notes.map((n) => NOTES.findIndex((x) => x[0] === n)) : Array.from({ length: len }, () => Math.floor(Math.random() * 7));
    const input = [];
    const keys = NOTES.map(([name, midi], i) => h('button', { class: 'pkey', onclick: () => {
      if (input.length >= seq.length) return;
      ctx.note(midi);
      keys[i].classList.add('hit');
      setTimeout(() => keys[i].classList.remove('hit'), 200);
      input.push(i);
      dots.children[input.length - 1].textContent = name;
      dots.children[input.length - 1].className = input[input.length - 1] === seq[input.length - 1] ? 'ok' : 'bad';
      if (input.length === seq.length) {
        const good = input.filter((v, k) => v === seq[k]).length;
        ctx.done({ frac: good / seq.length, answer: seq.map((k) => NOTES[k][0]).join(' – ') });
      }
    } }, name));
    const dots = h('div', { class: 'mdots' }, seq.map(() => h('span', {}, '?')));
    const play = h('button', { class: 'btn small blue', onclick: () => {
      seq.forEach((k, i) => setTimeout(() => { ctx.note(NOTES[k][1]); keys[k].classList.add('hit'); setTimeout(() => keys[k].classList.remove('hit'), 300); }, i * 550));
    } }, '▶ Послушать мелодию');
    el.append(h('div', { class: 'lab-btns' }, play), h('div', { class: 'piano' }, keys), dots);
    setTimeout(() => play.click(), 400);
    return { auto: true };
  },
};

// ---------- 🗺️ Карта мира ----------
const WORLD = [
  { name: 'Северная Америка', poly: [[60, 60], [190, 50], [230, 90], [180, 150], [150, 200], [120, 180], [70, 120]], color: '#f6b93b' },
  { name: 'Южная Америка', poly: [[170, 215], [230, 235], [215, 300], [190, 350], [175, 300], [160, 250]], color: '#78e08f' },
  { name: 'Евразия', poly: [[330, 60], [560, 40], [640, 90], [610, 150], [520, 190], [460, 170], [400, 160], [350, 130], [320, 100]], color: '#e58e26' },
  { name: 'Африка', poly: [[340, 165], [420, 170], [440, 230], [410, 310], [380, 315], [360, 250], [330, 210]], color: '#fad390' },
  { name: 'Австралия', poly: [[560, 260], [620, 255], [635, 300], [580, 310]], color: '#e55039' },
  { name: 'Антарктида', poly: [[120, 375], [600, 370], [560, 395], [150, 395]], color: '#f1f2f6' },
  { name: 'Россия', poly: [[440, 55], [600, 45], [630, 85], [560, 110], [470, 105], [430, 85]], color: '#eb2f06', overlay: true },
];
const OCEANS = [
  { name: 'Тихий океан', x: 660, y: 220 }, { name: 'Тихий океан', x: 40, y: 220 },
  { name: 'Атлантический океан', x: 280, y: 200 },
  { name: 'Индийский океан', x: 490, y: 260 },
  { name: 'Северный Ледовитый океан', x: 420, y: 18 },
  { name: 'Южный океан', x: 360, y: 355 },
];
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const map = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, 'Нажимай на карту в нужном месте');
    const cv = h('canvas', { width: 700, height: 400, class: 'worldmap' });
    const c2 = cv.getContext('2d');
    const draw = () => {
      c2.fillStyle = '#74b9ff'; c2.fillRect(0, 0, 700, 400);
      c2.strokeStyle = 'rgba(255,255,255,.4)'; c2.setLineDash([6, 6]); c2.beginPath(); c2.moveTo(0, 210); c2.lineTo(700, 210); c2.stroke(); c2.setLineDash([]);
      for (const p of WORLD) {
        if (p.overlay && !task.showRussia) continue;
        c2.fillStyle = p.color; c2.beginPath(); p.poly.forEach(([x, y], i) => (i ? c2.lineTo(x, y) : c2.moveTo(x, y))); c2.closePath(); c2.fill();
        c2.strokeStyle = 'rgba(0,0,0,.15)'; c2.lineWidth = 2; c2.stroke();
      }
      c2.fillStyle = 'rgba(255,255,255,.7)'; c2.font = 'bold 12px sans-serif'; c2.fillText('экватор', 8, 205);
    };
    draw();
    const find = task.find;
    let step = 0, good = 0;
    const ask = h('div', { class: 'scope-ask' }, h('span', { html: `Найди: <b>${find[0]}</b>` }));
    const marks = h('div', { class: 'scope-marks' });
    cv.addEventListener('click', (e) => {
      if (step >= find.length) return;
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 700, y = ((e.clientY - r.top) / r.height) * 400;
      let name = null;
      if (task.showRussia && inPoly(x, y, WORLD[6].poly)) name = 'Россия';
      if (!name) { const land = WORLD.slice(0, 6).find((p) => inPoly(x, y, p.poly)); if (land) name = land.name; }
      if (!name) { let bd = Infinity; OCEANS.forEach((o) => { const d = Math.hypot(x - o.x, y - o.y); if (d < bd) { bd = d; name = o.name; } }); }
      const ok = name === find[step];
      if (ok) good++;
      ctx.sound(ok ? 'correct' : 'wrong');
      c2.font = 'bold 22px sans-serif';
      c2.fillStyle = ok ? '#1e8449' : '#c0392b';
      c2.fillText(ok ? '📍' : '✗', x - 10, y + 6);
      marks.append(h('span', { class: `chip ${ok ? 'okc' : 'badc'}` }, `${ok ? '✅' : '❌'} ${find[step]}${ok ? '' : ` (ты нажал: ${name})`}`));
      step++;
      if (step < find.length) ask.innerHTML = `Найди: <b>${find[step]}</b>`;
      else { ask.textContent = 'Готово! 🌍'; ctx.done({ frac: good / find.length, answer: find.join(', ') }); }
    });
    el.append(ask, cv, marks);
    return { auto: true };
  },
};

// ---------- 📐 Угол (транспортир) ----------
const angle = {
  practical: true,
  render(el, task, ctx) {
    const build = task.mode !== 'measure';
    const target = task.target ?? (build ? 10 * (2 + Math.floor(Math.random() * 15)) : 5 * (4 + Math.floor(Math.random() * 30)));
    q(el, task, build ? `Поверни луч так, чтобы угол был ${target}°` : 'Измерь угол транспортиром и введи ответ в градусах');
    const cv = h('canvas', { width: 420, height: 240, class: 'protractor' });
    const c2 = cv.getContext('2d');
    let a = build ? 30 : target;
    const draw = () => {
      c2.clearRect(0, 0, 420, 240);
      const cx = 210, cy = 220, R = 190;
      c2.fillStyle = '#fff8d6'; c2.beginPath(); c2.arc(cx, cy, R, Math.PI, 0); c2.fill();
      c2.strokeStyle = '#b8860b'; c2.lineWidth = 2; c2.stroke();
      for (let d = 0; d <= 180; d += 10) {
        const rad = Math.PI - (d * Math.PI) / 180;
        const r1 = d % 30 === 0 ? R - 22 : R - 12;
        c2.beginPath(); c2.moveTo(cx + Math.cos(rad) * R, cy - Math.sin(rad) * R); c2.lineTo(cx + Math.cos(rad) * r1, cy - Math.sin(rad) * r1); c2.stroke();
        if (d % 30 === 0) { c2.fillStyle = '#7a5c00'; c2.font = 'bold 13px sans-serif'; c2.textAlign = 'center'; c2.fillText(d, cx + Math.cos(rad) * (R - 36), cy - Math.sin(rad) * (R - 36) + 4); }
      }
      c2.lineWidth = 5; c2.strokeStyle = '#2d3436';
      c2.beginPath(); c2.moveTo(cx, cy); c2.lineTo(cx + R * 0.95, cy); c2.stroke();
      const rad = (a * Math.PI) / 180;
      c2.strokeStyle = '#6c5ce7'; c2.beginPath(); c2.moveTo(cx, cy); c2.lineTo(cx + Math.cos(rad) * R * 0.95, cy - Math.sin(rad) * R * 0.95); c2.stroke();
      c2.strokeStyle = '#ff6b6b'; c2.lineWidth = 3; c2.beginPath(); c2.arc(cx, cy, 40, -rad, 0); c2.stroke();
    };
    draw();
    el.append(cv);
    if (build) {
      const sl = h('input', { type: 'range', min: 0, max: 180, value: a, class: 'scope-focus', style: { width: '100%' } });
      sl.addEventListener('input', () => { a = +sl.value; draw(); });
      el.append(sl);
      return { check() { const ok = Math.abs(a - target) <= (task.tol || 3); sl.disabled = true; ctx.sound(ok ? 'star' : 'wrong'); return { frac: ok ? 1 : 0, answer: `${target}° (у тебя ${a}°)` }; } };
    }
    const inp = h('input', { class: 'answer-input', inputmode: 'numeric', placeholder: 'градусы', style: { width: '160px' } });
    el.append(inp);
    return { empty: () => !inp.value.trim(), check() { const v = parseFloat(inp.value); const ok = Math.abs(v - target) <= (task.tol || 3); inp.classList.add(ok ? 'right' : 'wrong'); inp.disabled = true; return { frac: ok ? 1 : 0, answer: `${target}°` }; } };
  },
};

// ---------- 🥁 Ритм (прыжки, упражнения) ----------
const rhythm = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, 'Нажимай ПРОБЕЛ или кнопку, когда шарик в зелёной зоне');
    const hits = task.hits || 8;
    const ball = h('div', { class: 'rball' });
    const zone = h('div', { class: 'rzone' });
    const track = h('div', { class: 'rtrack' }, zone, ball);
    const score = h('div', { class: 'scope-ask' }, `Попаданий: 0 / ${hits}`);
    const btn = h('button', { class: 'btn green' }, task.action || '🦘 Прыжок!');
    el.append(h('div', { class: 'tipbox', style: { marginTop: 0 } }, task.exercise || '🏃 Разминка: держи ритм!'), track, h('div', { class: 'lab-btns' }, btn), score);
    let t = 0, n = 0, good = 0, done = false, raf;
    const speed = task.speed || 1.4;
    const loop = (ts) => {
      if (done) return;
      t = ts / 1000;
      const p = (Math.sin(t * speed * Math.PI) + 1) / 2;
      ball.style.left = `calc(${(p * 100).toFixed(1)}% - 18px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const hit = () => {
      if (done) return;
      const p = (Math.sin(t * speed * Math.PI) + 1) / 2;
      const ok = Math.abs(p - 0.5) < 0.12;
      n++;
      if (ok) good++;
      ctx.sound(ok ? 'coin' : 'kick');
      ball.classList.add(ok ? 'good' : 'miss');
      setTimeout(() => ball.classList.remove('good', 'miss'), 200);
      score.textContent = `Попаданий: ${good} / ${hits} (попыток ${n})`;
      if (n >= hits) { done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key); ctx.done({ frac: good / hits, answer: `${good} из ${hits} попаданий` }); }
    };
    const key = (e) => { if (e.code === 'Space') { e.preventDefault(); hit(); } };
    addEventListener('keydown', key);
    btn.addEventListener('click', hit);
    return { auto: true, cleanup: () => { done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key); } };
  },
};

// ---------- 🏃 Спорт в спортзале (3D) ----------
const sport = {
  practical: true,
  render(el, task, ctx) {
    q(el, task, 'Практика проходит прямо в спортзале!');
    const info = h('div', { class: 'tipbox' }, `🏃 ${task.exercise || 'Пробеги через все светящиеся кольца как можно быстрее!'} Норматив: ${task.limit || 30} сек.`);
    const go = h('button', { class: 'btn green big' }, '▶ На старт!');
    go.addEventListener('click', () => {
      go.disabled = true;
      ctx.sport(task).then((res) => {
        info.textContent = `⏱ Твоё время: ${res.answer}`;
        ctx.done(res);
      });
    });
    el.append(info, h('div', { class: 'lab-btns' }, go));
    return { auto: true };
  },
};

export const PRACTICALS = { chem, microscope, circuit, robot, paint, melody, map, angle, rhythm, sport };
export { shuffle };
