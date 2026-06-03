import gsap from '/vendor/gsap/index.js';
import { RANKS, rankMeta, categoryMeta } from './game.js?v=63';
import { GameAudio as CardAudio } from './game-audio.js?v=63';
import { haptic } from './mobile.js';
import { wireTap } from './touch-ui.js?v=3';
import { bindHandStackFocus } from './interactions/hand-focus.js';
import {
  CardStackModel,
  buildCardStackView,
  CardStackAnimator,
  refreshStackDeckIndices,
} from './card-stacks.js?v=4';
import {
  createTransformGhost,
  timelineCardTravel,
  pulseCardLand,
  motionEase,
  motionScale,
  EASE_SETTLE,
  DUR,
} from './motion.js?v=1';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Orange fish blob — board-game cartoon style */
function fishBody(id, { mouth = 'o', eye = 'normal' } = {}) {
  const mouthPath = {
    o: '<ellipse cx="62" cy="52" rx="8" ry="10" fill="#1a2a5e"/>',
    gag: '<path d="M54 48 Q62 58 70 48" stroke="#1a2a5e" stroke-width="3" fill="none"/>',
    grin: '<path d="M54 50 Q62 58 70 50" stroke="#1a2a5e" stroke-width="2.5" fill="none"/>',
    shock: '<ellipse cx="62" cy="52" rx="10" ry="12" fill="#1a2a5e"/>',
  }[mouth] || '';
  const eyeExtra = eye === 'lazy'
    ? '<circle cx="48" cy="38" r="2" fill="#1a2a5e"/>'
    : eye === 'x'
      ? '<path d="M44 34 L52 42 M52 34 L44 42" stroke="#1a2a5e" stroke-width="2"/>'
      : '';
  return `
    <g class="gfy-fish" id="${id}">
      <ellipse cx="62" cy="56" rx="34" ry="26" fill="#ff6b2c"/>
      <ellipse cx="38" cy="54" rx="10" ry="14" fill="#ff6b2c"/>
      <circle cx="50" cy="40" r="7" fill="#fff"/>
      <circle cx="52" cy="40" r="3.5" fill="#1a2a5e"/>
      ${eyeExtra}
      ${mouthPath}
      <path d="M88 52 L98 48 L98 60 Z" fill="#ff6b2c"/>
    </g>`;
}

