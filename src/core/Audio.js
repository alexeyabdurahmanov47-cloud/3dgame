// Все звуки синтезируются через WebAudio — никаких внешних файлов не требуется.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.musicOn = false;
    this.mood = 'happy';
    this.hum = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    const len = ctx.sampleRate * 1;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.startMusic();
  }

  apply() {
    if (!this.ctx) return;
    const s = this.save.settings;
    this.sfx.gain.value = s.sfxVol;
    this.music.gain.setTargetAtTime(s.music ? s.musicVol * 0.3 : 0, this.ctx.currentTime, 0.2);
  }

  setMood(m) { this.mood = m; }

  tone(freq, dur, o = {}) {
    if (!this.ctx) return;
    const { type = 'sine', vol = 0.25, attack = 0.005, slide = 0, delay = 0, dest = this.sfx } = o;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, o = {}) {
    if (!this.ctx) return;
    const { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', delay = 0, dest = this.sfx } = o;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'step':
        this.noise(0.07, { vol: 0.12, freq: 500 + Math.random() * 300, q: 2 });
        break;
      case 'jump':
        this.tone(300, 0.18, { type: 'square', vol: 0.06, slide: 300 });
        break;
      case 'click':
        this.tone(880, 0.06, { type: 'triangle', vol: 0.12 });
        break;
      case 'hover':
        this.tone(1200, 0.03, { type: 'sine', vol: 0.04 });
        break;
      case 'coin':
        this.tone(988, 0.08, { type: 'square', vol: 0.08 });
        this.tone(1319, 0.25, { type: 'square', vol: 0.08, delay: 0.07 });
        break;
      case 'star':
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone(NOTE(76 + n), 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.07 }));
        break;
      case 'correct':
        this.tone(NOTE(72), 0.15, { type: 'triangle', vol: 0.2 });
        this.tone(NOTE(76), 0.15, { type: 'triangle', vol: 0.2, delay: 0.1 });
        this.tone(NOTE(79), 0.3, { type: 'triangle', vol: 0.2, delay: 0.2 });
        break;
      case 'wrong':
        this.tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: -80 });
        this.tone(180, 0.35, { type: 'sawtooth', vol: 0.08, delay: 0.15, slide: -60 });
        break;
      case 'levelup':
        [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => this.tone(NOTE(67 + n), 0.22, { type: 'square', vol: 0.07, delay: i * 0.09 }));
        break;
      case 'achievement':
        [0, 7, 12, 16].forEach((n, i) => this.tone(NOTE(72 + n), 0.5, { type: 'triangle', vol: 0.14, delay: i * 0.12 }));
        break;
      case 'buy':
        this.tone(NOTE(84), 0.1, { type: 'square', vol: 0.08 });
        this.tone(NOTE(88), 0.1, { type: 'square', vol: 0.08, delay: 0.08 });
        this.tone(NOTE(91), 0.3, { type: 'square', vol: 0.08, delay: 0.16 });
        break;
      case 'ding':
        this.tone(NOTE(88), 1.2, { type: 'sine', vol: 0.25 });
        this.tone(NOTE(84), 1.5, { type: 'sine', vol: 0.2, delay: 0.35 });
        break;
      case 'door':
        this.noise(0.6, { vol: 0.12, freq: 300, q: 0.7, type: 'lowpass' });
        break;
      case 'bell': {
        // школьный звонок — быстрые удары по металлу
        for (let i = 0; i < 22; i++) {
          this.tone(1650, 0.09, { type: 'square', vol: 0.05, delay: i * 0.06 });
          this.tone(2480, 0.07, { type: 'sine', vol: 0.05, delay: i * 0.06 });
        }
        break;
      }
      case 'whoosh':
        this.noise(0.5, { vol: 0.15, freq: 900, q: 0.5 });
        break;
      case 'pop':
        this.tone(600, 0.1, { type: 'sine', vol: 0.15, slide: 500 });
        break;
      case 'water':
        for (let i = 0; i < 6; i++) this.tone(900 + Math.random() * 900, 0.08, { type: 'sine', vol: 0.06, delay: i * 0.06, slide: -300 });
        break;
      case 'bark':
        this.tone(420, 0.12, { type: 'sawtooth', vol: 0.08, slide: -150 });
        this.tone(400, 0.12, { type: 'sawtooth', vol: 0.08, slide: -150, delay: 0.2 });
        break;
      case 'kick':
        this.noise(0.12, { vol: 0.3, freq: 180, q: 1, type: 'lowpass' });
        break;
      case 'horn':
        this.tone(370, 0.35, { type: 'square', vol: 0.05 });
        this.tone(466, 0.35, { type: 'square', vol: 0.05 });
        break;
      case 'page':
        this.noise(0.15, { vol: 0.08, freq: 3000, q: 0.6, type: 'highpass' });
        break;
      case 'tick':
        this.tone(1500, 0.03, { type: 'square', vol: 0.03 });
        break;
      default:
        break;
    }
  }

  startHum() {
    if (!this.ctx || this.hum) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 55;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 200;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.06, this.ctx.currentTime + 0.5);
    o.connect(f).connect(g).connect(this.sfx);
    o.start();
    this.hum = { o, g };
  }

  stopHum() {
    if (!this.hum) return;
    const { o, g } = this.hum;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
    o.stop(this.ctx.currentTime + 0.5);
    this.hum = null;
  }

  // Простая генеративная фоновая музыка (весёлый пентатонический мотив)
  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const prog = [
      [60, 64, 67], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [53, 57, 60], // F
    ];
    const penta = [0, 2, 4, 7, 9, 12, 14, 16];
    const beat = 60 / 104 / 2; // восьмые
    let next = this.ctx.currentTime + 0.2;
    let step = 0;
    let lastNote = 4;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.3) {
        const calm = this.mood === 'calm';
        const bar = Math.floor(step / 8) % 4;
        const chord = prog[bar];
        const delay = next - this.ctx.currentTime;
        if (step % 8 === 0) {
          this.tone(NOTE(chord[0] - 24), beat * 7, { type: 'triangle', vol: 0.22, dest: this.music, delay, attack: 0.02 });
          chord.forEach((n) => this.tone(NOTE(n), beat * 7.5, { type: 'sine', vol: 0.05, dest: this.music, delay, attack: 0.1 }));
        }
        if (step % 4 === 2 && !calm) this.tone(NOTE(chord[0] - 12), beat, { type: 'triangle', vol: 0.12, dest: this.music, delay });
        const p = calm ? 0.25 : 0.55;
        if (Math.random() < p) {
          lastNote = Math.max(0, Math.min(penta.length - 1, lastNote + Math.round((Math.random() - 0.5) * 3)));
          this.tone(NOTE(72 + penta[lastNote]), beat * (calm ? 2.5 : 1.4), { type: calm ? 'sine' : 'triangle', vol: 0.09, dest: this.music, delay, attack: 0.01 });
        }
        if (!calm && step % 2 === 0) this.noise(0.04, { vol: 0.025, freq: 8000, type: 'highpass', delay, dest: this.music });
        next += beat;
        step++;
      }
    };
    this._musicTimer = setInterval(schedule, 100);
  }
}
