// Звуки хоррор-режима: синтез WebAudio, позиционирование (панорама + затухание с расстоянием).
// Внешних файлов нет — всё генерируется на лету.
export class HorrorAudio {
  constructor(game) {
    this.game = game;
    this.nodes = [];
    this.heartT = 0;
  }

  get a() { return this.game.audio; }
  get ctx() { return this.game.audio.ctx; }

  start() {
    const A = this.a;
    A.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    // весёлую музыку — выключить
    A.music.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(A.sfx);
    // низкий гул здания
    const drone = ctx.createGain();
    drone.gain.value = 0.0001;
    drone.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 140;
    [41.2, 41.9, 61.7].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); this.nodes.push(o); });
    lp.connect(drone).connect(this.bus);
    // «ветер» в разбитых окнах
    const src = ctx.createBufferSource();
    src.buffer = A.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
    const wind = ctx.createGain(); wind.gain.value = 0.025;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 250;
    lfo.connect(lfoG).connect(bp.frequency);
    src.connect(bp).connect(wind).connect(this.bus);
    src.start(); lfo.start();
    this.nodes.push(src, lfo);
    this.drone = drone;
    this.tension = ctx.createGain();
    this.tension.gain.value = 0;
    const to = ctx.createOscillator(); to.type = 'triangle'; to.frequency.value = 110;
    const to2 = ctx.createOscillator(); to2.type = 'triangle'; to2.frequency.value = 116.5; // диссонанс
    to.connect(this.tension); to2.connect(this.tension);
    this.tension.connect(this.bus);
    to.start(); to2.start();
    this.nodes.push(to, to2);
  }

  stop() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this.nodes) { try { n.stop(t + 0.3); } catch (_) { /* уже остановлен */ } }
    this.nodes = [];
    if (this.bus) { this.bus.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => this.bus && this.bus.disconnect(), 600); this.bus = null; }
    this.a.apply();
  }

  // интенсивность погони 0..1 и сердцебиение
  setTension(k, dt) {
    if (!this.ctx || !this.tension) return;
    this.tension.gain.setTargetAtTime(k * 0.05, this.ctx.currentTime, 0.4);
    this.heartT -= dt;
    if (k > 0.15 && this.heartT <= 0) {
      this.heartT = 1.1 - k * 0.65;
      this.tone(52, 0.12, { type: 'sine', vol: 0.25 + k * 0.25 });
      this.tone(46, 0.14, { type: 'sine', vol: 0.18 + k * 0.2, delay: 0.16 });
    }
  }

  tone(f, dur, o = {}) { this.a.tone(f, dur, { dest: o.dest || this.bus || this.a.sfx, ...o }); }
  noise(dur, o = {}) { this.a.noise(dur, { dest: o.dest || this.bus || this.a.sfx, ...o }); }

  // точка в мире → узел панорамы и громкость
  spatial(pos, maxD = 30) {
    const ctx = this.ctx;
    const g = this.game;
    const cam = g.camera;
    const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z;
    const d = Math.hypot(dx, dz);
    const yaw = g.cam.yaw;
    const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, right / Math.max(2, d)));
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, 1 - d / maxD) ** 1.5;
    pan.connect(gain).connect(this.bus || this.a.sfx);
    setTimeout(() => { pan.disconnect(); gain.disconnect(); }, 4000);
    return { dest: pan, vol: gain.gain.value };
  }

  at(name, pos, opts = {}) {
    if (!this.ctx) return;
    const sp = pos ? this.spatial(pos, opts.close ? 12 : 34) : { dest: this.bus || this.a.sfx, vol: 1 };
    if (sp.vol < 0.01) return;
    this.play(name, sp.dest, opts);
  }

  play(name, dest = this.bus, opts = {}) {
    if (!this.ctx) return;
    const T = (f, d, o = {}) => this.a.tone(f, d, { dest, ...o });
    const N = (d, o = {}) => this.a.noise(d, { dest, ...o });
    switch (name) {
      case 'creak': // скрип двери
        for (let i = 0; i < 6; i++) T(95 + Math.random() * 60, 0.18, { type: 'sawtooth', vol: 0.05, delay: i * 0.11, slide: 40 * (Math.random() - 0.3) });
        N(0.7, { vol: 0.05, freq: 900, q: 6 });
        break;
      case 'slam': N(0.35, { vol: 0.4, freq: 160, q: 0.7, type: 'lowpass' }); T(60, 0.3, { vol: 0.3, slide: -30 }); break;
      case 'rattle': for (let i = 0; i < 5; i++) N(0.05, { vol: 0.15, freq: 2500, q: 3, delay: i * 0.06 }); break;
      case 'mstep': N(opts.heavy ? 0.18 : 0.12, { vol: opts.heavy ? 0.45 : 0.3, freq: 120, q: 0.8, type: 'lowpass' }); break;
      case 'mumble': for (let i = 0; i < 5; i++) T(140 + Math.random() * 60, 0.22, { type: 'sawtooth', vol: 0.025, delay: i * 0.2, slide: -30 }); break;
      case 'whisper': {
        for (let i = 0; i < 7; i++) N(0.25, { vol: opts.close ? 0.25 : 0.12, freq: 2500 + Math.random() * 2500, q: 4, delay: i * 0.14 });
        break;
      }
      case 'hiss': N(0.9, { vol: 0.2, freq: 5000, q: 0.5, type: 'highpass' }); T(80, 0.9, { type: 'sine', vol: 0.1, slide: -40 }); break;
      case 'scream': {
        N(1.3, { vol: 0.45, freq: 1800, q: 1.5 });
        [620, 655, 910].forEach((f, i) => T(f, 1.2, { type: 'sawtooth', vol: 0.08, slide: -380, delay: i * 0.03 }));
        break;
      }
      case 'roar': N(1.8, { vol: 0.55, freq: 220, q: 0.6, type: 'lowpass' }); [70, 73, 104].forEach((f) => T(f, 1.6, { type: 'sawtooth', vol: 0.15, slide: -25 })); break;
      case 'stinger': [233, 247, 349, 370, 523].forEach((f, i) => T(f, 1.6, { type: 'sawtooth', vol: 0.05, attack: 0.01, delay: i * 0.01 })); N(0.4, { vol: 0.3, freq: 3000, q: 0.7 }); break;
      case 'thud': N(0.3, { vol: 0.5, freq: 110, q: 0.7, type: 'lowpass' }); T(48, 0.35, { vol: 0.35, slide: -20 }); break;
      case 'glass': for (let i = 0; i < 8; i++) T(3000 + Math.random() * 4000, 0.08, { type: 'square', vol: 0.03, delay: i * 0.03 }); N(0.25, { vol: 0.25, freq: 6000, q: 0.7, type: 'highpass' }); break;
      case 'crunch': N(0.12, { vol: 0.25, freq: 4500, q: 1.2 }); break;
      case 'bells': for (let i = 0; i < 10; i++) T(1800 + Math.random() * 900, 0.4, { type: 'sine', vol: 0.08, delay: i * 0.05 }); break;
      case 'buzz': T(120, 0.25, { type: 'square', vol: 0.05 }); T(240, 0.25, { type: 'square', vol: 0.03 }); break;
      case 'spark': N(0.3, { vol: 0.35, freq: 4000, q: 1 }); T(90, 0.3, { type: 'square', vol: 0.12 }); break;
      case 'switch': T(1800, 0.03, { type: 'square', vol: 0.06 }); N(0.03, { vol: 0.08, freq: 3000 }); break;
      case 'tickH': T(900, 0.025, { type: 'square', vol: 0.05 }); break;
      case 'locker': N(0.25, { vol: 0.3, freq: 700, q: 2 }); T(180, 0.25, { type: 'square', vol: 0.05, slide: -60 }); break;
      case 'pickup': T(392, 0.4, { type: 'sine', vol: 0.12 }); T(466, 0.6, { type: 'sine', vol: 0.1, delay: 0.12 }); break;
      case 'rightH': T(220, 0.4, { type: 'triangle', vol: 0.12 }); T(330, 0.6, { type: 'triangle', vol: 0.1, delay: 0.1 }); break;
      case 'wrongH': T(90, 0.5, { type: 'sawtooth', vol: 0.16, slide: -40 }); N(0.4, { vol: 0.2, freq: 300, q: 1 }); break;
      case 'hit': N(0.35, { vol: 0.6, freq: 400, q: 0.5, type: 'lowpass' }); T(70, 0.4, { vol: 0.4, slide: -40 }); break;
      case 'breath': N(0.6, { vol: 0.06, freq: 900, q: 0.8 }); N(0.7, { vol: 0.05, freq: 700, q: 0.8, delay: 0.75 }); break;
      case 'battery': T(500, 0.08, { type: 'square', vol: 0.05 }); T(800, 0.1, { type: 'square', vol: 0.05, delay: 0.08 }); break;
      case 'click': T(1200, 0.02, { type: 'square', vol: 0.06 }); break;
      case 'bellBroken': [523, 554, 740].forEach((f, i) => T(f, 1.4, { type: 'square', vol: 0.05, delay: i * 0.02, slide: -60 })); break;
      case 'whistle': [0, 3, 7, 5, 3].forEach((n, i) => T(988 * Math.pow(2, n / 12), 0.28, { type: 'sine', vol: 0.05, delay: i * 0.3, slide: -20 })); break;
      case 'note': break;
      default: break;
    }
  }

  note(semi) { this.tone(262 * Math.pow(2, semi / 12), 0.5, { type: 'triangle', vol: 0.14 }); this.tone(131 * Math.pow(2, semi / 12), 0.6, { type: 'sine', vol: 0.08 }); }

  // случайные далёкие звуки школы
  ambient(dt) {
    this.ambT = (this.ambT ?? 6) - dt;
    if (this.ambT > 0) return;
    this.ambT = 6 + Math.random() * 12;
    const p = this.game.player.pos;
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 16;
    const pos = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
    this.at(['creak', 'mstep', 'thud', 'whisper', 'mumble', 'glass'][Math.floor(Math.random() * 6)], pos);
  }
}
