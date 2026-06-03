import { getModeList, setCustomQuestions } from '../modes/index.js';
import { PLAYER_COUNTS } from './playerManager.js';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Glassmorphism menus and setup screens. */
export class MenuController {
  constructor(root, callbacks) {
    this.root = root;
    this.cb = callbacks;
    this.el = null;
    this.screen = 'home';
  }

  mount() {
    this.el = document.createElement('div');
    this.el.className = 'stb-ui';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Spin the Bottle menus');
    this.root.appendChild(this.el);
    this.showHome();
  }

  destroy() {
    this.el?.remove();
  }

  setScreen(name) {
    this.screen = name;
  }

  showHome() {
    this.screen = 'home';
    const modes = getModeList();
    this.el.innerHTML = `
      <div class="stb-glass stb-panel stb-home stb-stagger-parent">
        <div class="stb-logo stb-stagger" aria-hidden="true">🍾</div>
        <h1 class="stb-title stb-stagger">Spin the Bottle</h1>
        <p class="stb-sub stb-stagger">Roasts. Chaos. Regret.</p>
        <div class="stb-mode-grid stb-stagger">
          ${modes
            .map(
              (m) => `
            <button class="stb-mode-btn stb-stagger" data-mode="${m.id}" aria-label="${esc(m.name)}">
              <span class="stb-mode-icon">${m.icon}</span>
              <span class="stb-mode-name">${esc(m.name)}</span>
              <span class="stb-mode-desc">${esc(m.description)}</span>
            </button>`
            )
            .join('')}
        </div>
        <button class="stb-btn stb-btn-ghost stb-stagger" data-action="players" aria-label="Manage players">
          👥 Players &amp; Settings
        </button>
      </div>`;
    this.bindHome();
    this.cb.onStagger?.(this.el);
  }

  bindHome() {
    this.el.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cb.onModeSelect?.(btn.dataset.mode);
        this.cb.onSound?.('click');
      });
    });
    this.el.querySelector('[data-action="players"]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.showPlayers();
    });
  }

  showPlayers(players = [], playerCount = 4) {
    this.screen = 'players';
    this.el.innerHTML = `
      <div class="stb-glass stb-panel stb-players">
        <button class="stb-back" data-action="back" aria-label="Go back">←</button>
        <h2 class="stb-h2">Players</h2>
        <div class="stb-count-row" role="group" aria-label="Player count">
          ${PLAYER_COUNTS.map(
            (n) =>
              `<button class="stb-count-btn${n === playerCount ? ' active' : ''}" data-count="${n}" aria-pressed="${n === playerCount}">${n}</button>`
          ).join('')}
        </div>
        <ul class="stb-player-list" role="list">
          ${players
            .map(
              (p, i) => `
            <li class="stb-player-row stb-stagger" data-id="${esc(p.id)}">
              <label class="stb-avatar-btn" aria-label="Upload avatar for ${esc(p.name)}">
                <input type="file" accept="image/*" hidden data-avatar="${esc(p.id)}" />
                <span class="stb-avatar-preview">${p.avatar ? '' : (p.name[0] || '?').toUpperCase()}</span>
              </label>
              <input class="stb-name-input" value="${esc(p.name)}" data-name="${esc(p.id)}" aria-label="Player ${i + 1} name" />
              <button class="stb-icon-btn" data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)}" ${players.length <= 2 ? 'disabled' : ''}>✕</button>
            </li>`
            )
            .join('')}
        </ul>
        <div class="stb-custom-q">
          <label class="stb-label" for="stb-custom">Custom questions (one per line)</label>
          <textarea id="stb-custom" class="stb-textarea" rows="3" placeholder="Add your own truth/dare prompts…" aria-label="Custom questions"></textarea>
        </div>
        <label class="stb-toggle">
          <input type="checkbox" id="stb-reduced" ${document.documentElement.classList.contains('stb-reduced') ? 'checked' : ''} />
          <span>Reduce motion</span>
        </label>
        <label class="stb-toggle">
          <input type="checkbox" id="stb-sound" checked />
          <span>Sound effects</span>
        </label>
        <button class="stb-btn stb-btn-primary" data-action="done">Done</button>
      </div>`;
    this.bindPlayers();
    this.cb.onStagger?.(this.el);
  }

  bindPlayers() {
    this.el.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.showHome();
    });

    this.el.querySelectorAll('[data-count]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cb.onSound?.('click');
        this.cb.onPlayerCount?.(+btn.dataset.count);
      });
    });

    this.el.querySelectorAll('[data-name]').forEach((input) => {
      input.addEventListener('change', () => {
        this.cb.onRename?.(input.dataset.name, input.value);
      });
    });

    this.el.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cb.onSound?.('click');
        this.cb.onRemove?.(btn.dataset.remove);
      });
    });

    this.el.querySelectorAll('[data-avatar]').forEach((input) => {
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        this.cb.onAvatar?.(input.dataset.avatar, url);
      });
    });

    this.el.querySelector('#stb-custom')?.addEventListener('change', (e) => {
      const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean);
      setCustomQuestions(lines);
    });

    this.el.querySelector('#stb-reduced')?.addEventListener('change', (e) => {
      this.cb.onReducedMotion?.(e.target.checked);
    });

    this.el.querySelector('#stb-sound')?.addEventListener('change', (e) => {
      this.cb.onSoundToggle?.(e.target.checked);
    });

    this.el.querySelector('[data-action="done"]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.showHome();
    });
  }

  /** In-game HUD */
  showHUD({ modeName, spinnerName, canSpin, phase, drunkMap = {} }) {
    this.screen = 'hud';
    const hidden = phase === 'playing' ? '' : ' stb-hud-min';
    const drunkStrip = Object.entries(drunkMap)
      .slice(0, 4)
      .map(([, d]) => `<span class="stb-hud-drunk">${d.emoji} ${d.level}/10</span>`)
      .join('');
    this.el.innerHTML = `
      <div class="stb-hud-top">
        ${drunkStrip ? `<div class="stb-hud-drunk-strip" aria-label="Drunk levels">${drunkStrip}</div>` : ''}
      </div>
      <div class="stb-hud ${hidden}">
        <button class="stb-hud-btn" data-action="menu" aria-label="Open menu">☰</button>
        <div class="stb-hud-center">
          <span class="stb-hud-mode">${esc(modeName)}</span>
          ${spinnerName ? `<span class="stb-hud-turn">${esc(spinnerName)} spins</span>` : ''}
        </div>
        <button class="stb-hud-btn" data-action="players-quick" aria-label="Players">👥</button>
      </div>
      ${
        canSpin && phase === 'playing'
          ? `<p class="stb-spin-hint" aria-hidden="true">Tap or flick the bottle</p>`
          : ''
      }`;
    this.el.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.cb.onPause?.();
    });
    this.el.querySelector('[data-action="players-quick"]')?.addEventListener('click', () => {
      this.cb.onSound?.('click');
      this.cb.onPlayersQuick?.();
    });
  }

  hide() {
    if (this.el) this.el.style.pointerEvents = 'none';
    this.el?.querySelectorAll('.stb-glass').forEach((g) => {
      g.style.opacity = '0';
    });
  }

  show() {
    if (this.el) this.el.style.pointerEvents = '';
    this.el?.querySelectorAll('.stb-glass').forEach((g) => {
      g.style.opacity = '';
    });
  }
}

export { esc };
