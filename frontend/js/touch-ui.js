// Native iOS touch — scroll lock, tap discrimination, snap haptics on arc hand.
import { haptic, isIOS } from './mobile.js';

export const isTouchDevice = isIOS || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

const TAP_MOVE_PX = 14;
const TAP_MS = 320;

export function wireTap(el, handler) {
  if (!el || typeof handler !== 'function') return;
  let sx = 0;
  let sy = 0;
  let t0 = 0;
  let moved = false;

  const down = (e) => {
    if (e.button > 0) return;
    sx = e.clientX;
    sy = e.clientY;
    t0 = performance.now();
    moved = false;
  };
  const move = (e) => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > TAP_MOVE_PX) moved = true;
  };
  const up = (e) => {
    if (e.button > 0) return;
    const dt = performance.now() - t0;
    if (!moved && dt < TAP_MS) handler(e);
  };

  el.addEventListener('pointerdown', down, { passive: true });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

export function nearestSnapChild(scroller, selector) {
  if (!scroller) return null;
  const children = [...scroller.querySelectorAll(selector)];
  if (!children.length) return null;
  const mid = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
  let best = null;
  let bestDist = Infinity;
  for (const el of children) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const d = Math.abs(cx - mid);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
}

function bindSnapHaptics(scroller, selector) {
  let last = null;
  scroller.addEventListener('scroll', () => {
    clearTimeout(scroller._snapT);
    scroller._snapT = setTimeout(() => {
      const hit = nearestSnapChild(scroller, selector);
      if (hit && hit !== last) {
        last = hit;
        haptic('selection');
      }
    }, 80);
  }, { passive: true });
}

export function refreshHandTouchUI(handWrap) {
  if (!handWrap || !isTouchDevice) return;
  const hand = handWrap.querySelector('#hand') || handWrap;
  const scroller = hand.querySelector('.hand-shelf-scroller--arc');
  if (!scroller) return;

  bindSnapHaptics(scroller, '.card-stack');

  const focused = scroller.querySelector('.card-stack--focused');
  const suggested = focused || scroller.querySelector('.card-stack[data-suggested="1"]');
  if (suggested) {
    requestAnimationFrame(() => {
      suggested.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }
}

export function initGameTouchUI() {
  const game = document.getElementById('screen-game');
  if (!game) return;

  game.addEventListener('touchmove', (e) => {
    if (!game.classList.contains('active')) return;
    if (document.body.classList.contains('hand-drag-active')) return;
    const t = e.target;
    if (t.closest('.hand-shelf, .hand-shelf-scroller, .hand-ask-next, .drawer-sheet, .card-expand-overlay')) return;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
  }, { passive: false });

  const table = game.querySelector('.game-table');
  table?.addEventListener('gesturestart', (e) => e.preventDefault());
}

let scrollLocked = false;

export function setGameScrollLock(on) {
  scrollLocked = !!on;
  document.documentElement.classList.toggle('game-scroll-lock', scrollLocked);
}
