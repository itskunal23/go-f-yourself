// Bartender chaos bottle — rare in-match interrupt (Mario Kart blue shell).
import { randomUUID } from 'node:crypto';
import { playerStatus } from '../../frontend/js/bac.js';
import { rankMeta } from '../../frontend/js/game.js';
import { grantTokens, setHouseRule } from './drink-economy.js';
import { grantAskAgainToken } from './bluff.js';

export const TRIGGERS = {
  periodic: {
    title: '🍸 LAST CALL CHAOS',
    feed: 'The bartender slides a bottle onto the table…',
  },
  bluff: {
    title: '🚨 BLUFF DETECTED',
    feed: 'Liar caught — the bottle decides your fate.',
  },
  suddenDeath: {
    title: '☠️ SUDDEN DEATH SPIN',
    feed: 'Someone is deep in the danger zone. Sudden death.',
  },
};

const STANDARD_EFFECTS = [
  { id: 'immunity', label: '🛡️ Immune to next drink', good: true, weight: 10, apply: 'block' },
  { id: 'askAgain', label: '🎣 Ask Again token', good: true, weight: 8, apply: 'askAgain' },
  { id: 'assign', label: '🍺 Assign 1 Drink token', good: true, weight: 8, apply: 'assign' },
  { id: 'progress', label: '🔥 Collection progress +1', good: true, weight: 6, apply: 'progress' },
  { id: 'drink2', label: '🍺 Drink 2', good: false, weight: 10, apply: 'drink', drinks: 2 },
  { id: 'drink1', label: '🍺 Drink 1', good: false, weight: 8, apply: 'drink', drinks: 1 },
  { id: 'reveal', label: '🎭 Reveal one card', good: false, weight: 7, apply: 'reveal' },
  { id: 'skipTurn', label: '💀 Lose your next turn', good: false, weight: 6, apply: 'skipTurn' },
];

const BLUFF_EFFECTS = [
  { id: 'drink1', label: '+1 Drink', good: false, weight: 30, apply: 'drink', drinks: 1 },
  { id: 'drink3', label: '+3 Drinks', good: false, weight: 25, apply: 'drink', drinks: 3 },
  { id: 'reveal', label: 'Reveal a card', good: false, weight: 25, apply: 'reveal' },
  { id: 'opponentPick', label: 'Opponent chooses punishment', good: false, weight: 20, apply: 'opponentPick' },
];

const SUDDEN_DEATH_EFFECTS = [
  { id: 'drink2', label: '🍺 Drink 2', good: false, weight: 25, apply: 'drink', drinks: 2 },
  { id: 'immunity', label: '🛡️ Immunity', good: true, weight: 20, apply: 'block' },
  { id: 'draw2', label: '🃏 Draw 2 cards', good: false, weight: 20, apply: 'draw', count: 2 },
  { id: 'steal', label: '🃏 Steal a card', good: false, weight: 20, apply: 'steal' },
  { id: 'allDrink', label: 'EVERYONE DRINKS', good: false, weight: 15, apply: 'allDrink', drinks: 1 },
];

const CHEST_EFFECTS = [
  { id: 'allDrink', label: 'EVERYONE DRINKS', good: false, weight: 15, apply: 'allDrink', drinks: 1 },
  { id: 'swapHands', label: 'SWAP HANDS', good: false, weight: 10, apply: 'swapHands' },
  { id: 'reverse', label: 'REVERSE PENALTIES', good: true, weight: 12, apply: 'houseReverse' },
  { id: 'double', label: 'DOUBLE NEXT PUNISHMENT', good: false, weight: 12, apply: 'houseDouble' },
  { id: 'steal', label: 'STEAL A CARD', good: false, weight: 15, apply: 'steal' },
];

const FATE_EFFECTS = {
  drink: { id: 'fateDrink', label: '🍺 Drink 2', good: false, apply: 'drink', drinks: 2 },
  risk: { id: 'fateRisk', label: '🎭 Reveal one card', good: false, apply: 'reveal' },
  chaos: { id: 'fateChaos', label: '🔥 Draw 2 · go again', good: true, apply: 'drawGoAgain', count: 2 },
};

export function initBottleChaos(room) {
  room.bottleTurnsSinceChaos = 0;
  room.nextBottleAt = 5 + Math.floor(Math.random() * 6);
  room.skipTurnQueue = {};
  room.pendingBottleChaos = null;
  room.bottleReveal = null;
}

export function pickWeightedEffect(pool) {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return { ...e };
  }
  return { ...pool[pool.length - 1] };
}

