/**
 * GFY Card Stack System — physical stacks, set completion, collection shelf.
 * CardStackModel · CardStackView · SetCompletionView · CollectionShelfView · CardStackAnimator
 */
import gsap from '/vendor/gsap/index.js';
import { rankMeta, categoryMeta } from './game.js?v=63';
import { haptic } from './mobile.js';
import {
  createTransformGhost,
  motionEase,
  motionScale,
  EASE_SETTLE,
  prefersReducedMotion,
} from './motion.js?v=1';

function burstParticles(x, y, { count = 12, color = '#ffd60a', spread = 40 } = {}) {
  let layer = document.getElementById('fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    layer.className = 'fx-layer';
    document.body.appendChild(layer);
  }
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-particle';
    p.style.background = color;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    layer.appendChild(p);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = spread * (0.4 + Math.random() * 0.6);
    gsap.to(p, {
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist - 16,
      opacity: 0,
      scale: 0,
      duration: 0.5 + Math.random() * 0.2,
      ease: 'power2.out',
      onComplete: () => p.remove(),
    });
  }
}

const SET_SIZE = 4;

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* ── CardStackModel ── */
export const CardStackModel = {
  SET_SIZE,
  tier(count) {
    if (count >= 4) return 'complete';
    if (count === 3) return 'hot';
    if (count === 2) return 'warm';
    return 'cold';
  },
  visibleLayers(count) {
    return Math.min(Math.max(count, 0), SET_SIZE);
  },
  progressBlocks(count) {
    return Array.from({ length: SET_SIZE }, (_, i) =>
      `<span class="card-stack__pip${i < count ? ' filled' : ''}" aria-hidden="true"></span>`,
    ).join('');
  },
  pipsText(count) {
    return '■'.repeat(count) + '□'.repeat(SET_SIZE - count);
  },
  fromRank(rank, cards = []) {
    const meta = rankMeta(rank);
    const cat = categoryMeta(meta.category);
    const count = cards.length;
    return { rank, meta, cat, count, cards, tier: CardStackModel.tier(count) };
  },
};

/* ── CardStackView ── */
export function buildCardStackLayers(count, { shelf = false } = {}) {
  const n = CardStackModel.visibleLayers(count);
  if (!n) return '';
  let html = `<div class="card-stack__layers${shelf ? ' card-stack__layers--shelf' : ''}" aria-hidden="true">`;
  for (let i = 0; i < n; i++) {
    html += `<span class="card-stack__layer" style="--layer-i:${i};--layer-n:${n}"></span>`;
  }
  html += '</div>';
  return html;
}

/** Word-wrap for shelf titles — never truncate with ellipsis */
function formatStackTitle(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['—'];
  const lines = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    const joined = cur.join(' ');
    if (joined.length > 22 || cur.length >= 4) {
      lines.push(joined);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur.join(' '));
  return lines;
}

/** Hand carousel — at most two short lines, readable at ~108px card width */
function formatHandTitle(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['—'];
  const lines = [];
  let cur = [];
  const flush = () => {
    if (cur.length) {
      lines.push(cur.join(' '));
      cur = [];
    }
  };
  for (const w of words) {
    const next = [...cur, w].join(' ');
    if (next.length > 16 && cur.length) flush();
    cur.push(w);
    if (cur.join(' ').length > 18) flush();
    if (lines.length >= 2) break;
  }
  flush();
  if (lines.length > 2) return lines.slice(0, 2);
  if (lines.length === 2 && lines[1].length > 18) {
    return [lines[0], `${lines[1].slice(0, 16)}…`];
  }
  return lines.length ? lines : ['—'];
}

function copyLabel(count) {
  if (count === 1) return '1 COPY';
  return `${count} COPIES`;
}

