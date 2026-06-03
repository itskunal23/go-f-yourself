import { clamp } from '../utils.js';

/**
 * Keyboard + touch input with momentum-friendly analog axis.
 */
export class Input {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.keys = Object.create(null);
    this.axis = 0;
    this.attack = false;
    this.heavy = false;
    this.jump = false;
    this._jumpQueued = false;
    this.touch = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this._jumpQueued = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.el.addEventListener('pointerdown', (e) => this._onDown(e));
    this.el.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
  }

  /** @param {PointerEvent} e */
  _onDown(e) {
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x > r.width * 0.55) {
      this.attack = true;
      if (e.clientY - r.top > r.height * 0.55) this.heavy = true;
      return;
    }
    this.touch.active = true;
    this.touch.id = e.pointerId;
    this.touch.ox = e.clientX;
    this.touch.oy = e.clientY;
    this.touch.x = 0;
    this.touch.y = 0;
    this.el.setPointerCapture(e.pointerId);
  }

  /** @param {PointerEvent} e */
  _onMove(e) {
    if (!this.touch.active || e.pointerId !== this.touch.id) return;
    this.touch.x = clamp((e.clientX - this.touch.ox) / 55, -1, 1);
    this.touch.y = clamp((e.clientY - this.touch.oy) / 55, -1, 1);
  }

  /** @param {PointerEvent} e */
  _onUp(e) {
    if (this.touch.active && e.pointerId === this.touch.id) {
      this.touch.active = false;
      this.touch.x = 0;
      this.touch.y = 0;
    }
    this.attack = false;
    this.heavy = false;
  }

  update() {
    let ax = this.touch.x;
    if (this.keys.ArrowLeft || this.keys.KeyA) ax -= 1;
    if (this.keys.ArrowRight || this.keys.KeyD) ax += 1;
    this.axis = clamp(ax, -1, 1);
    if (this._jumpQueued || this.keys.Space) {
      this.jump = true;
      this._jumpQueued = false;
    } else {
      this.jump = false;
    }
    if (this.keys.KeyJ || this.keys.KeyZ) this.attack = true;
    if (this.keys.KeyK || this.keys.KeyX) { this.attack = true; this.heavy = true; }
  }

  dispose() {
    /* listeners on window/el — game lifetime only */
  }
}
