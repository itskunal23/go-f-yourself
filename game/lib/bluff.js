// Bluff / lie tracking for social Go Fish tension.

export const SUSPICION_LINES = [
  'That answer felt suspicious.',
  'Somebody\'s got a poker face.',
  'Hmm. The bartender doesn\'t buy it.',
  'Eyes say yes. Mouth says no.',
];

export const LIAR_PUNISHMENTS = [
  { id: 'drinks', label: '+2 drinks', apply: 'drinks' },
  { id: 'loseCard', label: 'Lose random card', apply: 'loseCard' },
  { id: 'askAgain', label: 'They ask again — free', apply: 'askAgain' },
  { id: 'revealHand', label: 'Reveal hand', apply: 'revealHand' },
];

export function initBluffState(room) {
  room.lieLog = [];
  room.askAgainTokens = {};
  room.bluffStats = {};
  room.askCounter = 0;
  room.pendingBluff = null;
}

export function bluffStatsFor(room, playerId) {
  if (!room.bluffStats) room.bluffStats = {};
  if (!room.bluffStats[playerId]) {
    room.bluffStats[playerId] = { lies: 0, caught: 0, survived: 0, masterBluff: false };
  }
  return room.bluffStats[playerId];
}

export function recordLie(room, { defenderId, askerId, rank, turnNumber, lieMultiplier = 1 }) {
  const entry = {
    id: `${defenderId}-${rank}-${turnNumber}`,
    defenderId,
    askerId,
    rank,
    turnNumber,
    lieMultiplier,
    phrase: 'Nope.',
    at: Date.now(),
    resolved: false,
  };
  room.lieLog.push(entry);
  const st = bluffStatsFor(room, defenderId);
  st.lies += 1;
  return entry;
}

export function grantAskAgainToken(room, askerId, targetId, rank, multiplier = 2) {
  room.askAgainTokens[askerId] = { targetId, rank, multiplier, at: Date.now() };
}

export function consumeAskAgainToken(room, askerId, targetId, rank) {
  const t = room.askAgainTokens?.[askerId];
  if (!t || t.targetId !== targetId || t.rank !== rank) return null;
  const mult = t.multiplier || 2;
  delete room.askAgainTokens[askerId];
  return mult;
}

export function findActiveLie(room, defenderId, rank) {
  return room.lieLog?.find((l) => l.defenderId === defenderId && l.rank === rank && !l.resolved) || null;
}

export function markLieCaught(room, lie, { punishment }) {
  lie.resolved = true;
  lie.caughtAt = Date.now();
  lie.punishment = punishment;
  const st = bluffStatsFor(room, lie.defenderId);
  st.caught += 1;
  st.masterBluff = false;
}

export function markLieSurvived(room, defenderId) {
  const st = bluffStatsFor(room, defenderId);
  st.survived += 1;
  if (st.survived >= 3 && st.caught === 0) st.masterBluff = true;
}

export function pickSuspicionLine() {
  return SUSPICION_LINES[Math.floor(Math.random() * SUSPICION_LINES.length)];
}

export function pickLiarPunishment() {
  return LIAR_PUNISHMENTS[Math.floor(Math.random() * LIAR_PUNISHMENTS.length)];
}
