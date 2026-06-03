import { rand, clamp } from '../utils.js';

/**
 * Layered Web Audio — movement, impacts, ambience, dynamic danger mix.
 */
export class AudioDirector {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.master = null;
    /** @type {GainNode|null} */
    this.sfx = null;
    /** @type {GainNode|null} */
    this.amb = null;
    /** @type {GainNode|null} */
    this.music = null;
    this.danger = 0;
    this.speed = 0;
    this._stepT = 0;
    this._breathT = 0;
    this._wind = null;
    this._city = null;
    this._dripT = 0;
  }

  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.amb = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.gain.value = 1;
    this.amb.gain.value = 0.55;
    this.music.gain.value = 0.22;
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.music.connect(this.master);

    this._startAmbience();
    this._startMusicBed();
  }

  resume() { return this.ctx?.resume(); }

  _noise(dur, { type = 'bandpass', freq = 600, q = 0.8, gain = 0.2, pan = 0, bus = 'sfx' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    src.connect(f).connect(g).connect(p).connect(this[bus]);
    src.start(t);
    src.stop(t + dur);
  }

  _startAmbience() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Wind layer
    this._wind = this.ctx.createOscillator();
    const wg = this.ctx.createGain();
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 180;
    this._wind.type = 'sawtooth';
    this._wind.frequency.value = 42;
    wg.gain.value = 0.018;
    this._wind.connect(wf).connect(wg).connect(this.amb);
    this._wind.start(t);

    // Distant city rumble
    this._city = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    const cf = this.ctx.createBiquadFilter();
    cf.type = 'lowpass';
    cf.frequency.value = 90;
    this._city.type = 'triangle';
    this._city.frequency.value = 28;
    cg.gain.value = 0.012;
    this._city.connect(cf).connect(cg).connect(this.amb);
    this._city.start(t);
  }

  _startMusicBed() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    g.gain.value = 0.04;
    osc.connect(g).connect(this.music);
    osc.start(t);
    this._musicOsc = osc;
  }

  /** @param {number} dt @param {number} playerSpeed @param {number} danger01 */
  update(dt, playerSpeed, danger01) {
    if (!this.ctx) return;
    this.speed = playerSpeed;
    this.danger = danger01;
    const t = this.ctx.currentTime;
    if (this.sfx) this.sfx.gain.setTargetAtTime(0.85 + danger01 * 0.35, t, 0.15);
    if (this.amb) this.amb.gain.setTargetAtTime(0.45 + (1 - danger01) * 0.15, t, 0.2);
    if (this.music) this.music.gain.setTargetAtTime(0.15 + danger01 * 0.25, t, 0.25);
    if (this._wind) this._wind.frequency.setTargetAtTime(38 + playerSpeed * 2 + danger01 * 12, t, 0.1);

    this._breathT += dt;
    if (danger01 > 0.45 && this._breathT > 1.8 - danger01) {
      this._breathT = 0;
      this._noise(0.35, { type: 'bandpass', freq: 280 + danger01 * 120, q: 1.2, gain: 0.04 + danger01 * 0.05, bus: 'amb' });
    }

    this._dripT += dt;
    if (this._dripT > rand(2.5, 5)) {
      this._dripT = 0;
      this._noise(0.08, { type: 'highpass', freq: 1200, q: 2, gain: 0.03, pan: rand(-0.8, 0.8), bus: 'amb' });
    }
  }

  /** @param {'concrete'|'metal'} surface @param {number} speed */
  footstep(surface, speed) {
    if (!this.ctx || speed < 0.4) return;
    const t = this.ctx.currentTime;
    if (t - this._stepT < 0.28 - speed * 0.04) return;
    this._stepT = t;
    const freq = surface === 'metal' ? 900 : 220;
    this._noise(0.06, { type: 'bandpass', freq, q: surface === 'metal' ? 3 : 0.8, gain: 0.06 + speed * 0.03 });
    this._noise(0.04, { type: 'lowpass', freq: 120, q: 0.5, gain: 0.04, bus: 'amb' });
  }

  /** @param {'light'|'heavy'|'block'} type @param {number} pan */
  impact(type, pan = 0) {
    if (!this.ctx) return;
    const heavy = type === 'heavy';
    this._noise(heavy ? 0.14 : 0.08, { type: 'bandpass', freq: heavy ? 420 : 680, q: 0.7, gain: heavy ? 0.35 : 0.22, pan });
    this._noise(0.05, { type: 'highpass', freq: 1800, q: 2, gain: 0.12, pan });
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(heavy ? 90 : 140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(heavy ? 0.2 : 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    osc.connect(g).connect(p).connect(this.sfx);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  whoosh(pan = 0) {
    this._noise(0.1, { type: 'bandpass', freq: 500, q: 1, gain: 0.08, pan });
  }

  creak() {
    this._noise(0.4, { type: 'bandpass', freq: 160, q: 4, gain: 0.05, bus: 'amb' });
  }

  dispose() {
    try { this._wind?.stop(); this._city?.stop(); this._musicOsc?.stop(); this.ctx?.close(); } catch {}
    this.ctx = null;
  }
}
