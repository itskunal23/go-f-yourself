// Native iOS touch — game scroll lock, hand carousels, tap discrimination, snap haptics.
import { haptic, isIOS } from './mobile.js';

export const isTouchDevice =
  isIOS ||
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
  navigator.maxTouchPoints > 0;

let scrollLockDepth = 0;
let savedScrollY = 0;

/** Prevent document rubber-banding while the game table is active. */
export function setGameScrollLock(on) {
  const body = document.body;
  const html = document.documentElement;
  if (on) {
    if (scrollLockDepth === 0) {
      savedScrollY = window.scrollY;
      body.classList.add('game-active');
      html.classList.add('game-active');
      body.style.top = savedScrollY ? `-${savedScrollY}px` : '';
    }
    scrollLockDepth += 1;
    return;
  }
  scrollLockDepth = Math.max(0, scrollLockDepth - 1);
  if (scrollLockDepth > 0) return;
  body.classList.remove('game-active');
  html.classList.remove('game-active');
  body.style.top = '';
  window.scrollTo(0, savedScrollY);
}

/** Ignore accidental activation when the finger moved (scroll vs tap). */
export function wireTap(el, onTap, { maxMove = 14 } = {}) {
  if (!el || el.dataset.tapBound) return;
  el.dataset.tapBound = '1';
  let sx = 0;
  let sy = 0;
  let moved = false;
  let pid = null;

  const down = (e) => {
    if (e.button > 0) return;
    sx = e.clientX;
    sy = e.clientY;
    moved = false;
    pid = e.pointerId;
    el.classList.add('is-pressed');
    try { el.setPointerCapture(pid); } catch { /* noop */ }
  };

  const move = (e) => {
    if (e.pointerId !== pid) return;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > maxMove) moved = true;
  };

  const end = (e) => {
    if (e.pointerId !== pid) return;
    el.classList.remove('is-pressed');
    try { el.releasePointerCapture(pid); } catch { /* noop */ }
    pid = null;
    if (!moved) onTap(e);
  };

  const cancel = () => {
    el.classList.remove('is-pressed');
    pid = null;
    moved = true;
  };

  el.addEventListener('pointerdown', down, { passive: true });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', cancel);
}

export function nearestSnapChild(container, selector) {
  const items = [...container.querySelectorAll(selector)];
  if (!items.length) return null;
  const cr = container.getBoundingClientRect();
  const mid = cr.left + cr.width / 2;
  let best = items[0];
  let bestDist = Infinity;
  for (const item of items) {
    const r = item.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - mid);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

function bindSnapHaptics(scroller, itemSelector) {
  if (!scroller || scroller.dataset.snapHaptic) return;
  scroller.dataset.snapHaptic = '1';
  let lastKey = '';
  let timer = null;

  const onScrollEnd = () => {
    const hit = nearestSnapChild(scroller, itemSelector);
    const key = hit?.dataset?.rank || hit?.dataset?.category || hit?.id || '';
    if (key && key !== lastKey) {
      lastKey = key;
      haptic('selection');
    }
    if (itemSelector.includes('card-stack')) markCenteredDragStack(scroller);
  };

  scroller.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(onScrollEnd, 90);
  }, { passive: true });

  if ('onscrollend' in scroller) {
    scroller.addEventListener('scrollend', onScrollEnd, { passive: true });
  }
}

function ensureCarouselDots(handWrap, scroller) {
  const sections = scroller.querySelectorAll('.hand-collection-section');
  if (sections.length < 2) {
    handWrap.querySelector('.hand-carousel-dots')?.remove();
    return;
  }
  let dots = handWrap.querySelector('.hand-carousel-dots');
  if (!dots) {
    dots = document.createElement('div');
    dots.className = 'hand-carousel-dots';
    dots.setAttribute('aria-hidden', 'true');
    handWrap.appendChild(dots);
  }
  dots.innerHTML = '';
  sections.forEach((sec, i) => {
    const d = document.createElement('span');
    d.className = 'hand-carousel-dot';
    d.dataset.index = String(i);
    dots.appendChild(d);
  });

  const updateDots = () => {
    const hit = nearestSnapChild(scroller, '.hand-collection-section');
    const idx = hit ? [...sections].indexOf(hit) : 0;
    dots.querySelectorAll('.hand-carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  };

  scroller.addEventListener('scroll', () => {
    clearTimeout(dots._t);
    dots._t = setTimeout(updateDots, 60);
  }, { passive: true });
  updateDots();
}

/** Wire horizontal collection shelf scroll after hand render. */
export function refreshHandTouchUI(handWrap) {
  if (!handWrap || !isTouchDevice) return;
  const hand = handWrap.querySelector('#hand') || handWrap;
  const scroller = hand.querySelector('.hand-shelf-scroller') || hand.querySelector('.hand-shelf') || hand;
  if (!scroller) return;

  scroller.classList.remove('hand-carousel');
  handWrap.querySelector('.hand-carousel-dots')?.remove();

  if (
    scroller.classList.contains('hand-shelf-scroller--carousel')
    || scroller.classList.contains('hand-shelf-scroller--fan')
  ) {
    bindSnapHaptics(scroller, '.card-stack');
  }

  const suggested = scroller.querySelector('.card-stack--suggested, .card-stack--askable, .hand-rank-card--suggested, .hand-rank-card--askable');
  if (suggested) {
    requestAnimationFrame(() => {
      suggested.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }

  markCenteredDragStack(scroller);
}

/** Highlight the snap-centered stack (drag-to-ask source). */
export function markCenteredDragStack(scroller) {
  if (!scroller) return;
  scroller.querySelectorAll('.card-stack[data-drag-ask]').forEach((el) => {
    el.classList.remove('card-stack--centered');
  });
  const hit = nearestSnapChild(scroller, '.card-stack[data-drag-ask]');
  hit?.classList.add('card-stack--centered');
}

export function initGameTouchUI() {
  const game = document.getElementById('screen-game');
  if (!game) return;

  game.addEventListener('touchmove', (e) => {
    if (!game.classList.contains('active')) return;
    if (document.body.classList.contains('hand-drag-active')) return;
    const t = e.target;
    if (t.closest('.stack-deck, .hand-shelf, .hand-shelf-scroller, .hand-ask-next, .drawer-sheet, .card-expand-overlay')) return;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
  }, { passive: false });

  const table = game.querySelector('.game-table');
  table?.addEventListener('gesturestart', (e) => e.preventDefault());
}
