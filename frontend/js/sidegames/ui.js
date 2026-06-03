// ===========================================================================
//  Shared UI helpers for the side games. Every mini-game renders into a
//  full-screen "shell" overlay and talks back to the main app through `ctx`
//  (drink flow, AI host, toasts).
// ===========================================================================

export const SG = (sel, root = document) => root.querySelector(sel);
export const SGA = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const MOCK_KUNAL = {
  id: 'mock-kunal',
  name: 'Kunal Goenka Pasagadugula',
  sex: 'male',
  age: 28,
  isBot: true,
  questionnaire: { kink: 'Dominating Nandini', turnOn: 'Nandini submitting', ick: 'Role reversals' },
  drinks: [],
};

const MOCK_NANDINI = {
  id: 'mock-nandini',
  name: 'Nandini Pasagadugula Goenka',
  sex: 'female',
  age: 26,
  isBot: true,
  questionnaire: { kink: 'CNC, choke, doggy', turnOn: 'Kunal in control', ick: 'Topping Kunal' },
  drinks: [],
};

/** Mock partner for solo — mirrors lib/bot.js naming. */
export function mockPartnerFor(human) {
  const name = String(human?.name || '').toLowerCase();
  if (name.includes('nandini')) {
    return { ...MOCK_KUNAL, id: `${human.id}-mock-kunal` };
  }
  return { ...MOCK_NANDINI, id: `${human.id}-mock-nandini` };
}

/** Kunal + Nandini for side games — room pair, or human + mock, or pass-and-play. */
export function couplePlayers(ctx) {
  const players = (ctx.players || []).filter(Boolean);
  if (players.length >= 2) return [players[0], players[1]];

  if (players.length === 1) {
    const human = players[0];
    return [human, mockPartnerFor(human)];
  }

  return [MOCK_KUNAL, { ...MOCK_NANDINI }];
}

/** @deprecated use couplePlayers */
export function twoPlayers(ctx) {
  return couplePlayers(ctx);
}
export function gameShell({ title, emoji = '🎲', subtitle = '', theme = '', onClose, onHome } = {}) {
  const overlay = document.createElement('div');
  overlay.className = `sg-overlay${theme ? ' sg-theme-' + theme : ''}`;
  overlay.innerHTML = `
    <div class="sg-panel">
      <header class="sg-head">
        <div class="sg-title">${emoji} ${esc(title)}</div>
        <button type="button" class="sg-close back-btn" title="Back to main screen">‹ Main</button>
      </header>
      ${subtitle ? `<p class="sg-sub">${esc(subtitle)}</p>` : ''}
      <div class="sg-status" hidden></div>
      <div class="sg-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add('sg-closing');
    setTimeout(() => overlay.remove(), 180);
    onClose?.();
  };
  overlay.querySelector('.sg-close').addEventListener('click', () => {
    close();
    onHome?.();
  });

  const body = overlay.querySelector('.sg-panel .sg-body');
  const statusEl = overlay.querySelector('.sg-status');
  const setStatus = (html) => {
    statusEl.hidden = !html;
    statusEl.innerHTML = html || '';
  };

  return { overlay, panel: overlay.querySelector('.sg-panel'), body, setStatus, close };
}

// Confetti / particle burst at the center of an element.
export function burst(el, { emojis = ['🎉', '🍻', '🔥', '💦', '✨'], count = 24 } = {}) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'sg-particle';
    p.textContent = pick(emojis);
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 180;
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    p.style.fontSize = 14 + Math.random() * 22 + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

// Blood splatter for the gory games.
export function bloodSplat(el, x, y) {
  const rect = el.getBoundingClientRect();
  const cx = x ?? rect.left + rect.width / 2;
  const cy = y ?? rect.top + rect.height / 2;
  for (let i = 0; i < 18; i++) {
    const d = document.createElement('div');
    d.className = 'sg-blood';
    const ang = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 140;
    const size = 6 + Math.random() * 22;
    d.style.left = cx + 'px';
    d.style.top = cy + 'px';
    d.style.width = d.style.height = size + 'px';
    d.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    d.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
}

export function shake(el) {
  el.classList.remove('sg-shake');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('sg-shake');
}

// A reusable "round over" banner with an action button.
export function endCard(body, { title, html, btnLabel = 'Play again', onAgain, extraBtn } = {}) {
  const card = document.createElement('div');
  card.className = 'sg-endcard';
  card.innerHTML = `
    <h3>${esc(title)}</h3>
    <div class="sg-endcard-body">${html || ''}</div>
    <div class="sg-endcard-actions">
      ${extraBtn ? `<button class="sg-btn ghost" data-x>${esc(extraBtn.label)}</button>` : ''}
      <button class="sg-btn" data-again>${esc(btnLabel)}</button>
    </div>`;
  body.appendChild(card);
  card.querySelector('[data-again]')?.addEventListener('click', () => {
    card.remove();
    onAgain?.();
  });
  if (extraBtn) card.querySelector('[data-x]')?.addEventListener('click', () => extraBtn.onClick(card));
  return card;
}
