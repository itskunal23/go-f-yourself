import { PhonemeDetector } from '../audio/phonemeDetector.js';

/**
 * Maps microphone volume / phonemes to mouth-open blendshape.
 */
export class LipsyncController {
  /** @param {BlendshapeController} blendshapes @param {import('../audio/microphone.js').MicrophoneCapture} mic */
  constructor(blendshapes, mic) {
    this.blend = blendshapes;
    this.mic = mic;
    this.detector = new PhonemeDetector();
    this.smooth = 0;
    this.enabled = false;
  }

  async start() {
    try {
      await this.mic.start();
      this.enabled = true;
    } catch { this.enabled = false; }
  }

  /** @param {number} dt */
  update(dt) {
    if (!this.enabled) return;
    const buf = this.mic.getLevel();
    const target = this.detector.analyze(buf);
    this.smooth += (target - this.smooth) * Math.min(1, dt * 18);
    this.blend.setValues({ mouthOpen: this.smooth });
  }

  stop() { this.mic.stop(); this.enabled = false; }
}
