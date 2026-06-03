// Shared drinking-mode helpers — wheel events, BAC escalation, questionnaire dares.
import { sanitizeDeviceBoundary } from './content-boundaries.js';
import { playerStatus } from '../../frontend/js/bac.js';
import { rankDare } from '../../frontend/js/game.js';
import { cheersToastText, cheersCardLine } from './cheers-rules.js';

export const TIER_THRESHOLDS = [5, 7, 9];

export const WHEEL_EVENTS = [
  { id: 'all_drink', text: '🎡 Everyone drinks! Chaos Wheel says bottoms up.' },
  { id: 'cheers', text: '🎡 CHEERS — raise your glasses and drink together.' },
  { id: 'shot_round', text: '🎡 Shot round — take a shot or chicken with two drinks.' },
  { id: 'double', text: '🎡 Double trouble — next drink counts double.' },
  { id: 'house_reverse', text: '🎡 HOUSE RULE — Reverse! Next punishment hits your opponent.' },
  { id: 'house_mercy', text: '🎡 HOUSE RULE — Mercy! Next drink ignored.' },
  { id: 'house_chaos', text: '🎡 HOUSE RULE — Chaos! Both drink on the next hit.' },
  { id: 'safe', text: '🎡 Safe round — no drinks for 60 seconds.' },
  { id: 'all_draw', text: '🎡 Everyone draws a card. Good luck, fuckers.' },
];

const QUESTIONNAIRE_DARES = {
  kink: (v) => `Personal dare: tease your kink (“${v}”) for 10 seconds — no chicken.`,
  turnOn: (v) => `Personal dare: do one thing that hypes you up about “${v}” — improvise out loud.`,
  ick: (v) => `Personal dare: roast your partner for “${v}” energy, then they pick drink or dare.`,
  dateNight: (v) => `Personal dare: pitch “${v}” as tonight’s plan in one filthy sentence.`,
  friskyDrink: (v) => `Personal dare: mime drinking “${v}” like a slut — 5 sec or sip.`,
  initiator: (v) => `Personal dare: prove “${v}” with a 10-sec flirt move on your partner.`,
};

export function drunkTier(level) {
  if (level >= 9) return 9;
  if (level >= 7) return 7;
  if (level >= 5) return 5;
  return 0;
}

export function drinkMultiplier(level, gameMode) {
  let m = 1;
  if (level >= 9) m = 2;
  else if (level >= 7) m = 1.5;
  else if (level >= 5) m = 1.25;
  if (gameMode === 'savage') m *= 1.25;
  return m;
}

export function drinkCountFor(player, gameMode, base = 1) {
  const st = playerStatus(profileOf(player), player.drinks || []);
  return Math.max(1, Math.round(base * drinkMultiplier(st.level, gameMode)));
}

export function profileOf(player) {
  return {
    sex: player.sex,
    age: player.age,
    heightCm: player.heightCm,
    weightKg: player.weightKg,
  };
}

/** Queue one pending drink with optional BAC/savage multiplier. */
export function queueDrink(room, playerId, reason, baseCount = 1, extra = {}) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.isBot) return;
  const existing = room.pendingDrinks.find((d) => d.playerId === playerId);
  if (existing) return;
  const count = drinkCountFor(player, room.gameMode, baseCount);
  const label = count > 1 ? `${reason} (×${count})` : reason;
  room.pendingDrinks.push({ playerId, reason: label, drinkCount: count, ...extra });
}

/**
 * Official rule: when someone banks a 4-of-a-kind, every other player cheers and drinks.
 * Opens scanner + toast on their client (pendingDrinks → prompt.type === 'drink').
 */
export function triggerCheersForSet(room, banker, rank) {
  if (!room?.players?.length || !banker) return null;
  const cardLine = cheersCardLine(rank);
  const toastLine = cheersToastText(banker.name, cardLine);
  const queued = [];

  for (const p of room.players) {
    if (p.id === banker.id || p.isBot) continue;
    queueDrink(room, p.id, toastLine, 1, {
      cheers: true,
      cheersSet: true,
      requireToast: true,
      cheersBankerId: banker.id,
      cheersBankerName: banker.name.split(' ')[0],
      cheersCard: cardLine,
      cheersToast: toastLine,
    });
    queued.push(p.id);
  }

  return { toastLine, cardLine, queued };
}

export function queueDrinksForAll(room, reason, extra = {}) {
  for (const p of room.players) {
    if (!p.isBot) queueDrink(room, p.id, reason, 1, extra);
  }
}

export function checkTierCrossing(player) {
  const st = playerStatus(profileOf(player), player.drinks || []);
  const tier = drunkTier(st.level);
  const prev = player.lastDrunkTier ?? 0;
  if (tier > prev && TIER_THRESHOLDS.includes(tier)) {
    player.lastDrunkTier = tier;
    return { tier, level: st.level, label: st.label };
  }
  if (tier !== prev) player.lastDrunkTier = tier;
  return null;
}

export function pickQuestionnaireDare(player, opponent) {
  const q = player.questionnaire || {};
  const keys = Object.keys(QUESTIONNAIRE_DARES).filter((k) => q[k] && String(q[k]).trim());
  if (!keys.length) return null;
  const key = keys[Math.floor(Math.random() * keys.length)];
  const fn = QUESTIONNAIRE_DARES[key];
  const dare = fn(String(q[key]).trim());
  const opp = opponent?.name?.split(' ')[0];
  return opp ? `${dare} (${opp} judges.)` : dare;
}

export function personalizeDare(rank, player, opponent) {
  const base = sanitizeDeviceBoundary(rankDare(rank));
  const bonus = pickQuestionnaireDare(player, opponent);
  if (!bonus) return base;
  return sanitizeDeviceBoundary(`${base}\n\n🎯 ${bonus}`);
}

export function pickWheelEvent() {
  return WHEEL_EVENTS[Math.floor(Math.random() * WHEEL_EVENTS.length)];
}
