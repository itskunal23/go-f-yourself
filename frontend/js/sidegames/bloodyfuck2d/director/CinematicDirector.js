import gsap from '/vendor/gsap/index.js';
import { clamp, lerp } from '../utils.js';

/**
 * Dynamic camera shake, zoom, hit-stop, and time scaling.
 */
export class CinematicDirector {
  constructor() {
    this.shake = 0;
    this.shakeDecay = 8;
    this.zoom = 1;
    this.targetZoom = 1;
    this.timeScale = 1;
    this.flash = 0;
    this.danger = 0;
    this.camX = 0;
    this.camY = 0;
    this._hitStop = 0;
  }

  /** @param {number} amount @param {number} [duration=0.06] */
  hitStop(amount = 0.08, duration = 0.06) {
    this._hitStop = duration;
    this.timeScale = amount;
    gsap.to(this, { timeScale: 1, duration: duration * 2, ease: 'power2.out' });
  }

  /** @param {number} power */
  shakeImpact(power = 1) {
    this.shake = Math.max(this.shake, 4 + power * 10);
    this.flash = Math.max(this.flash, 0.15 + power * 0.12);
    this.targetZoom = 1 + power * 0.04;
    gsap.to(this, { targetZoom: 1, duration: 0.35, ease: 'power2.out' });
  }

  /** @param {number} danger01 */
  setDanger(danger01) {
    this.danger = danger01;
    this.targetZoom = lerp(1, 1.06, danger01 * 0.5);
  }

  /** @param {number} targetX @param {number} targetY @param {number} dt */
  follow(targetX, targetY, dt) {
    this.camX = lerp(this.camX, targetX, 1 - Math.pow(0.001, dt));
    this.camY = lerp(this.camY, targetY * 0.15, 1 - Math.pow(0.01, dt));
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.pow(0.001, dt));
    this.shake *= Math.exp(-this.shakeDecay * dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this._hitStop > 0) this._hitStop -= dt;
  }

  /** @returns {{ ox: number, oy: number, zoom: number, timeScale: number, flash: number }} */
  getTransform() {
    const ox = (Math.random() - 0.5) * this.shake * 2;
    const oy = (Math.random() - 0.5) * this.shake * 2;
    return { ox, oy, zoom: this.zoom, timeScale: this.timeScale, flash: this.flash };
  }
}