export function buildCardStackView(model, opts = {}) {
  const { rank, meta, cat, count } = model;
  const playable = !!opts.playable && !opts.filtered;
  const tier = CardStackModel.tier(count);
  const shelf = !!opts.shelf;
  const handStrip = !!opts.handStrip && shelf;

  const el = document.createElement('article');
  el.className = [
    'card-stack',
    'hand-rank-card',
    'hand-topic-group',
    `card-stack--${tier}`,
    shelf ? 'card-stack--shelf' : '',
    handStrip ? 'card-stack--hand' : '',
    count >= 4 ? 'card-stack--ready hand-topic-group--complete' : '',
    count === 3 ? 'hand-topic-group--almost' : '',
    playable ? 'card-stack--askable hand-rank-card--askable hand-topic-group--askable' : '',
    opts.suggested ? 'card-stack--suggested hand-rank-card--suggested' : '',
    opts.filtered ? 'cat-filtered-out' : '',
  ].filter(Boolean).join(' ');
  el.dataset.rank = rank;
  el.dataset.count = String(count);
  el.dataset.category = cat.id;
  const compact = !!opts.compact && !shelf;
  if (compact) el.classList.add('card-stack--compact');
  el.style.setProperty('--cat-accent', cat.accent);
  el.style.setProperty('--stack-count', String(count));

  if (handStrip) {
    const titleLines = formatHandTitle(meta.line);
    el.dataset.titleLines = String(titleLines.length);
    const titleHtml = titleLines.map((ln) => `<span class="card-stack__title-line">${esc(ln)}</span>`).join('');
    const stackHint = count > 1
      ? `<span class="card-stack__stack-badge" aria-hidden="true">×${count}</span>`
      : '';

    el.innerHTML = `
      <div class="card-stack__shadow" aria-hidden="true"></div>
      <div class="card-stack__face card-stack__face--hand">
        <header class="card-stack__head">
          <span class="card-stack__category card-stack__category--text">${esc(cat.short.toUpperCase())}</span>
          ${playable ? '<span class="card-stack__tap-hint">DRAG ↑</span>' : ''}
        </header>
        <h3 class="card-stack__title card-stack__title--hand">${titleHtml}</h3>
        <footer class="card-stack__foot card-stack__foot--hand">
          <div class="card-stack__pips" aria-label="${count} of ${SET_SIZE}">${CardStackModel.progressBlocks(count)}</div>
          <span class="card-stack__ratio"><strong>${count}</strong>/${SET_SIZE}</span>
        </footer>
        ${stackHint}
        ${opts.suggested ? '<span class="card-stack__pick-ribbon" aria-hidden="true">ASK</span>' : ''}
        ${count >= 4 ? '<span class="card-stack__ready-ribbon card-stack__ready-ribbon--hand" aria-hidden="true">SET</span>' : ''}
      </div>`;
  } else if (shelf) {
    const titleLines = formatStackTitle(meta.line);
    el.dataset.titleLines = String(titleLines.length);
    const titleHtml = titleLines.map((ln) => `<span class="card-stack__title-line">${esc(ln)}</span>`).join('');
    const artHtml = opts.artHtml || `<span class="card-stack__icon card-stack__icon--art">${cat.emoji}</span>`;

    el.innerHTML = `
      <div class="card-stack__shadow" aria-hidden="true"></div>
      ${buildCardStackLayers(count, { shelf: true })}
      <div class="card-stack__face card-stack__face--shelf">
        <header class="card-stack__head">
          <span class="card-stack__category">${cat.emoji} ${esc(cat.short.toUpperCase())}</span>
        </header>
        <h3 class="card-stack__title">${titleHtml}</h3>
        <div class="card-stack__art-slot">${artHtml}</div>
        <footer class="card-stack__foot card-stack__foot--shelf">
          <span class="card-stack__count">${copyLabel(count)}</span>
          <span class="card-stack__multiply" aria-hidden="true">×${count}</span>
        </footer>
        ${count >= 4 ? '<div class="card-stack__ready-ribbon" aria-hidden="true">🔥 SET READY</div>' : ''}
      </div>
      ${count >= 4 ? '<div class="card-stack__glow" aria-hidden="true"></div>' : ''}`;
  } else {
    const scenario = meta.line;

    el.innerHTML = `
      <div class="card-stack__shadow" aria-hidden="true"></div>
      ${buildCardStackLayers(count)}
      <div class="card-stack__face">
        ${compact ? '' : `<header class="card-stack__head">
          <span class="card-stack__category">${esc(cat.short.toUpperCase())}</span>
          ${count >= 4 ? '<span class="card-stack__badge">SET READY</span>' : ''}
        </header>`}
        ${compact && count >= 4 ? '<span class="card-stack__badge card-stack__badge--solo">SET</span>' : ''}
        <div class="card-stack__icon" aria-hidden="true">${cat.emoji}</div>
        <p class="card-stack__scenario">${esc(scenario)}</p>
        <footer class="card-stack__foot">
          ${compact
      ? `<span class="card-stack__ratio card-stack__ratio--solo"><strong>${count}</strong></span>`
      : `<div class="card-stack__pips" aria-label="${count} of ${SET_SIZE}">${CardStackModel.progressBlocks(count)}</div>
          <span class="card-stack__ratio"><strong>${count}</strong> / ${SET_SIZE}</span>`}
        </footer>
      </div>
      ${count >= 4 ? '<div class="card-stack__glow" aria-hidden="true"></div>' : ''}`;
  }

  const label = count >= 4
    ? `${cat.short} set ready — create set`
    : playable
      ? `Ask for ${meta.line}, ${count} of ${SET_SIZE}`
      : `View ${meta.line}, ${count} owned`;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', label);

  return el;
}

