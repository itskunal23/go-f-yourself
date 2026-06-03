/** Haptic feedback via Vibration API. */

export class Haptics {
  constructor() {
    this.enabled = 'vibrate' in navigator;
  }

  tap() {
    this.pulse(8);
  }

  spin() {
    this.pulse([12, 40, 8]);
  }

  tick() {
    this.pulse(4);
  }

  stop() {
    this.pulse([20, 60, 30, 60, 40]);
  }

  winner() {
    this.pulse([15, 30, 15, 30, 50, 80, 100]);
  }

  error() {
    this.pulse([40, 30, 40]);
  }

  pulse(pattern) {
    if (!this.enabled) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }

  cancel() {
    if (this.enabled) navigator.vibrate(0);
  }
}

export const haptics = new Haptics();
