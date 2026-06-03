/**
 * Collectible card inspect — minimal Pokémon-style face; collection behind fold.
 */
import gsap from '/vendor/gsap/index.js';
import {
  rankMeta,
  categoryMeta,
  deckCatalog,
  collectibleTitle,
  cardFlavor,
  CATEGORY_SET_REWARD,
  DEFAULT_CATEGORIES,
} from './game.js?v=65';
import { GameAudio } from './game-audio.js';
import { haptic } from './mobile.js';

const BARTENDER_INSPECT_LINES = [
  'Still hunting this one? Skill issue.',
  'That card\'s been avoiding you all night.',
  'Need three more. Pace yourself.',
];

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function flavorHtml(flavor) {
  return esc(flavor)
    .split('\n')
    .filter(Boolean)
    .map((line) => `<span class="card-inspect-flavor__line">${line}</span>`)
    .join('');
}

function progressDots(owned, total = 4) {
  return Array.from({ length: total }, (_, i) =>
    `<span class="card-inspect-dot${i < owned ? ' card-inspect-dot--on' : ''}" aria-hidden="true"></span>`,
  ).join('');
}

function collectionRoster(view, categoryId, currentRank) {
  const hand = view?.yourHand || [];
  return deckCatalog(view?.cardCategories || DEFAULT_CATEGORIES)
    .filter((c) => c.category === categoryId)
    .map((c) => {
      const copies = hand.filter((h) => h.rank === c.rank).length;
      let state = 'hidden';
      if (c.rank === currentRank) state = 'current';
      else if (copies > 0) state = 'owned';
      return { rank: c.rank, title: collectibleTitle(c.rank), copies, state };
    });
}

function collectionFoldHtml(roster, cat) {
  if (roster.length <= 1) return '';
  const discovered = roster.filter((r) => r.state === 'owned' || r.state === 'current').length;
  const hidden = roster.length - discovered;

  const listItems = roster.map((item) => {
    if (item.state === 'hidden') {
      return `<li class="card-inspect-roster__item card-inspect-roster__item--hidden">🔒 Hidden Card</li>`;
    }
    const copies = item.copies > 1 ? ` ×${item.copies}` : '';
    const cur = item.state === 'current' ? ' card-inspect-roster__item--current' : '';
    return `<li class="card-inspect-roster__item card-inspect-roster__item--owned${cur}">✓ ${esc(item.title)}${copies}</li>`;
  }).join('');

  return `
    <details class="card-inspect-collection-fold">
      <summary class="card-inspect-collection-fold__summary">
        <span class="card-inspect-collection-fold__head">
          <span class="card-inspect-collection-fold__title">${esc(cat.short.toUpperCase())} SET</span>
          <span class="card-inspect-collection-fold__stats">${discovered} discovered · ${hidden} hidden</span>
        </span>
        <span class="card-inspect-collection-fold__cta">View Collection</span>
      </summary>
      <ul class="card-inspect-roster__list">${listItems}</ul>
    </details>`;
}

function maybeBartenderPop(overlay) {
  if (Math.random() > 0.08) return;
  const line = BARTENDER_INSPECT_LINES[Math.floor(Math.random() * BARTENDER_INSPECT_LINES.length)];
  const el = document.createElement('div');
  el.className = 'card-inspect-bartender';
  el.innerHTML = `<p class="card-inspect-bartender__line">🍺 "${esc(line)}"</p>`;
  overlay.querySelector('.card-inspect-stage')?.prepend(el);
  GameAudio.glassClink?.();
  gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  gsap.to(el, { opacity: 0, duration: 0.25, delay: 2.4, onComplete: () => el.remove() });
}

export function mountCardInspectOverlay({
  rank,
  view,
  playable = false,
  onClose,
  onAsk,
}) {
  const meta = rankMeta(rank);
  const cat = categoryMeta(meta.category);
  const reward = CATEGORY_SET_REWARD[meta.category] || { emoji: '🏺', label: 'SET COMPLETE' };
  const owned = (view?.yourHand || []).filter((c) => c.rank === rank).length;
  const roster = collectionRoster(view, meta.category, rank);
  const askLabel = playable ? 'ASK FOR CARD' : '';

  const overlay = document.createElement('div');
  overlay.id = 'card-expand-overlay';
  overlay.className = 'card-expand-overlay card-inspect-overlay';
  overlay.innerHTML = `
    <div class="card-expand-backdrop card-inspect-backdrop"></div>
    <article class="card-inspect-stage card-expand-stage">
      <button type="button" class="card-inspect-close-x" id="card-expand-close" aria-label="Close">×</button>

      <header class="card-inspect-face">
        <p class="card-inspect-category" style="--cat-accent:${cat.accent}">${cat.emoji} ${esc(cat.short.toUpperCase())}</p>
        <h2 class="card-inspect-title">${esc(collectibleTitle(rank))}</h2>
        <hr class="card-inspect__rule" aria-hidden="true" />
        <div class="card-inspect-flavor">${flavorHtml(cardFlavor(rank))}</div>
      </header>

      <footer class="card-inspect-foot">
        <hr class="card-inspect__rule" aria-hidden="true" />
        <div class="card-inspect-progress" aria-label="${owned} of 4 in this set">
          <div class="card-inspect-dots">${progressDots(owned)}</div>
          <p class="card-inspect-ratio">${owned} / 4</p>
        </div>
        <p class="card-inspect-reward">${reward.emoji} ${esc(reward.label)}</p>
        <hr class="card-inspect__rule" aria-hidden="true" />
        ${playable ? `<button type="button" class="btn-primary card-inspect-ask" id="card-expand-ask">${askLabel}</button>` : ''}
      </footer>

      ${collectionFoldHtml(roster, cat)}
    </article>`;

  overlay.querySelector('.card-inspect-backdrop')?.addEventListener('click', () => onClose?.());
  overlay.querySelector('#card-expand-close')?.addEventListener('click', () => onClose?.());
  overlay.querySelector('#card-expand-ask')?.addEventListener('click', () => onAsk?.());

  const fold = overlay.querySelector('.card-inspect-collection-fold');
  fold?.addEventListener('toggle', () => {
    if (fold.open) haptic('light');
  });

  maybeBartenderPop(overlay);
  return overlay;
}

export function animateCardInspectIn(overlay) {
  document.body.classList.add('card-expand-open');
  requestAnimationFrame(() => overlay.classList.add('show'));
  const stage = overlay.querySelector('.card-inspect-stage');
  if (stage) {
    gsap.fromTo(stage, { scale: 0.94, y: 20, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.32, ease: 'power3.out' });
  }
  haptic('light');
}
