/**
 * Microphone capture via Web Audio API.
 */
export class MicrophoneCapture {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {AnalyserNode|null} */
    this.analyser = null;
    /** @type {Uint8Array|null} */
    this.data = null;
    /** @type {MediaStream|null} */
    this.stream = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.65;
    src.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /** @returns {Uint8Array} */
  getLevel() {
    if (!this.analyser || !this.data) return new Uint8Array(0);
    this.analyser.getByteFrequencyData(this.data);
    return this.data;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
  }
}
