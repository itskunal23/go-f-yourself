// ===========================================================================
//  input.js — low-latency touch + desktop input.
//   • Left side: dynamic virtual joystick (move).
//   • Right side: drag to look. FIRE / SPRINT / SWAP / RELOAD buttons.
//   • Desktop: WASD + pointer-lock mouselook + click-fire + Shift/Q/R.
//  Exposes a plain `state` object read by the player & weapon systems.
// ===========================================================================

export class InputSystem {
  constructor(container) {
    this.container = container;
    this.state = {
      move: { x: 0, y: 0 },      // x=strafe (+right), y=forward (+fwd)
      look: { dx: 0, dy: 0 },    // per-frame look delta (consumed each frame)
      firing: false,
      sprint: false,
      swap: false,               // one-shot edge flags
      reload: false,
    };
    this.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this._pointers = new Map();
    this._joyId = null; this._joyBase = { x: 0, y: 0 };
    this._lookId = null; this._lookLast = { x: 0, y: 0 };
    this._keys = {};
    this._build();
    this._bind();
  }

  _build() {
    const ui = document.createElement('div');
    ui.className = 'bf3-controls';
    ui.innerHTML = `
      <div class="bf3-joy" id="bf3-joy"><div class="bf3-joy-base" id="bf3-joybase"><div class="bf3-joy-knob" id="bf3-joyknob"></div></div></div>
      <div class="bf3-look" id="bf3-look"></div>
      <button class="bf3-btn bf3-fire" id="bf3-fire">FIRE</button>
      <button class="bf3-btn bf3-sprint" id="bf3-sprint">RUN</button>
      <button class="bf3-btn bf3-swap" id="bf3-swap">SWAP</button>
      <button class="bf3-btn bf3-reload" id="bf3-reload">⟳</button>`;
    this.container.appendChild(ui);
    this.ui = ui;
    this.elJoy = ui.querySelector('#bf3-joy');
    this.elJoyBase = ui.querySelector('#bf3-joybase');
    this.elJoyKnob = ui.querySelector('#bf3-joyknob');
    this.elLook = ui.querySelector('#bf3-look');
    if (!this.touch) ui.classList.add('desktop');
  }

  _bind() {
    const s = this.state;

    // ---- left joystick (touch + mouse) ----
    const joyDown = (e) => {
      e.preventDefault();
      const id = e.pointerId ?? 'm';
      this._joyId = id;
      const r = this.elJoy.getBoundingClientRect();
      const x = (e.clientX ?? e.touches?.[0].clientX);
      const y = (e.clientY ?? e.touches?.[0].clientY);
      this._joyBase = { x, y };
      this.elJoyBase.style.left = (x - r.left) + 'px';
      this.elJoyBase.style.top = (y - r.top) + 'px';
      this.elJoyBase.classList.add('on');
      this.elJoy.setPointerCapture?.(e.pointerId);
    };
    const joyMove = (e) => {
      if (this._joyId == null) return;
      const x = e.clientX, y = e.clientY;
      let dx = x - this._joyBase.x, dy = y - this._joyBase.y;
      const R = 52, d = Math.hypot(dx, dy) || 1, k = Math.min(d, R) / R;
      dx = dx / d * k; dy = dy / d * k;
      s.move.x = dx; s.move.y = -dy; // screen-down = backward
      this.elJoyKnob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    };
    const joyUp = () => { this._joyId = null; s.move.x = 0; s.move.y = 0; this.elJoyKnob.style.transform = 'translate(0,0)'; this.elJoyBase.classList.remove('on'); };
    this.elJoy.addEventListener('pointerdown', joyDown);
    this.elJoy.addEventListener('pointermove', joyMove);
    this.elJoy.addEventListener('pointerup', joyUp);
    this.elJoy.addEventListener('pointercancel', joyUp);

    // ---- right look drag ----
    const lookDown = (e) => { e.preventDefault(); this._lookId = e.pointerId; this._lookLast = { x: e.clientX, y: e.clientY }; this.elLook.setPointerCapture?.(e.pointerId); };
    const lookMove = (e) => {
      if (this._lookId !== e.pointerId) return;
      s.look.dx += e.clientX - this._lookLast.x;
      s.look.dy += e.clientY - this._lookLast.y;
      this._lookLast = { x: e.clientX, y: e.clientY };
    };
    const lookUp = (e) => { if (this._lookId === e.pointerId) this._lookId = null; };
    this.elLook.addEventListener('pointerdown', lookDown);
    this.elLook.addEventListener('pointermove', lookMove);
    this.elLook.addEventListener('pointerup', lookUp);
    this.elLook.addEventListener('pointercancel', lookUp);

    // ---- buttons ----
    const hold = (el, on) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(true); el.classList.add('held'); });
      const off = () => { on(false); el.classList.remove('held'); };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold(this.ui.querySelector('#bf3-fire'), (v) => (s.firing = v));
    hold(this.ui.querySelector('#bf3-sprint'), (v) => (s.sprint = v));
    this.ui.querySelector('#bf3-swap').addEventListener('pointerdown', (e) => { e.preventDefault(); s.swap = true; });
    this.ui.querySelector('#bf3-reload').addEventListener('pointerdown', (e) => { e.preventDefault(); s.reload = true; });

    // ---- desktop keyboard + pointer lock ----
    this._onKey = (e) => {
      const d = e.type === 'keydown';
      this._keys[e.code] = d;
      if (e.code === 'KeyR' && d) s.reload = true;
      if ((e.code === 'KeyQ' || e.code === 'KeyE') && d) s.swap = true;
      s.sprint = !!this._keys['ShiftLeft'] || !!this._keys['ShiftRight'];
      if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft'].includes(e.code)) e.preventDefault();
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);

    if (!this.touch) {
      const canvasArea = this.elLook;
      this._onLockMove = (e) => { if (document.pointerLockElement) { s.look.dx += e.movementX; s.look.dy += e.movementY; } };
      this._onLockDown = () => { if (!document.pointerLockElement) this.container.requestPointerLock?.(); s.firing = true; };
      this._onLockUp = () => { s.firing = false; };
      this.container.addEventListener('mousemove', this._onLockMove);
      this.container.addEventListener('mousedown', this._onLockDown);
      window.addEventListener('mouseup', this._onLockUp);
      canvasArea.style.pointerEvents = 'none'; // let canvas/pointer-lock handle desktop
    }
  }

  /** Resolve WASD into the move vector for desktop (touch sets it directly). */
  _kbdMove() {
    if (this.touch) return;
    const k = this._keys; const s = this.state;
    s.move.x = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0);
    s.move.y = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0);
  }

  /** Read & clear one-shot flags. Call once per frame AFTER systems read state. */
  endFrame() {
    this.state.look.dx = 0; this.state.look.dy = 0;
    this.state.swap = false; this.state.reload = false;
  }

  beginFrame() { this._kbdMove(); }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKey);
    if (this._onLockMove) {
      this.container.removeEventListener('mousemove', this._onLockMove);
      this.container.removeEventListener('mousedown', this._onLockDown);
      window.removeEventListener('mouseup', this._onLockUp);
      if (document.pointerLockElement) document.exitPointerLock?.();
    }
    this.ui.remove();
  }
}
