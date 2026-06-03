// ===========================================================================
//  ui.js — in-game HUD: health/stamina bars, ammo, wave, score, weapon name,
//  crosshair, hit-marker, damage vignette and transient banners. Pure DOM
//  (cheap), updated each frame with simple writes only.
// ===========================================================================
export class UISystem {
  constructor(container) {
    this.root = document.createElement('div');
    this.root.className = 'bf3-hud';
    this.root.innerHTML = `
      <div class="bf3-cross">+</div>
      <div class="bf3-hitmark" id="bf3-hitmark"></div>
      <div class="bf3-vignette" id="bf3-vig"></div>
      <div class="bf3-top">
        <span id="bf3-wave">WAVE 1</span>
        <span id="bf3-score">0</span>
        <span id="bf3-timer" class="hidden">120</span>
      </div>
      <div class="bf3-bl">
        <div class="bf3-bar hp"><i id="bf3-hp"></i></div>
        <div class="bf3-bar st"><i id="bf3-st"></i></div>
      </div>
      <div class="bf3-br">
        <div class="bf3-wpn" id="bf3-wpn">Pistol</div>
        <div class="bf3-ammo" id="bf3-ammo">12</div>
      </div>
      <div class="bf3-banner" id="bf3-banner"></div>`;
    container.appendChild(this.root);
    this.el = {
      wave: this.root.querySelector('#bf3-wave'),
      score: this.root.querySelector('#bf3-score'),
      timer: this.root.querySelector('#bf3-timer'),
      hp: this.root.querySelector('#bf3-hp'),
      st: this.root.querySelector('#bf3-st'),
      wpn: this.root.querySelector('#bf3-wpn'),
      ammo: this.root.querySelector('#bf3-ammo'),
      vig: this.root.querySelector('#bf3-vig'),
      hit: this.root.querySelector('#bf3-hitmark'),
      banner: this.root.querySelector('#bf3-banner'),
    };
    this._lastHp = 100;
  }

  setMode(isTimeAttack) { this.el.timer.classList.toggle('hidden', !isTimeAttack); }

  frame(p) {
    this.el.hp.style.width = Math.max(0, p.hp) + '%';
    this.el.hp.style.background = p.hp > 50 ? '#37d67a' : p.hp > 22 ? '#ffd23f' : '#ff2d55';
    this.el.st.style.width = p.stamina + '%';
    if (p.hp < this._lastHp - 0.1) this.flashHurt();
    this._lastHp = p.hp;
    // low-hp vignette
    this.el.vig.style.opacity = p.hp < 40 ? (1 - p.hp / 40) * 0.85 : 0;
  }
  setScore(v) { this.el.score.textContent = v; }
  setWave(w) { this.el.wave.textContent = 'WAVE ' + w; }
  setTimer(s) { this.el.timer.textContent = Math.ceil(s); }
  setWeapon(name, ammo, reloading) {
    this.el.wpn.textContent = name;
    this.el.ammo.textContent = reloading ? '…' : (ammo === Infinity ? '∞' : ammo);
  }
  hitMarker() { const h = this.el.hit; h.classList.remove('show'); void h.offsetWidth; h.classList.add('show'); }
  flashHurt() { const v = this.el.vig; v.classList.remove('hurt'); void v.offsetWidth; v.classList.add('hurt'); }
  banner(text, ms = 1800) {
    const b = this.el.banner; b.textContent = text; b.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  dispose() { this.root.remove(); }
}