/** Animated scene per card — Kunal/Nandini lore, explicit cartoon motion */
const CARD_ART = {
  whiskeydick: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-wd', { mouth: 'shock', eye: 'x' })}
      <g class="gfy-anim-whiskey">
        <rect x="88" y="16" width="14" height="36" rx="4" fill="#8B4513"/>
        <rect x="90" y="12" width="10" height="6" rx="2" fill="#D2691E"/>
        <text x="91" y="34" font-size="7" fill="#fff">🥃</text>
      </g>
      <g class="gfy-anim-limp">
        <path d="M76 58 Q82 68 88 58" stroke="#e8182a" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="88" cy="58" r="4" fill="#e8182a" opacity="0.6"/>
      </g>
      <text class="gfy-anim-dead" x="14" y="24" font-size="9" fill="#ff453a">DEAD</text>
    </svg>`,
  narrowmouth: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      <g class="gfy-anim-kneel">${fishBody('f-nm', { mouth: 'grin' })}</g>
      <ellipse class="gfy-anim-narrow-mouth" cx="62" cy="52" rx="4" ry="2" fill="#1a2a5e"/>
      <g class="gfy-anim-thrust-blocked">
        <rect x="54" y="18" width="16" height="26" rx="8" fill="#ff6b2c"/>
        <circle cx="62" cy="16" r="7" fill="#ff6b2c"/>
        <text x="72" y="28" font-size="10" fill="#ff453a">✕</text>
      </g>
      <text class="gfy-anim-tap" x="8" y="78" font-size="8" fill="#64d2ff">won't open</text>
    </svg>`,
  fivestrokes: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-fs', { mouth: 'shock', eye: 'lazy' })}
      <g class="gfy-anim-five-stroke">
        <rect x="84" y="36" width="14" height="28" rx="7" fill="#ff6b2c"/>
        <circle cx="91" cy="34" r="7" fill="#ff6b2c"/>
        <ellipse cx="88" cy="50" rx="16" ry="10" fill="#ffb347" class="gfy-anim-tired-hand"/>
      </g>
      <text class="gfy-anim-stroke-count" x="72" y="28" font-size="16" font-weight="800" fill="#ff453a">5</text>
      <text x="68" y="78" font-size="8" fill="#ff453a">exhausted</text>
    </svg>`,
  swallow: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-sw', { mouth: 'o' })}
      <ellipse class="gfy-anim-gulp" cx="62" cy="52" rx="10" ry="6" fill="#ff6b2c" opacity="0.35"/>
      <path class="gfy-anim-drip" d="M68 58 Q72 72 76 58" stroke="#64d2ff" stroke-width="3" fill="none"/>
      <ellipse class="gfy-anim-drip2" cx="72" cy="74" rx="4" ry="6" fill="#64d2ff"/>
      <text class="gfy-anim-gulp-text" x="74" y="66" font-size="9" fill="#64d2ff">Kunal's</text>
    </svg>`,
  facefuck: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      <g class="gfy-anim-push">${fishBody('f-ff', { mouth: 'gag' })}</g>
      <rect class="gfy-anim-shaft" x="8" y="38" width="28" height="12" rx="6" fill="#ff6b2c"/>
      <rect class="gfy-anim-hand" x="18" y="44" width="22" height="14" rx="6" fill="#ffb347"/>
      <text x="88" y="20" font-size="8" fill="#bf5af2">Kunal</text>
    </svg>`,
  doggyspank: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      <g class="gfy-anim-doggy-pose" transform="rotate(-25 62 56)">${fishBody('f-dg', { mouth: 'shock' })}</g>
      <ellipse cx="88" cy="48" rx="14" ry="10" fill="#ff453a" opacity="0.45" class="gfy-anim-spark"/>
      <g class="gfy-anim-slap">
        <ellipse cx="96" cy="40" rx="12" ry="8" fill="#ffb347"/>
        <text x="92" y="44" font-size="14" class="gfy-anim-smack">💥</text>
      </g>
      <text x="8" y="78" font-size="8" fill="#ffd60a">doggy</text>
    </svg>`,
  doggycum: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      <g class="gfy-anim-doggy-bounce" transform="rotate(-20 62 56)">${fishBody('f-dc', { mouth: 'shock', eye: 'x' })}</g>
      <text class="gfy-anim-timer" x="78" y="32" font-size="13" font-weight="800" fill="#e8182a">0:28</text>
      <g class="gfy-anim-splash">
        <circle cx="98" cy="24" r="3" fill="#64d2ff"/>
        <circle cx="104" cy="30" r="2" fill="#64d2ff"/>
        <circle cx="92" cy="28" r="2" fill="#64d2ff"/>
      </g>
      <text x="10" y="78" font-size="8" fill="#ff453a">too fast</text>
    </svg>`,
  losthole: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-lh', { mouth: 'shock', eye: 'lazy' })}
      <g class="gfy-anim-search">
        <circle cx="88" cy="44" r="14" fill="none" stroke="#64d2ff" stroke-width="2" stroke-dasharray="4 3"/>
        <path d="M98 54 L106 62" stroke="#64d2ff" stroke-width="2"/>
        <text x="82" y="48" font-size="10">?</text>
      </g>
      <text class="gfy-anim-lost-timer" x="8" y="24" font-size="11" font-weight="800" fill="#ffd60a">45:00</text>
      <text x="8" y="78" font-size="8" fill="#64d2ff">wrong hole</text>
    </svg>`,
  choke: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-ch', { mouth: 'shock' })}
      <ellipse class="gfy-anim-choke-neck" cx="62" cy="48" rx="14" ry="8" fill="#ff453a" opacity="0.35"/>
      <g class="gfy-anim-choke-hand">
        <ellipse cx="62" cy="46" rx="16" ry="10" fill="#ffb347" opacity="0.85"/>
        <path d="M48 46 Q62 38 76 46" stroke="#1a2a5e" stroke-width="2" fill="none"/>
      </g>
      <text class="gfy-anim-tap" x="84" y="40" font-size="11" fill="#64d2ff">TAP</text>
    </svg>`,
  cncpin: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      <g class="gfy-anim-struggle">${fishBody('f-cnc', { mouth: 'shock' })}</g>
      <rect class="gfy-anim-pin-l" x="14" y="38" width="18" height="10" rx="5" fill="#ffb347" opacity="0.9"/>
      <rect class="gfy-anim-pin-r" x="92" y="38" width="18" height="10" rx="5" fill="#ffb347" opacity="0.9"/>
      <text x="52" y="24" font-size="12">⛓️</text>
      <text class="gfy-anim-stop" x="38" y="78" font-size="9" fill="#bf5af2">stop / start</text>
    </svg>`,
  familydoor: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      <rect x="8" y="12" width="36" height="64" rx="4" fill="#8ecae6" opacity="0.5"/>
      <g class="gfy-anim-door">
        <rect x="10" y="14" width="14" height="60" rx="2" fill="#ffb347"/>
        <circle cx="20" cy="44" r="2" fill="#1a2a5e"/>
      </g>
      ${fishBody('f-fd', { mouth: 'shock' })}
      <text class="gfy-anim-dad" x="14" y="28" font-size="12">👨</text>
      <text x="58" y="78" font-size="8" fill="#ff453a">Kunal+Nandini</text>
    </svg>`,
  momfaint: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-mf', { mouth: 'grin' })}
      <g class="gfy-anim-faint">
        <text x="58" y="24" font-size="16">👩</text>
        <path d="M54 30 Q62 42 70 30" stroke="#ff453a" stroke-width="2" fill="none"/>
        <text x="52" y="52" font-size="9" fill="#ff453a">CNC?!</text>
      </g>
      <text x="72" y="72" font-size="14">😵</text>
    </svg>`,
  familyroast: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-fr', { mouth: 'grin' })}
      <g class="gfy-anim-roast">
        <text x="48" y="22" font-size="14">👨</text>
        <text x="72" y="22" font-size="14">👩</text>
        <text x="52" y="38" font-size="9" fill="#ff453a">horny</text>
      </g>
      <text x="58" y="58" font-size="10">K+N</text>
    </svg>`,
  default: `
    <svg viewBox="0 0 124 88" class="gfy-art-svg" aria-hidden="true">
      ${fishBody('f-def', { mouth: 'grin' })}
    </svg>`,
};

function cardFaceHtml(rank, { large = false } = {}) {
  const meta = rankMeta(rank);
  const cat = categoryMeta(meta.category);
  const sizeCls = large ? ' gfy-card-face--lg' : '';
  const line = meta.line || rank;
  const art = CARD_ART[meta.art] || CARD_ART.default;

  return `
    <article class="gfy-card-face gfy-card-official gfy-cat-${esc(cat.id)}${sizeCls}" aria-label="${esc(line)}" style="--cat-accent:${cat.accent}">
      <div class="gfy-card-inner">
        <span class="gfy-cat-badge" title="${esc(cat.label)}">${cat.emoji} ${esc(cat.short)}</span>
        <p class="gfy-oneliner">${esc(line)}</p>
        <div class="gfy-art gfy-art--${esc(meta.art || 'default')}">${art}</div>
      </div>
    </article>`;
}

/** Face-down opponent hand — plain white (table view from across) */
export function renderOpponentCardBack({ mini = false } = {}) {
  const sizeCls = mini ? ' gfy-card-back--mini' : '';
  return `<article class="gfy-card-back gfy-card-back--plain${sizeCls}" aria-hidden="true"></article>`;
}

/** Card back — matte black box of secrets (physical GFY deck) */
export function renderCardBack({ large = false, mini = false, deck = false } = {}) {
  const sizeCls = large ? ' gfy-card-back--lg' : mini || deck ? ' gfy-card-back--mini' : '';
  const deckCls = deck ? ' gfy-card-back--deck' : '';
  const est = large ? '<span class="gfy-back-est">EST. BAD DECISIONS</span>' : '';
  return `<article class="gfy-card-back gfy-card-back--official gfy-card-back--orange gfy-card-back--secrets${sizeCls}${deckCls}" aria-hidden="true">
    <div class="gfy-back-texture" aria-hidden="true"></div>
    <div class="gfy-back-stack" aria-hidden="true">
      <span class="gfy-back-line">GO</span>
      <span class="gfy-back-line gfy-back-line--cream">FUCK</span>
      <span class="gfy-back-line">YOURSELF</span>
    </div>
    ${est}
    <div class="gfy-back-icons" aria-hidden="true"><span>🍹</span><span>💀</span><span>🦖</span><span>🚩</span></div>
  </article>`;
}

export function renderPhysicalDeck(count) {
  if (!count) return '<div class="deck-empty">Pond dry</div>';
  const layers = Math.min(7, Math.max(4, Math.ceil(Math.log2(count + 2))));
  let html = '';
  for (let i = 0; i < layers; i++) {
    const rot = -14 + i * 4 + (i % 2 ? 3 : -2);
    const tx = (i % 3) * 3 - 3 + (i * 1.2);
    const ty = -i * 2 + (i % 2);
    html += `<div class="deck-layer" style="transform:translate(${tx}px, ${ty}px) rotate(${rot}deg)">${renderCardBack({ deck: true })}</div>`;
  }
  return html;
}

export function renderOpponentHandVisual(count, { maxShow = 5 } = {}) {
  if (!count) return '<div class="opp-hand-empty">—</div>';
  const show = Math.min(count, maxShow);
  let html = '<div class="opp-hand-fan">';
  const mid = (show - 1) / 2;
  for (let i = 0; i < show; i++) {
    const rot = show > 1 && mid ? ((i - mid) / mid) * 18 : 0;
    html += `<span class="opp-mini-slot" style="--opp-rot:${rot}deg;--opp-i:${i}">${renderOpponentCardBack({ mini: true })}</span>`;
  }
  html += '</div>';
  return html;
}

export function stackLayout(index, total) {
  if (total <= 1) return { rot: 0, arc: 0, overlap: 0, stackY: 0, z: 1 };
  const step = 5;
  const mid = (total - 1) / 2;
  const rot = mid ? ((index - mid) / mid) * 2.5 : 0;
  return { rot, arc: 0, overlap: -4, stackY: index * step, z: index + 1 };
}

export function setProgressBlocks(count, total = 4) {
  return Array.from({ length: total }, (_, i) =>
    `<span class="set-block${i < count ? ' filled' : ''}" aria-hidden="true"></span>`,
  ).join('');
}

export function setProgressLabel(count, total = 4) {
  const need = Math.max(0, total - count);
  if (count >= total) return 'Complete!';
  if (need === 1) return 'Need 1 more';
  return `Need ${need} more`;
}

export function fanLayout(index, total) {
  if (total <= 1) return { rot: 0, arc: 0, overlap: 0, z: 1 };
  const mid = (total - 1) / 2;
  const t = total > 9 ? 9 / total : 1;
  const maxRot = total <= 4 ? 14 : total <= 6 ? 20 : total <= 9 ? 26 : 30;
  const rot = mid ? ((index - mid) / mid) * maxRot * t : 0;
  const arc = Math.abs(index - mid) * (total > 6 ? 2.8 : 3.5);
  const overlap = total > 10 ? -50 : total > 8 ? -46 : total > 5 ? -42 : -38;
  return { rot, arc, overlap, z: index + 1 };
}

export const HAND_CARD_W = 108;
export const HAND_CARD_H = 132;

export function computeSuggestedAsk(hand, askableRanks = []) {
  if (!askableRanks?.length) return null;
  const counts = new Map();
  for (const c of hand) {
    if (c.rank) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  }
  let best = null;
  let bestScore = -1;
  for (const rank of askableRanks) {
    const count = counts.get(rank) || 0;
    let score = count * 100 + (count === 3 ? 500 : count === 2 ? 200 : 0);
    if (score > bestScore) {
      bestScore = score;
      const meta = rankMeta(rank);
      best = {
        rank,
        count,
        meta,
        category: meta.category,
        probability: count >= 3 ? 'High' : count >= 2 ? 'Medium' : 'Low',
      };
    }
  }
  return best;
}

function stackArtHtmlForRank(rank) {
  const meta = rankMeta(rank);
  const art = CARD_ART[meta.art] || CARD_ART.default;
  return `<div class="card-stack__art">${art}</div>`;
}

function buildRankCardElement(rank, cards, opts = {}) {
  const model = CardStackModel.fromRank(rank, cards);
  const shelf = !!opts.shelf;
  const handStrip = !!opts.handStrip;
  const el = buildCardStackView(model, {
    ...opts,
    shelf,
    handStrip,
    compact: shelf && !handStrip ? false : (opts.compact ?? true),
    artHtml: shelf && !handStrip ? stackArtHtmlForRank(rank) : undefined,
  });

  if (opts.playable && !opts.filtered) {
    el.dataset.dragAsk = '1';
    bindHandStackFocus(el, rank, {
      playable: true,
      onPreview: opts.onPreview
        ? () => opts.onPreview(cards[cards.length - 1], el)
        : null,
    });
  } else {
    wireTap(el, (e) => {
      e?.stopPropagation?.();
      if (opts.onPreview) opts.onPreview(cards[cards.length - 1], el);
    });
  }

  return el;
}

/** Arc fan hand — Hearthstone / Balatro style (production hand layout). */
export function buildHandArc(hand, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'hand-shelf-scroller hand-shelf-scroller--arc';

  const rankMap = new Map();
  for (const c of hand) {
    if (!c.rank) continue;
    if (!rankMap.has(c.rank)) rankMap.set(c.rank, []);
    rankMap.get(c.rank).push(c);
  }
  const groups = [...rankMap.entries()]
    .map(([rank, cards]) => ({ rank, cards, count: cards.length }))
    .sort((a, b) => b.count - a.count || a.rank.localeCompare(b.rank));

  if (!groups.length) {
    wrap.innerHTML = '<div class="empty-hand">Drawing from the fuck pond…</div>';
    return wrap;
  }

  const shelf = document.createElement('div');
  shelf.className = 'hand-shelf hand-shelf--arc';
  shelf.setAttribute('aria-label', 'Your cards — tap to select, then Ask');

  const suggestedRank = opts.suggested?.rank;
  const focusedRank = opts.focusedRank;
  const total = groups.length;
  const cardW = HAND_CARD_W;
  const cardH = HAND_CARD_H;

  groups.forEach(({ rank, cards }, index) => {
    const canAsk = opts.playable && opts.askableRanks?.includes(rank);
    const stack = buildRankCardElement(rank, cards, {
      shelf: true,
      handStrip: true,
      playable: canAsk,
      filtered: false,
      suggested: rank === suggestedRank,
      onAsk: opts.onAsk,
      onPreview: opts.onPreview,
    });
    const { rot, arc, overlap, z } = fanLayout(index, total);
    const lift = rank === focusedRank ? -20 : rank === suggestedRank ? -10 : 0;
    stack.style.setProperty('--stack-w', `${cardW}px`);
    stack.style.setProperty('--stack-h', `${cardH}px`);
    stack.style.setProperty('--fan-rot', `${rot}deg`);
    stack.style.setProperty('--fan-arc', `${arc}px`);
    stack.style.setProperty('--fan-overlap', `${overlap}px`);
    stack.style.setProperty('--fan-lift', `${lift}px`);
    stack.style.zIndex = String(z);
    stack.style.marginLeft = index === 0 ? '0' : `${overlap}px`;
    if (rank === suggestedRank) stack.dataset.suggested = '1';
    if (rank === focusedRank) stack.classList.add('card-stack--focused');
    shelf.appendChild(stack);
  });
  shelf.dataset.handCount = String(total);
  wrap.appendChild(shelf);
  return wrap;
}

export function buildActiveCardElement(rank) {
  const wrap = document.createElement('div');
  wrap.className = 'active-card-inner';
  wrap.innerHTML = cardFaceHtml(rank, { large: true });
  return wrap;
}

export function animateCardSelect(el, selected) {
  const dur = motionScale(selected ? DUR.select : DUR.select * 0.85);
  gsap.to(el, {
    y: selected ? -14 : 0,
    scale: selected ? 1.03 : 1,
    rotate: selected ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0,
    duration: dur,
    ease: motionEase(EASE_SETTLE, 'power2.out'),
    force3D: true,
    overwrite: 'auto',
  });
  if (selected) {
    CardAudio.flip();
    haptic('selection');
  }
}

export function animateCardToCenter(fromEl, toEl) {
  if (!fromEl || !toEl) return Promise.resolve();
  const { ghost, from } = createTransformGhost(fromEl, { className: 'gfy-card-ghost' });
  CardAudio.flip();
  return new Promise((resolve) => {
    const tl = timelineCardTravel(ghost, from, toEl, {
      liftY: -8,
      onLand: () => {
        pulseCardLand(toEl);
        haptic('light');
      },
    });
    tl.eventCallback('onComplete', () => { ghost.remove(); resolve(); });
  });
}

export function animateDeckWiggle() {
  const deck = document.getElementById('deck-pile-wrap');
  if (!deck) return;
  deck.classList.remove('wiggle');
  void deck.offsetWidth;
  deck.classList.add('wiggle');
  CardAudio.flip();
}

export function animateDrawToHand(deckEl, handEl) {
  if (!deckEl || !handEl) return;
  animateDeckWiggle();
  const from = deckEl.getBoundingClientRect();
  const cardW = 60;
  const cardH = 84;
  const ghost = document.createElement('div');
  ghost.className = 'gfy-card-ghost draw-ghost';
  ghost.innerHTML = renderCardBack();
  ghost.style.cssText = `position:fixed;left:0;top:0;width:${cardW}px;height:${cardH}px;pointer-events:none`;
  document.body.appendChild(ghost);
  const startX = from.left + from.width / 2 - cardW / 2;
  const endY = handEl.getBoundingClientRect().bottom - 90;
  const endX = handEl.getBoundingClientRect().left + handEl.getBoundingClientRect().width / 2 - cardW / 2;
  gsap.set(ghost, { x: startX, y: from.top, force3D: true });
  const tl = gsap.timeline({ onComplete: () => { ghost.remove(); CardAudio.flip(); haptic('light'); } });
  const tLift = motionScale(0.1);
  const tTravel = motionScale(0.2);
  tl.to(ghost, { y: `-=${12}`, rotate: -5, duration: tLift, ease: 'power2.out' }, 0);
  tl.to(ghost, { x: endX, y: endY, rotate: 10, duration: tTravel, ease: 'power4.in' }, tLift);
  tl.to(ghost, { rotate: 0, scale: 1.02, duration: motionScale(0.14), ease: motionEase(EASE_SETTLE) }, tLift + tTravel);
  tl.to(ghost, { opacity: 0, scale: 1, duration: 0.07 }, '-=0.02');
}

/** Animate ×N count bump when receiving a matching card */
export function animateHandCountBump(rank, newCount) {
  const group = document.querySelector(`.card-stack[data-rank="${rank}"], .hand-rank-card[data-rank="${rank}"]`);
  if (!group) return;
  CardStackAnimator.receive(group, newCount);

  const blocks = group.querySelectorAll('.set-block');
  const block = blocks[newCount - 1];
  if (block && !block.classList.contains('filled')) {
    block.classList.add('filled', 'set-block--just-filled');
    setTimeout(() => block.classList.remove('set-block--just-filled'), 700);
  }

  group.dataset.count = String(newCount);
  group.classList.toggle('hand-topic-group--almost', newCount === 3);
  group.classList.toggle('hand-topic-group--complete', newCount >= 4);
  group.classList.toggle('card-stack--ready', newCount >= 4);
  group.classList.toggle('hand-rank-card--suggested', newCount >= 3);

  if (newCount > 0) {
    group.classList.add('collection-progress-pulse');
    setTimeout(() => group.classList.remove('collection-progress-pulse'), 800);
  }
}

export function animateCardLand(el) {
  pulseCardLand(el);
}

export function playGameMoment(title, subtitle = '', { variant = 'gfy', ms = 2400 } = {}) {
  CardAudio.resume();
  if (variant === 'gfy') {
    CardAudio.slam();
    CardAudio.bass();
  } else {
    CardAudio.flip();
  }

  let overlay = document.getElementById('gfy-moment');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gfy-moment';
    overlay.className = 'gfy-moment';
    overlay.innerHTML = `
      <div class="gfy-moment-inner">
        <div class="gfy-moment-title"></div>
        <div class="gfy-moment-sub"></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  overlay.className = `gfy-moment gfy-moment--${variant}`;
  overlay.querySelector('.gfy-moment-title').innerHTML = String(title).replace(/\n/g, '<br>');
  overlay.querySelector('.gfy-moment-sub').textContent = subtitle;
  overlay.classList.add('show');

  gsap.fromTo(
    overlay.querySelector('.gfy-moment-title'),
    { scale: 1.5, opacity: 0, rotate: variant === 'gfy' ? -3 : 0 },
    { scale: 1, opacity: 1, rotate: 0, duration: 0.42, ease: 'back.out(1.5)' }
  );

  if (variant === 'gfy') {
    gsap.fromTo(
      '#screen-game .game-table',
      { x: 0 },
      {
        x: '+=6',
        duration: 0.04,
        repeat: 4,
        yoyo: true,
        ease: 'none',
        onComplete: () => gsap.set('#screen-game .game-table', { x: 0 }),
      }
    );
    if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 80]);
  } else if (navigator.vibrate) {
    navigator.vibrate([20, 40, 20]);
  }

  clearTimeout(playGameMoment._t);
  playGameMoment._t = setTimeout(() => overlay.classList.remove('show'), ms);
}

export function playGfyMoment(subtitle = '') {
  playGameMoment('GO FUCK<br>YOURSELF', subtitle, { variant: 'gfy' });
}

export { CardAudio, RANKS };
