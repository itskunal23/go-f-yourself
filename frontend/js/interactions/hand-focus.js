/**
 * One-thumb hand interaction: tap card → focus → Ask CTA.
 * Drag-to-ask remains optional (advanced) via hand-drag-ask.
 */
import gsap from '/vendor/gsap/index.js';
import { haptic } from '../mobile.js';
import { animateCardSelect } from '../cards.js';
import { wireTap } from '../touch-ui.js';
import { reflowArcHand } from '../physics/card-motion.js';

let focusedRank = null;
let getContext = () => ({});

export function getFocusedRank() {
  return focusedRank;
}

export function setFocusedRank(rank, { silent = false } = {}) {
  const prev = focusedRank;
  focusedRank = rank || null;
  const hand = document.getElementById('hand');
  if (!hand) return;
  hand.querySelectorAll('.card-stack[data-rank]').forEach((el) => {
    const on = el.dataset.rank === focusedRank;
    el.classList.toggle('card-stack--focused', on);
    el.classList.toggle('card-stack--dimmed', !!focusedRank && !on);
    if (on || el.dataset.rank === prev) {
      animateCardSelect(el, on);
    }
  });
  const shelf = hand?.querySelector('.hand-shelf--arc');
  if (shelf) reflowArcHand(shelf, { focusedRank });
  if (!silent && focusedRank) haptic('selection');
  getContext().onFocusChange?.(focusedRank);
}

export function clearHandFocus() {
  setFocusedRank(null, { silent: true });
}

export function bindHandStackFocus(stack, rank, { playable, onPreview }) {
  if (!playable) {
    if (onPreview) wireTap(stack, (e) => { e?.stopPropagation?.(); onPreview(rank, stack); });
    return;
  }
  wireTap(stack, (e) => {
    e?.stopPropagation?.();
    if (focusedRank === rank) return;
    setFocusedRank(rank);
  });
}

export function initHandFocus(context = {}) {
  getContext = () => context;
  focusedRank = null;
}
