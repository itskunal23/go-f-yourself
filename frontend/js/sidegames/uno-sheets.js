import { esc } from './ui.js';

function mountSheet(html) {
  const overlay = document.createElement('div');
  overlay.className = 'uno-sheet-overlay';
  overlay.innerHTML = `<div class="uno-sheet">${html}</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  };
}

export function openUnoSheet({ title, body = '', primaryLabel = 'Done', secondaryLabel = null, onPrimary, onSecondary }) {
  return new Promise((resolve) => {
    const close = mountSheet(`
      <div class="uno-sheet-grab"></div>
      <h4 class="uno-sheet-title">${esc(title)}</h4>
      ${body ? `<p class="uno-sheet-body">${esc(body)}</p>` : ''}
      <button type="button" class="uno-sheet-btn primary" data-primary>${esc(primaryLabel)}</button>
      ${secondaryLabel ? `<button type="button" class="uno-sheet-btn ghost" data-secondary>${esc(secondaryLabel)}</button>` : ''}
    `);
    const overlay = document.querySelector('.uno-sheet-overlay:last-of-type');
    overlay?.querySelector('[data-primary]')?.addEventListener('click', () => {
      close();
      onPrimary?.();
      resolve('primary');
    });
    overlay?.querySelector('[data-secondary]')?.addEventListener('click', () => {
      close();
      onSecondary?.();
      resolve('secondary');
    });
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
        resolve('dismiss');
      }
    });
  });
}

export function pickColorSheet(title = 'Pick a color') {
  const colors = [
    { id: 'red', emoji: '🔴', hex: '#E40521' },
    { id: 'yellow', emoji: '🟡', hex: '#FFCD00' },
    { id: 'green', emoji: '🟢', hex: '#009246' },
    { id: 'blue', emoji: '🔵', hex: '#0081CD' },
  ];
  return new Promise((resolve) => {
    const close = mountSheet(`
      <div class="uno-sheet-grab"></div>
      <h4 class="uno-sheet-title">${esc(title)}</h4>
      <div class="uno-color-grid">
        ${colors.map((c) =>
          `<button type="button" class="uno-color-swatch" data-c="${c.id}" style="--swatch:${c.hex}" aria-label="${c.id}">${c.emoji}</button>`
        ).join('')}
      </div>
    `);
    const overlay = document.querySelector('.uno-sheet-overlay:last-of-type');
    overlay?.querySelectorAll('.uno-color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        close();
        resolve(btn.dataset.c);
      });
    });
  });
}

export function openRulesSheet({ stats = {}, history = [] } = {}) {
  const recent = [...history].reverse().slice(0, 12);
  const historyHtml = recent.length
    ? `<div class="uno-history"><h5 class="uno-history-title">Recent</h5><ul class="uno-history-list">${recent.map((h) =>
        `<li>${esc(h.text || h.title || '')}</li>`
      ).join('')}</ul></div>`
    : '';

  mountSheet(`
    <div class="uno-sheet-grab"></div>
    <h4 class="uno-sheet-title">Rules</h4>
    <ul class="uno-rules-list">
      <li><span class="uno-rule-icon">⊘</span> Skip</li>
      <li><span class="uno-rule-icon">⇄</span> Reverse</li>
      <li><span class="uno-rule-icon">+2</span> Draw two · stackable</li>
      <li><span class="uno-rule-icon">+4</span> Draw four · stackable</li>
      <li><span class="uno-rule-icon">⏭</span> Skip everyone</li>
      <li><span class="uno-rule-icon">📤</span> Discard all (same color)</li>
      <li><span class="uno-rule-icon">🔄</span> 7 — swap hands</li>
      <li><span class="uno-rule-icon">📦</span> 0 — pass hands</li>
      <li><span class="uno-rule-icon">💀</span> 25 cards — eliminated</li>
    </ul>
    ${stats.wins != null ? `<p class="uno-sheet-meta">Wins: ${stats.wins}</p>` : ''}
    ${historyHtml}
    <button type="button" class="uno-sheet-btn primary" data-close>Got it</button>
  `);
  const overlay = document.querySelector('.uno-sheet-overlay:last-of-type');
  overlay?.querySelector('[data-close]')?.addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  });
}
