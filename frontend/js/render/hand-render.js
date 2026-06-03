/**
 * Diffed hand rendering — avoids full innerHTML rebuild on every WS tick.
 */
import gsap from '/vendor/gsap/index.js';
import { buildHandArc, computeSuggestedAsk } from '../cards.js';
import { getFocusedRank, clearHandFocus, setFocusedRank } from '../interactions/hand-focus.js';

let lastHandSig = '';

export function handSignature(view, myTurn, blocked, selectedTarget) {
  const playable = myTurn && !blocked && !!selectedTarget;
  const rankMap = new Map();
  for (const c of view.yourHand || []) {
    if (!c.rank) continue;
    rankMap.set(c.rank, (rankMap.get(c.rank) || 0) + 1);
  }
  const ranks = [...rankMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([r, n]) => `${r}:${n}`)
    .join('|');
  return [
    ranks,
    playable ? 1 : 0,
    (view.askableRanks || []).join(','),
    getFocusedRank() || '',
    computeSuggestedAsk(view.yourHand, view.askableRanks)?.rank || '',
    blocked ? 1 : 0,
  ].join('#');
}

export function killHandTweens(handEl) {
  if (!handEl) return;
  gsap.killTweensOf(handEl.querySelectorAll('.card-stack'));
}

/**
 * @returns {boolean} true if DOM was rebuilt
 */
export function renderHandDiff(handEl, view, {
  myTurn,
  blocked,
  selectedTarget,
  onAsk,
  onPreview,
  isOpeningBusy,
}) {
  if (!handEl) return false;
  if (isOpeningBusy?.() && handEl.children.length) return false;

  const count = view.yourHand?.length || 0;
  const playable = myTurn && !blocked && !!selectedTarget;
  const sig = handSignature(view, myTurn, blocked, selectedTarget);

  if (!count) {
    if (lastHandSig === 'empty') return false;
    lastHandSig = 'empty';
    killHandTweens(handEl);
    clearHandFocus();
    handEl.innerHTML = '<div class="empty-hand">Drawing from the fuck pond…</div>';
    return true;
  }

  if (sig === lastHandSig && handEl.querySelector('.hand-shelf--arc')) {
    updateHandPlayStates(handEl, view, playable);
    return false;
  }

  lastHandSig = sig;
  killHandTweens(handEl);
  const prevFocus = getFocusedRank();
  handEl.innerHTML = '';
  handEl.classList.remove('peek-stack', 'hand-grouped', 'hand-collections', 'hand-fan', 'hand-shelf-mount');
  handEl.classList.add('hand-arc-mount');

  const suggested = playable ? computeSuggestedAsk(view.yourHand, view.askableRanks) : null;
  handEl.appendChild(buildHandArc(view.yourHand, {
    playable,
    askableRanks: view.askableRanks,
    suggested,
    focusedRank: prevFocus,
    onAsk,
    onPreview,
  }));

  if (prevFocus && view.askableRanks?.includes(prevFocus)) {
    setFocusedRank(prevFocus, { silent: true });
  } else if (suggested?.rank && playable) {
    setFocusedRank(suggested.rank, { silent: true });
  } else {
    clearHandFocus();
  }

  return true;
}

function updateHandPlayStates(handEl, view, playable) {
  const askable = new Set(view.askableRanks || []);
  handEl.querySelectorAll('.card-stack[data-rank]').forEach((el) => {
    const rank = el.dataset.rank;
    const canAsk = playable && askable.has(rank);
    el.classList.toggle('card-stack--playable', canAsk);
    el.classList.toggle('card-stack--locked', !canAsk);
    el.toggleAttribute('data-drag-ask', canAsk ? '1' : false);
  });
}

export function resetHandRenderCache() {
  lastHandSig = '';
}
