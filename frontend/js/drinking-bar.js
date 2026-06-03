/**
 * Sober → drunk bar — Watson BAC from height/weight/sex + logged drinks.
 */
import { playerStatus } from './bac.js';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function profileFromPlayer(p) {
  return {
    sex: p.sex,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
  };
}

export function renderDrinkingBar(player, { mine = false, compact = false } = {}) {
  const st = playerStatus(profileFromPlayer(player), player.drinks || []);
  const pct = Math.min(100, Math.max(0, st.level * 10));
  const tierClass = st.level >= 8 ? ' drinking-bar--danger' : st.level >= 5.5 ? ' drinking-bar--warn' : '';
  const bodyMeta = compact
    ? ''
    : `<span class="drinking-bar__meta">${st.totalStandardDrinks} std · BAC ~${st.bac}%</span>`;

  return `<div class="drinking-bar${mine ? ' drinking-bar--mine' : ''}${tierClass}" data-player-id="${esc(player.id)}">
    <div class="drinking-bar__head">
      <span class="drinking-bar__name">${esc(player.name.split(' ')[0])}${mine ? ' · you' : ''}</span>
      <span class="drinking-bar__label">${esc(st.label)}</span>
    </div>
    <div class="drinking-bar__track" role="meter" aria-valuenow="${st.level}" aria-valuemin="0" aria-valuemax="10" aria-label="${esc(st.label)}">
      <div class="drinking-bar__liquid" style="--fill-pct:${pct}%;--fill-color:${st.color}"></div>
      <div class="drinking-bar__ticks" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>
    ${bodyMeta}
  </div>`;
}

export function renderDrinkingBars(view) {
  if (!view?.players?.length || view.gameMode === 'casual') return '';
  return view.players.map((p) => renderDrinkingBar(p, { mine: p.id === view.you, compact: view.players.length > 2 })).join('');
}

/** Animate bar after a drink is logged */
export function pulseDrinkingBar(playerId) {
  const bar = document.querySelector(`.drinking-bar[data-player-id="${playerId}"]`);
  if (!bar) return;
  bar.classList.remove('drinking-bar--pulse');
  void bar.offsetWidth;
  bar.classList.add('drinking-bar--pulse');
  const liquid = bar.querySelector('.drinking-bar__liquid');
  if (liquid) {
    liquid.classList.add('drinking-bar__liquid--glug');
    setTimeout(() => liquid.classList.remove('drinking-bar__liquid--glug'), 700);
  }
}