/* ── Collection progress — category stacks (■■■□ 3/4) ── */
export function buildCollectionProgressFromSections(sections = []) {
  if (!sections.length) return '';
  const progressTiles = sections.map((section) => {
    const cat = categoryMeta(section.catId);
    const ready = section.maxCount >= 4;
    const pips = CardStackModel.progressBlocks(section.maxCount);
    return `<div class="collection-progress-tile${ready ? ' collection-progress-tile--ready' : ''}" data-category="${esc(section.catId)}">
      <span class="collection-progress-tile__cat">${cat.emoji} ${esc(cat.short.toUpperCase())}</span>
      <div class="collection-progress-tile__pips" aria-label="${section.maxCount} of ${SET_SIZE}">${pips}</div>
      <span class="collection-progress-tile__ratio">${section.maxCount}/${SET_SIZE}</span>
      ${ready ? '<span class="collection-progress-tile__cta">CREATE SET</span>' : ''}
    </div>`;
  }).join('');

  return `<div class="collection-shelf__head">
      <span class="collection-shelf__title">Your Collections</span>
    </div>
    <div class="collection-shelf__scroll collection-shelf__scroll--progress">${progressTiles}</div>`;
}

/** Completed sets shelf (legacy) */
export function buildCollectionShelfView(books = [], { totalSets = 10 } = {}) {
  if (!books.length) return '';
  const tiles = books.map((rank) => {
    const meta = rankMeta(rank);
    const cat = categoryMeta(meta.category);
    const line = meta.line.length > 22 ? `${meta.line.slice(0, 20)}…` : meta.line;
    return `<div class="collection-shelf__tile collection-shelf__tile--${cat.id}" style="--cat-accent:${cat.accent}" data-rank="${esc(rank)}" title="${esc(meta.line)}">
      <span class="collection-shelf__tile-cat">${cat.emoji} ${esc(cat.short)}</span>
      <span class="collection-shelf__tile-line">${esc(line)}</span>
      <span class="collection-shelf__tile-done">Completed</span>
    </div>`;
  }).join('');
  return `<div class="collection-shelf" aria-label="Completed sets">
    <div class="collection-shelf__head">
      <span class="collection-shelf__title">Collection</span>
      <span class="collection-shelf__count">${books.length}/${totalSets}</span>
    </div>
    <div class="collection-shelf__scroll">${tiles}</div>
  </div>`;
}

/* ── SetCompletionView ── */
export function buildSetCompletionBanner(model) {
  const { meta, cat } = model;
  return `<div class="set-completion-banner" role="alert">
    <span class="set-completion-banner__spark" aria-hidden="true">✨</span>
    <div class="set-completion-banner__copy">
      <strong>Complete set available</strong>
      <span>${esc(cat.emoji)} ${esc(cat.short.toUpperCase())} · ${esc(meta.line)}</span>
    </div>
    <button type="button" class="set-completion-banner__cta" id="btn-set-ready">Create set</button>
  </div>`;
}

export function mountSetCompletionBanner(container, model, onCreate) {
  if (!container || !model) return null;
  container.innerHTML = buildSetCompletionBanner(model);
  container.classList.remove('hidden');
  const btn = container.querySelector('#btn-set-ready');
  btn?.addEventListener('click', () => {
    haptic('medium');
    onCreate?.();
  });
  if (!prefersReducedMotion()) {
    gsap.fromTo(container, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE_SETTLE });
  }
  return container;
}

