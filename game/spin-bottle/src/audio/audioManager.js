/** Web Audio API sound synthesis — no external assets. */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.frictionOsc = null;
    this.frictionGain = null;
    this.unlocked = false;
  }

  async unlock() {
    if (this.unlocked) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.unlocked = true;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.7 : 0;
  }

  click() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.06);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  spinStart() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  startFriction(speed) {
    if (!this.enabled || !this.ctx) return;
    this.stopFriction();
    const t = this.ctx.currentTime;
    this.frictionOsc = this.ctx.createOscillator();
    this.frictionGain = this.ctx.createGain();
    this.frictionOsc.type = 'sawtooth';
    this.frictionOsc.frequency.value = 40 + speed * 120;
    this.frictionGain.gain.value = Math.min(0.1, 0.02 + speed * 0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    this.frictionOsc.connect(filter);
    filter.connect(this.frictionGain);
    this.frictionGain.connect(this.master);
    this.frictionOsc.start(t);
  }

  updateFriction(speed) {
    if (!this.frictionOsc || !this.frictionGain) return;
    this.frictionOsc.frequency.value = 40 + speed * 120;
    this.frictionGain.gain.value = Math.min(0.1, 0.02 + speed * 0.25);
  }

  stopFriction() {
    if (this.frictionOsc) {
      try {
        this.frictionOsc.stop();
      } catch {
        /* already stopped */
      }
      this.frictionOsc = null;
      this.frictionGain = null;
    }
  }

  bottleStop() {
    if (!this.enabled || !this.ctx) return;
    this.stopFriction();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.25);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);

    const clink = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    clink.type = 'square';
    clink.frequency.value = 1200;
    cg.gain.setValueAtTime(0.06, t + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    clink.connect(cg);
    cg.connect(this.master);
    clink.start(t + 0.05);
    clink.stop(t + 0.15);
  }

  celebrate() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523, 659, 784, 1047];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i * 0.1;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  whoosh() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  /** Slow spin tick — suspense beat */
  tick(pitch = 800) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = pitch;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  fakeOut() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(350, t + 0.12);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  lockIn() {
    if (!this.enabled || !this.ctx) return;
    this.stopFriction();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  chaos() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 100 + Math.random() * 400;
      const start = t + i * 0.05;
      g.gain.setValueAtTime(0.08, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }
}

export const audio = new AudioManager();
