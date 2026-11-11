import { h } from './dom.js';

export function openSettings(game) {
  const s = game.save.settings;
  const row = (label, control) => h('div', { class: 'setting' }, h('span', {}, label), control);
  const toggle = (key, after) => {
    const b = h('button', { class: `toggle ${s[key] ? 'on' : ''}`, onclick: () => {
      s[key] = !s[key];
      b.classList.toggle('on', s[key]);
      game.audio.play('click');
      after && after();
      game.save.soon();
    } });
    return b;
  };
  const range = (key, min, max, step, after) => h('input', { type: 'range', min, max, step, value: s[key], oninput: (e) => {
    s[key] = parseFloat(e.target.value);
    after && after();
    game.save.soon();
  } });
  const seg = (key, opts, after) => {
    const wrap = h('div', { class: 'seg' });
    const render = () => {
      wrap.innerHTML = '';
      opts.forEach(([v, label]) => wrap.append(h('button', { class: s[key] === v ? 'on' : '', onclick: () => { s[key] = v; render(); game.audio.play('click'); after && after(); game.save.soon(); } }, label)));
    };
    render();
    return wrap;
  };
  const body = h('div', {},
    row('🎵 Фоновая музыка', toggle('music', () => game.audio.apply())),
    row('🎚️ Громкость музыки', range('musicVol', 0, 1, 0.05, () => game.audio.apply())),
    row('🔊 Громкость звуков', range('sfxVol', 0, 1, 0.05, () => { game.audio.apply(); game.audio.play('coin'); })),
    row('🖱️ Чувствительность мыши', range('sens', 0.3, 2.5, 0.1)),
    row('↕️ Инвертировать ось Y', toggle('invertY')),
    row('🏷️ Метки над объектами', toggle('labels')),
    row('🖥️ Графика', seg('quality', [['low', 'Быстрая'], ['high', 'Красивая']], () => game.applyQuality())),
    row('⏱️ Длина урока (30 игровых мин.)', seg('lessonSeconds', [[180, '3 мин'], [300, '5 мин'], [600, '10 мин'], [1200, '20 мин']])),
    h('div', { class: 'setting' }, h('span', {}, '🗑️ Сбросить весь прогресс'),
      h('button', { class: 'btn red small', onclick: () => {
        if (confirm('Точно удалить весь прогресс, монеты и покупки?')) {
          game.save.reset();
          location.reload();
        }
      } }, 'Сбросить')),
    h('p', { style: { color: '#7a7799', fontWeight: 700, marginBottom: 0 } }, 'Подсказка: клавиша M быстро включает и выключает музыку.'));
  game.ui.modal('settings', '⚙️ Настройки', body);
}