export function pickBottleTarget(room, { excludeId = null, forceId = null } = {}) {
  if (forceId) return forceId;
  const candidates = room.players.filter((p) => !p.isBot && p.id !== excludeId);
  if (!candidates.length) {
    return room.players.find((p) => !p.isBot)?.id || room.players[0]?.id;
  }
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

export function seatIndexForPlayer(room, playerId) {
  const humans = room.players.filter((p) => !p.isBot);
  const idx = humans.findIndex((p) => p.id === playerId);
  return idx >= 0 ? idx : 0;
}

export function shouldTriggerPeriodic(room) {
  if (!room.started || room.finished) return false;
  room.bottleTurnsSinceChaos = (room.bottleTurnsSinceChaos || 0) + 1;
  const threshold = room.nextBottleAt || 7;
  if (room.bottleTurnsSinceChaos >= threshold) {
    room.bottleTurnsSinceChaos = 0;
    room.nextBottleAt = 5 + Math.floor(Math.random() * 6);
    return true;
  }
  return false;
}

export function checkSuddenDeathTrigger(room) {
  for (const p of room.players) {
    if (p.isBot) continue;
    const level = playerStatus(p, p.drinks || []).level;
    if (level >= 8 && Math.random() < 0.12) {
      return { targetId: p.id, trigger: 'suddenDeath' };
    }
  }
  return null;
}

export function buildChaosPayload(room, { trigger, targetId, effect = null }) {
  const meta = TRIGGERS[trigger] || TRIGGERS.periodic;
  const tid = targetId || pickBottleTarget(room);
  const target = room.players.find((p) => p.id === tid);
  const humans = room.players.filter((p) => !p.isBot);

  let effectPool = STANDARD_EFFECTS;
  if (trigger === 'bluff') effectPool = BLUFF_EFFECTS;
  else if (trigger === 'suddenDeath') effectPool = SUDDEN_DEATH_EFFECTS;
  else if (Math.random() < 0.18) {
    effectPool = [...STANDARD_EFFECTS, ...CHEST_EFFECTS];
  }

  const chosen = effect || pickWeightedEffect(effectPool);
  const fateChoice = trigger === 'periodic' && Math.random() < 0.15;

  return {
    id: randomUUID(),
    trigger,
    title: meta.title,
    feed: meta.feed,
    targetId: tid,
    targetName: target?.name || 'Player',
    effect: chosen,
    fateChoice,
    seatIndex: seatIndexForPlayer(room, tid),
    playerCount: Math.max(2, humans.length),
  };
}

export function queueBottleChaos(room, opts) {
  if (room.pendingBottleChaos) return null;
  const payload = buildChaosPayload(room, opts);
  room.pendingBottleChaos = payload;
  return payload;
}

export function resolveFateChoice(choice) {
  return FATE_EFFECTS[choice] || FATE_EFFECTS.chaos;
}

export function applyBottleEffect(room, payload, helpers = {}) {
  const { targetId, effect } = payload;
  const target = room.players.find((p) => p.id === targetId);
  const opponent = room.players.find((p) => p.id !== targetId && !p.isBot);
  const g = room.game;
  const penalizeDrink = helpers.penalizeDrink;
  const penalizeAll = helpers.penalizeDrinksForAll;
  const drinking = helpers.isDrinkingMode?.(room);

  if (!target || !effect) return { applied: false };

  switch (effect.apply) {
    case 'block':
      grantTokens(target, { block: 1 });
      break;
    case 'assign':
      grantTokens(target, { assign: 1 });
      break;
    case 'askAgain': {
      const ranks = g?.askableRanks(targetId) || [];
      const rank = ranks[0] || g?.activeRanks?.[0];
      if (rank && opponent) grantAskAgainToken(room, targetId, opponent.id, rank, 2);
      break;
    }
    case 'progress':
      g?.drawFromDeck(targetId, 1);
      break;
    case 'drink':
      if (drinking && penalizeDrink) {
        penalizeDrink(room, targetId, `Chaos bottle — ${effect.label}`, effect.drinks || 1);
      } else if (g && opponent) {
        g.stealRandomCard(targetId, opponent.id);
      }
      break;
    case 'reveal': {
      const gp = g?.player(targetId);
      if (gp?.hand?.length) {
        const card = gp.hand[Math.floor(Math.random() * gp.hand.length)];
        const m = rankMeta(card.rank);
        room.bottleReveal = {
          playerId: targetId,
          rank: card.rank,
          suit: card.suit,
          line: m.line,
          until: Date.now() + 6000,
        };
      }
      break;
    }
    case 'skipTurn':
      if (!room.skipTurnQueue) room.skipTurnQueue = {};
      room.skipTurnQueue[targetId] = (room.skipTurnQueue[targetId] || 0) + 1;
      break;
    case 'steal':
      if (g && opponent) g.stealRandomCard(targetId, opponent.id);
      break;
    case 'draw':
      g?.drawFromDeck(targetId, effect.count || 1);
      break;
    case 'drawGoAgain':
      g?.drawFromDeck(targetId, effect.count || 2);
      break;
    case 'allDrink':
      if (drinking && penalizeAll) penalizeAll(room, 'Community chest — everyone drinks.');
      break;
    case 'swapHands': {
      const a = g?.player(targetId);
      const b = opponent ? g?.player(opponent.id) : null;
      if (a && b) {
        const tmp = a.hand;
        a.hand = b.hand;
        b.hand = tmp;
      }
      break;
    }
    case 'houseReverse':
      setHouseRule(room, 'reverse');
      break;
    case 'houseDouble':
      setHouseRule(room, 'double');
      break;
    case 'opponentPick':
      if (opponent) {
        room.pendingPenalty = {
          phase: 'pick',
          chooserId: opponent.id,
          victimId: targetId,
          source: 'bottleBluff',
        };
      }
      break;
    default:
      break;
  }

  return { applied: true, effect, targetId };
}
