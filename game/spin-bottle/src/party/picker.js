import { TAU } from '../core/physics.js';

/** Weighted target picker — fair but random, no back-to-back repeats. */

export function pickWeightedTarget(players, state = {}) {
  const { lastPickedId, pickCounts = {}, spinnerIndex } = state;
  const n = players.length;
  if (n === 0) return 0;
  if (n === 1) return 0;

  const weights = players.map((p, i) => {
    let w = 1;

    if (p.id === lastPickedId) w *= 0.05;

    const count = pickCounts[p.id] || 0;
    const avg = Object.values(pickCounts).reduce((a, b) => a + b, 0) / Math.max(1, n);
    if (count < avg) w *= 1.4 + (avg - count) * 0.3;
    if (count > avg) w *= 0.6;

    if (i === spinnerIndex && n > 2) w *= 0.85;

    return Math.max(0.01, w);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return n - 1;
}

/** Seat angle for player index (bottle points at top = index 0). */
export function seatAngleForIndex(index, playerCount) {
  return (TAU / playerCount) * index - Math.PI / 2;
}

export function indexForSeatAngle(angle, playerCount) {
  const bottlePointsUp = ((angle % TAU) + TAU) % TAU;
  const normalized = ((Math.PI / 2 - bottlePointsUp) + TAU) % TAU;
  const slice = TAU / playerCount;
  return Math.floor((normalized + slice / 2) / slice) % playerCount;
}
