// ===========================================================================
//  audio.js — lightweight Web Audio: synthesized weapon/impact SFX (no asset
//  downloads), optional positional panning for enemy sounds, plus a simple
//  combat-music drone and environmental ambience bed.
// ===========================================================================
export class AudioSystem {
  constructor() {
    this.ok = false;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.ok = true;
    } catch { this.ok = false; }
    this._noiseBuf = null;
    this._music = null; this._amb = null;
  }
  resume() { if (this.ok && this.ctx.state === 'suspended') this.ctx.resume(); }

  setListener(camera) {
    if (!this.ok) return;
    const l = this.ctx.listener;
    const p = camera.position;
    if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; }
    else if (l.setPosition) l.setPosition(p.x, p.y, p.z);
    // forward
    const e = camera.rotation;
    const fx = -Math.sin(e.y), fz = -Math.cos(e.y);
    if (l.forwardX) { l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else if (l.setOrientation) l.setOrientation(fx, 0, fz, 0, 1, 0);
  }

  _noise() {
    if (!this._noiseBuf) {
      const n = this.ctx.sampleRate * 0.5;
      const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = b;
    }
    return this._noiseBuf;
  }

  _dest(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 4; p.maxDistance = 90; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.master);
    return p;
  }

  _tone(freq, dur, type, gain, dest, slideTo) {
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(dest); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  _burst(dur, gain, hp, dest) {
    const s = this.ctx.createBufferSource(); s.buffer = this._noise();
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(); s.stop(this.ctx.currentTime + dur);
  }

  sfx(name, pos) {
    if (!this.ok) return;
    const d = this._dest(pos);
    switch (name) {
      case 'pistol': this._burst(0.05, 0.5, 500, d); this._tone(180, 0.06, 'square', 0.25, d, 70); break;
      case 'smg': this._burst(0.035, 0.32, 600, d); break;
      case 'shotgun': this._burst(0.12, 0.6, 250, d); this._tone(90, 0.18, 'sawtooth', 0.3, d, 40); break;
      case 'knife': this._tone(900, 0.06, 'sine', 0.18, d, 300); this._burst(0.04, 0.18, 1200, d); break;
      case 'empty': this._tone(220, 0.04, 'square', 0.12, d, 160); break;
      case 'reload': this._tone(330, 0.05, 'square', 0.12, d); setTimeout(() => this.ok && this._tone(440, 0.05, 'square', 0.12, this.master), 180); break;
      case 'hit': this._burst(0.05, 0.3, 700, d); break;
      case 'enemyHit': this._tone(140, 0.12, 'sawtooth', 0.25, d, 60); break;
      case 'enemyAttack': this._tone(110, 0.14, 'square', 0.22, d, 70); this._burst(0.06, 0.2, 300, d); break;
      case 'hurt': this._tone(160, 0.2, 'sawtooth', 0.3, this.master, 60); break;
      case 'boss': this._tone(60, 1.0, 'sawtooth', 0.4, this.master, 40); this._burst(0.5, 0.2, 120, this.master); break;
      case 'wave': this._tone(440, 0.2, 'triangle', 0.2, this.master, 660); break;
      case 'gameover': [330, 262, 196, 130].forEach((f, i) => setTimeout(() => this.ok && this._tone(f, 0.3, 'triangle', 0.25, this.master), i * 180)); break;
      default: break;
    }
  }

  startMusic() {
    if (!this.ok || this._music) return;
    const g = this.ctx.createGain(); g.gain.value = 0.06; g.connect(this.master);
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 110.5;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lg = this.ctx.createGain(); lg.gain.value = 8; lfo.connect(lg); lg.connect(o2.frequency);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    o1.connect(f); o2.connect(f); f.connect(g);
    o1.start(); o2.start(); lfo.start();
    this._music = { o1, o2, lfo, g };
  }
  startAmbience() {
    if (!this.ok || this._amb) return;
    const s = this.ctx.createBufferSource(); s.buffer = this._noise(); s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    this._amb = { s, g };
  }
  stopAll() {
    if (!this.ok) return;
    try { this._music?.o1.stop(); this._music?.o2.stop(); this._music?.lfo.stop(); } catch {}
    try { this._amb?.s.stop(); } catch {}
    this._music = null; this._amb = null;
  }
  dispose() { this.stopAll(); try { this.ctx.close(); } catch {} }
}
