import { esc } from './menus.js';

/** Result overlays — party game landing, punishments, outcomes. */
export class OverlayController {
  constructor(root, callbacks) {
    this.root = root;
    this.cb = callbacks;
    this.el = null;
    this.tickCount = 0;
  }

  mount() {
    this.el = document.createElement('div');
    this.el.className = 'stb-overlays';
    this.root.appendChild(this.el);
  }

  destroy() {
    this.el?.remove();
  }

  clear() {
    if (this.el) this.el.innerHTML = '';
    this.tickCount = 0;
  }

  showPause(onResume, onQuit) {
    this.el.innerHTML = `
      <div class="stb-overlay-backdrop" role="presentation"></div>
      <div class="stb-glass stb-overlay-card stb-pause" role="dialog" aria-label="Pause menu">
        <h2 class="stb-h2">Paused</h2>
        <button class="stb-btn stb-btn-primary" data-resume>Resume</button>
        <button class="stb-btn stb-btn-ghost" data-quit>Quit Game</button>
      </div>`;
    this.el.querySelector('[data-resume]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.clear();
      onResume?.();
    });
    this.el.querySelector('[data-quit]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.clear();
      onQuit?.();
    });
  }

  /** Spin slowing — tick... tick... */
  showSpinning(phase) {
    if (phase === 'tick') {
      this.tickCount++;
      const tickEl = this.el.querySelector('.stb-spin-tick');
      if (tickEl) {
        tickEl.textContent = 'tick…'.repeat(Math.min(this.tickCount, 4));
        tickEl.classList.remove('pulse');
        void tickEl.offsetWidth;
        tickEl.classList.add('pulse');
      } else {
        this.el.innerHTML = `
          <div class="stb-spin-status" role="status" aria-live="polite">
            <p class="stb-spin-label">The bottle slows…</p>
            <p class="stb-spin-tick pulse">tick…</p>
          </div>`;
      }
    } else if (phase === 'fakeout') {
      this.el.innerHTML = `
        <div class="stb-spin-status stb-fakeout" role="status" aria-live="polite">
          <p class="stb-spin-label">Wait…</p>
          <p class="stb-spin-tick">it's moving again 😳</p>
        </div>`;
    } else if (phase === 'slow') {
      this.el.innerHTML = `
        <div class="stb-spin-status" role="status" aria-live="polite">
          <p class="stb-spin-label">Slowing down…</p>
          <p class="stb-spin-tick">watch it crawl</p>
        </div>`;
    } else if (phase === 'fast') {
      this.el.innerHTML = `
        <div class="stb-spin-status" role="status" aria-live="polite">
          <p class="stb-spin-label">🍾 Spinning…</p>
        </div>`;
    }
  }

  showLockIn(name, onDone) {
    this.el.innerHTML = `
      <div class="stb-flash" aria-hidden="true"></div>
      <div class="stb-lockin" role="status" aria-live="assertive">
        <p class="stb-lockin-badge">🍾 BOTTLE LOCKED IN</p>
        <p class="stb-lockin-point">👉 POINTING AT</p>
        <p class="stb-lockin-name">${esc(name.toUpperCase())}</p>
      </div>`;
    requestAnimationFrame(() => {
      this.el.querySelector('.stb-flash')?.classList.add('active');
      this.el.querySelector('.stb-lockin')?.classList.add('show');
    });
    setTimeout(() => onDone?.(), 1400);
  }

  showSpecialEvent(event, onContinue) {
    this.el.innerHTML = `
      <div class="stb-flash stb-flash-chaos active" aria-hidden="true"></div>
      <div class="stb-glass stb-overlay-card stb-special" role="dialog">
        <div class="stb-special-icon">${event.icon}</div>
        <h2 class="stb-special-title">${esc(event.title)}</h2>
        <p class="stb-special-desc">${esc(event.desc)}</p>
        <button class="stb-btn stb-btn-primary" data-go>LET'S GO 😈</button>
      </div>`;
    this.el.querySelector('[data-go]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      onContinue?.();
    });
    this.cb.onStagger?.(this.el);
  }

  showVerdict({
    target,
    spinner,
    roast,
    punishment,
    drunk,
    specialEvent,
    onSurvived,
    onRefused,
  }) {
    const firstName = target.name.split(' ')[0];
    this.el.innerHTML = `
      <div class="stb-overlay-backdrop stb-reveal-backdrop"></div>
      <div class="stb-glass stb-overlay-card stb-verdict" role="dialog" aria-label="Round result">
        <p class="stb-verdict-badge">🍾 BOTTLE LOCKED IN</p>
        <p class="stb-verdict-point">👉 POINTING AT <b>${esc(target.name.toUpperCase())}</b></p>

        <blockquote class="stb-roast">${esc(roast)}</blockquote>

        <div class="stb-drunk-chip">
          <span class="stb-drunk-emoji">${drunk.emoji}</span>
          <span class="stb-drunk-info">${esc(firstName)} · ${drunk.level}/10 ${esc(drunk.label)}</span>
        </div>

        <div class="stb-penalty-card">
          <span class="stb-penalty-type">${punishment.icon} ${esc(punishment.label)}</span>
          <p class="stb-penalty-text">${esc(punishment.text)}</p>
          ${punishment.drinks ? `<span class="stb-penalty-drinks">+${punishment.drinks} drink${punishment.drinks > 1 ? 's' : ''} if they fail</span>` : ''}
        </div>

        ${specialEvent ? `<div class="stb-event-tag">${specialEvent.icon} ${esc(specialEvent.title)} active</div>` : ''}

        <div class="stb-verdict-actions">
          <button class="stb-btn stb-btn-primary" data-survived>🍺 THEY SURVIVED</button>
          <button class="stb-btn stb-btn-danger" data-refused>😈 THEY REFUSED</button>
        </div>
        <button class="stb-btn stb-btn-ghost stb-btn-sm" data-double>DOUBLE DOWN 😈</button>
      </div>`;

    this.el.querySelector('[data-survived]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.clear();
      onSurvived?.(false);
    });
    this.el.querySelector('[data-refused]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.clear();
      onRefused?.();
    });
    this.el.querySelector('[data-double]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.clear();
      onSurvived?.(true);
    });

    this.cb.onStagger?.(this.el);
  }

  showOutcome({ title, subtitle, btnLabel, onSpin }) {
    this.el.innerHTML = `
      <div class="stb-glass stb-overlay-card stb-outcome" role="dialog">
        <h3 class="stb-outcome-title">${esc(title)}</h3>
        <p class="stb-outcome-sub">${esc(subtitle)}</p>
        <button class="stb-btn stb-btn-primary" data-spin>${esc(btnLabel || 'SPIN AGAIN 🔄')}</button>
      </div>`;
    this.el.querySelector('[data-spin]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.clear();
      onSpin?.();
    });
  }

  showToast(msg) {
    const t = document.createElement('div');
    t.className = 'stb-toast';
    t.textContent = msg;
    t.setAttribute('role', 'status');
    this.el.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => t.remove(), 2800);
  }
}

export { OverlayController as Overlays };