/* ── CardStackAnimator ── */
export const CardStackAnimator = {
  bindIdle(root = document) {
    if (prefersReducedMotion()) return;
    root.querySelectorAll('.card-stack:not(.card-stack--bound)').forEach((el, i) => {
      el.classList.add('card-stack--bound');
      gsap.to(el, {
        y: '+=3',
        rotate: `+=${(i % 2 ? 0.6 : -0.6)}`,
        duration: 2.2 + (i % 3) * 0.3,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    });
  },

  lift(el, on = true) {
    if (!el) return;
    gsap.to(el, {
      y: on ? -10 : 0,
      scale: on ? 1.04 : 1,
      duration: motionScale(0.22),
      ease: motionEase(EASE_SETTLE),
      overwrite: 'auto',
    });
  },

  receive(el, newCount) {
    if (!el) return;
    el.dataset.count = String(newCount);
    el.style.setProperty('--stack-count', String(newCount));
    el.classList.remove('card-stack--cold', 'card-stack--warm', 'card-stack--hot', 'card-stack--complete');
    el.classList.add(`card-stack--${CardStackModel.tier(newCount)}`);
    if (newCount >= 4) el.classList.add('card-stack--ready');

    const layers = el.querySelector('.card-stack__layers');
    if (layers) {
      layers.outerHTML = buildCardStackLayers(newCount, { shelf: el.classList.contains('card-stack--shelf') });
    }
    const ratio = el.querySelector('.card-stack__multiply');
    if (ratio) ratio.textContent = `×${newCount}`;
    const countEl = el.querySelector('.card-stack__count');
    if (countEl) countEl.textContent = copyLabel(newCount);

    gsap.fromTo(el, { scale: 0.92 }, {
      scale: 1,
      duration: motionScale(0.38),
      ease: motionEase(EASE_SETTLE),
      onComplete: () => haptic(newCount >= 4 ? 'success' : 'light'),
    });
    if (newCount >= 4) {
      el.classList.add('card-stack--ready');
      gsap.fromTo(el, { rotate: 0 }, { rotate: -2, duration: 0.08, yoyo: true, repeat: 5 });
      if (el.classList.contains('card-stack--shelf') && !el.querySelector('.card-stack__ready-ribbon')) {
        const face = el.querySelector('.card-stack__face');
        if (face) {
          const ribbon = document.createElement('div');
          ribbon.className = 'card-stack__ready-ribbon';
          ribbon.setAttribute('aria-hidden', 'true');
          ribbon.textContent = '🔥 SET READY';
          face.appendChild(ribbon);
        }
        if (!el.querySelector('.card-stack__glow')) {
          const glow = document.createElement('div');
          glow.className = 'card-stack__glow';
          glow.setAttribute('aria-hidden', 'true');
          el.appendChild(glow);
        }
      }
    }
    if (newCount >= 4) {
      burstParticles(
        el.getBoundingClientRect().left + el.offsetWidth / 2,
        el.getBoundingClientRect().top + 20,
        { count: 14, color: '#ffd60a', spread: 36 },
      );
    }
  },

  async createSetSequence(stackEl, shelfEl, rank) {
    if (!stackEl) return;
    const meta = rankMeta(rank);
    const cat = categoryMeta(meta.category);
    haptic('heavy');

    if (prefersReducedMotion()) {
      stackEl.remove();
      return;
    }

    const { ghost } = createTransformGhost(stackEl, {
      className: 'card-stack card-stack--ghost',
      clone: true,
    });
    stackEl.style.visibility = 'hidden';

    const layers = ghost.querySelectorAll('.card-stack__layer');
    const tl = gsap.timeline({
      onComplete: () => {
        ghost.remove();
        stackEl.remove();
      },
    });

    tl.to(ghost, { y: -24, scale: 1.08, duration: 0.28, ease: 'power2.out' });
    tl.to(layers, {
      x: (i) => (i - 1.5) * 18,
      rotate: (i) => (i - 1.5) * 8,
      duration: 0.32,
      ease: EASE_SETTLE,
      stagger: 0.04,
    }, '-=0.08');
    tl.to(layers, {
      x: 0,
      rotate: 0,
      scale: 0.4,
      opacity: 0,
      duration: 0.28,
      ease: 'power2.in',
      stagger: 0.03,
    }, '+=0.12');

    if (shelfEl) {
      const shelfRect = shelfEl.getBoundingClientRect();
      tl.to(ghost, {
        x: shelfRect.left + shelfRect.width / 2 - rect.left - rect.width / 2,
        y: shelfRect.top - rect.top,
        scale: 0.35,
        opacity: 0,
        duration: 0.35,
        ease: 'power3.in',
      }, '-=0.1');
    }

    burstParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 22,
      color: cat.accent || '#ff6b2c',
      spread: 52,
    });

    await tl;
  },
};

export function bindStackDeck(deck) {
  if (!deck || deck.dataset.deckBound) return;
  deck.dataset.deckBound = '1';

  const stacks = () => [...deck.querySelectorAll('.card-stack')];

  const clearFocus = () => stacks().forEach((s) => s.classList.remove('is-focus'));

  deck.addEventListener('mouseenter', () => deck.classList.add('is-fanned'));
  deck.addEventListener('mouseleave', () => {
    deck.classList.remove('is-fanned');
    clearFocus();
  });

  stacks().forEach((stack) => {
    stack.addEventListener('mouseenter', () => {
      clearFocus();
      stack.classList.add('is-focus');
      deck.classList.add('is-fanned');
    });
  });
}

export function bindAllStackDecks(root = document) {
  root.querySelectorAll('.stack-deck').forEach((deck) => {
    refreshStackDeckIndices(deck);
    bindStackDeck(deck);
  });
}

export function refreshStackDeckIndices(deck) {
  const stacks = [...deck.querySelectorAll('.card-stack')];
  const n = stacks.length;
  stacks.forEach((stack, i) => {
    stack.style.setProperty('--deck-i', String(i));
    stack.style.setProperty('--deck-n', String(n));
  });
}

export function stackSelector(rank) {
  return `.card-stack[data-rank="${rank}"], .hand-rank-card[data-rank="${rank}"]`;
}
