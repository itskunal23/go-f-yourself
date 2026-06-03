// Drink Debt economy — drinks as currency, attacks, defense, and leverage.
import { playerStatus } from '../../frontend/js/bac.js';
import { drinkCountFor, queueDrink } from './drinking.js';

export const MILESTONES = [
  { at: 3, id: 'buzzed', label: 'Buzzed', hostLine: 'Buzzed unlocked — the bartender is watching you closer.' },
  { at: 5, id: 'tipsy', label: 'Tipsy', grant: { assign: 1 }, hostLine: 'Tipsy — you earned an Assign Drink token. Weaponize it.' },
  { at: 7, id: 'reckless', label: 'Reckless', grant: { redirect: 1 }, hostLine: 'Reckless — redirect one punishment. Use it wisely.' },
  { at: 9, id: 'danger', label: 'Danger Zone', grant: { thief: 1 }, hostLine: 'Danger zone — every hit hurts. Drink Thief unlocked.' },
];

export const SET_REWARDS = [
  { id: 'assign2', label: '🍺 Give 2 Drinks', special: 'assign2' },
  { id: 'block2', label: '🛡️ Block 2 Drinks', grant: { block: 2 } },
  { id: 'askAgain', label: '🎣 Ask Again Token', special: 'askAgain' },
  { id: 'bluffShield', label: '🎭 Bluff Shield', grant: { bluffShield: 1 } },
];

export const HOUSE_RULES = {
  double: { id: 'double', label: 'Double Trouble', desc: 'Next drink counts double.' },
  reverse: { id: 'reverse', label: 'Reverse', desc: 'Next punishment goes to your opponent.' },
  mercy: { id: 'mercy', label: 'Mercy', desc: 'Next drink penalty ignored.' },
  chaos: { id: 'chaos', label: 'Chaos', desc: 'Both players drink on the next penalty.' },
};

function roundDebt(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function profileOf(player) {
  return {
    sex: player.sex,
    age: player.age,
    heightCm: player.heightCm,
    weightKg: player.weightKg,
  };
}

export function initPlayerEconomy(player) {
  player.drinkDebt = 0;
  player.drinkTokens = { assign: 0, block: 0, thief: 0, bluffShield: 0, redirect: 0 };
  player.drinkMilestones = [];
}

export function initRoomEconomy(room) {
  room.drinkChoice = null;
  room.houseRule = null;
  room.turnCount = 0;
}

export function economySnapshot(player) {
  return {
    debt: roundDebt(player.drinkDebt),
    tokens: { ...(player.drinkTokens || {}) },
    milestones: [...(player.drinkMilestones || [])],
  };
}

export function addDrinkDebt(player, amount) {
  if (!player || player.isBot) return 0;
  if (!player.drinkTokens) initPlayerEconomy(player);
  const add = roundDebt(amount);
  player.drinkDebt = roundDebt((player.drinkDebt || 0) + add);
  return add;
}

export function reduceDrinkDebt(player, amount) {
  if (!player) return 0;
  const pay = roundDebt(Math.min(amount, player.drinkDebt || 0));
  player.drinkDebt = roundDebt(Math.max(0, (player.drinkDebt || 0) - pay));
  return pay;
}

export function grantTokens(player, grants = {}) {
  if (!player || player.isBot) return;
  if (!player.drinkTokens) initPlayerEconomy(player);
  for (const [k, v] of Object.entries(grants)) {
    if (!Number.isFinite(v) || v <= 0) continue;
    player.drinkTokens[k] = (player.drinkTokens[k] || 0) + v;
  }
}

export function consumeToken(player, type, n = 1) {
  if (!player?.drinkTokens?.[type] || player.drinkTokens[type] < n) return false;
  player.drinkTokens[type] -= n;
  return true;
}

export function opponentOf(room, playerId) {
  return room.players.find((p) => p.id !== playerId && !p.isBot) || room.players.find((p) => p.id !== playerId);
}

function scaledCount(player, room, baseCount) {
  let count = drinkCountFor(player, room.gameMode, baseCount);
  if (room.houseRule?.id === 'double' && room.houseRule.uses > 0) {
    count = Math.max(1, Math.round(count * 2));
    room.houseRule.uses -= 1;
    if (room.houseRule.uses <= 0) room.houseRule = null;
  }
  if (room.game?.doubleNextMiss) {
    count = Math.max(1, Math.round(count * 2));
    room.game.doubleNextMiss = false;
  }
  return count;
}

function tryBlockTokens(player, count) {
  let remaining = count;
  while (remaining > 0 && player.drinkTokens?.block > 0) {
    player.drinkTokens.block -= 1;
    remaining -= 1;
  }
  return remaining;
}

/** Apply a drink penalty — debt ledger + strategic choice prompts. */
export function imposeDrinkPenalty(room, playerId, reason, baseCount = 1, extra = {}) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.isBot) return null;
  if (!player.drinkTokens) initPlayerEconomy(player);

  /** Official CHEERS rounds — scan drink + say toast; skip debt-choice sheet */
  if (extra.cheers) {
    queueDrink(room, playerId, reason, baseCount, extra);
    return { queued: true, cheers: true };
  }

  // Active house rules
  if (room.houseRule?.id === 'mercy' && room.houseRule.uses > 0 && !extra.force) {
    room.houseRule.uses -= 1;
    if (room.houseRule.uses <= 0) room.houseRule = null;
    return { skipped: true, reason: 'mercy' };
  }

  let targetId = playerId;
  if (room.houseRule?.id === 'reverse' && room.houseRule.uses > 0 && !extra.force) {
    room.houseRule.uses -= 1;
    if (room.houseRule.uses <= 0) room.houseRule = null;
    const opp = opponentOf(room, playerId);
    if (opp) targetId = opp.id;
  }

  if (room.houseRule?.id === 'chaos' && room.houseRule.uses > 0 && !extra.force) {
    room.houseRule.uses -= 1;
    if (room.houseRule.uses <= 0) room.houseRule = null;
    const results = [];
    for (const p of room.players) {
      if (!p.isBot) results.push(imposeDrinkPenalty(room, p.id, reason, baseCount, { ...extra, force: true }));
    }
    return { chaos: true, results };
  }

  const target = room.players.find((p) => p.id === targetId);
  if (!target) return null;

  let count = scaledCount(target, room, baseCount);
  count = tryBlockTokens(target, count);
  if (count <= 0) return { blocked: true };

  const st = playerStatus(profileOf(target), target.drinks || []);
  const opp = opponentOf(room, targetId);

  // Split or take — take full amount OR give half to opponent
  if (count >= 2 && !extra.skipSplit && !extra.cheers && opp && !room.drinkChoice) {
    room.drinkChoice = {
      type: 'splitOrTake',
      playerId: targetId,
      reason,
      takeAmount: count,
      giveAmount: Math.max(1, Math.floor(count / 2)),
      opponentId: opp.id,
    };
    return { choice: 'splitOrTake', count };
  }

  // Last call — danger zone at drunk level 8+
  if (st.level >= 8 && !extra.cheers && !extra.skipLastCall && opp && !room.drinkChoice) {
    room.drinkChoice = {
      type: 'lastCall',
      playerId: targetId,
      reason,
      amount: count,
      opponentId: opp.id,
    };
    return { choice: 'lastCall', count };
  }

  addDrinkDebt(target, count);
  if (!room.drinkChoice && !extra.silent) {
    room.drinkChoice = {
      type: 'debtChoice',
      playerId: targetId,
      reason,
      added: count,
      totalDebt: target.drinkDebt,
    };
  }
  return { debt: count, total: target.drinkDebt };
}

export function queueSetRewardChoice(room, playerId) {
  room.drinkChoice = {
    type: 'setReward',
    playerId,
    options: SET_REWARDS.map((r) => ({ id: r.id, label: r.label })),
  };
}

export function maybeBartenderDeal(room, playerId) {
  if (room.drinkChoice || Math.random() > 0.12) return false;
  room.drinkChoice = {
    type: 'dealOffer',
    playerId,
    nowAmount: 1,
    riskAmount: 3,
    riskTurns: 1,
  };
  return true;
}

export function setHouseRule(room, ruleId) {
  const meta = HOUSE_RULES[ruleId];
  if (!meta) return;
  room.houseRule = { id: meta.id, label: meta.label, uses: 1 };
}

export function checkDrinkMilestones(room, player) {
  const st = playerStatus(profileOf(player), player.drinks || []);
  const std = st.totalStandardDrinks || 0;
  const hit = [];
  for (const m of MILESTONES) {
    if (std >= m.at && !player.drinkMilestones?.includes(m.id)) {
      if (!player.drinkMilestones) player.drinkMilestones = [];
      player.drinkMilestones.push(m.id);
      if (m.grant) grantTokens(player, m.grant);
      hit.push(m);
    }
  }
  return hit;
}

export function applySetReward(room, player, rewardId) {
  const reward = SET_REWARDS.find((r) => r.id === rewardId);
  if (!reward) return null;
  if (reward.grant) grantTokens(player, reward.grant);
  return reward;
}

export function resolveSplitOrTake(room, playerId, action) {
  const choice = room.drinkChoice;
  if (!choice || choice.type !== 'splitOrTake' || choice.playerId !== playerId) return null;
  room.drinkChoice = null;
  const player = room.players.find((p) => p.id === playerId);
  const opp = room.players.find((p) => p.id === choice.opponentId);
  if (!player) return null;

  if (action === 'give' && opp) {
    addDrinkDebt(opp, choice.giveAmount);
    return { action: 'give', amount: choice.giveAmount, targetId: opp.id, targetName: opp.name };
  }
  addDrinkDebt(player, choice.takeAmount);
  return { action: 'take', amount: choice.takeAmount, total: player.drinkDebt };
}

export function resolveLastCall(room, playerId, action) {
  const choice = room.drinkChoice;
  if (!choice || choice.type !== 'lastCall' || choice.playerId !== playerId) return null;
  room.drinkChoice = null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  if (action === 'drink') {
    addDrinkDebt(player, choice.amount);
    return { action: 'drink', amount: choice.amount };
  }
  return { action: 'punish', amount: choice.amount, opponentId: choice.opponentId };
}

export function resolveDealOffer(room, playerId, action) {
  const choice = room.drinkChoice;
  if (!choice || choice.type !== 'dealOffer' || choice.playerId !== playerId) return null;
  room.drinkChoice = null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  if (action === 'now') {
    addDrinkDebt(player, choice.nowAmount);
    return { action: 'now', amount: choice.nowAmount };
  }
  room.pendingRiskDebt = {
    playerId,
    amount: choice.riskAmount,
    dueTurn: (room.turnCount || 0) + (choice.riskTurns || 1),
  };
  return { action: 'risk', amount: choice.riskAmount };
}

export function resolveDebtChoice(room, playerId, action) {
  const choice = room.drinkChoice;
  if (!choice || choice.type !== 'debtChoice' || choice.playerId !== playerId) return null;
  room.drinkChoice = null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  if (action === 'double') {
    addDrinkDebt(player, choice.added || 0);
    return { action: 'double', total: player.drinkDebt };
  }
  if (action === 'save') {
    return { action: 'save', total: player.drinkDebt };
  }
  // pay — caller handles logging drinks
  return { action: 'pay', amount: choice.added || player.drinkDebt, total: player.drinkDebt };
}

export function resolveGiftDrink(room, playerId, action) {
  const player = room.players.find((p) => p.id === playerId);
  const opp = opponentOf(room, playerId);
  if (!player || !opp) return null;

  if (action === 'give') {
    addDrinkDebt(opp, 1);
    return { action: 'give', targetId: opp.id, targetName: opp.name };
  }
  addDrinkDebt(player, 1);
  return { action: 'self', amount: 1 };
}

export function useAssignToken(room, playerId, targetId, count = 1) {
  const player = room.players.find((p) => p.id === playerId);
  const target = room.players.find((p) => p.id === targetId);
  if (!player || !target || !consumeToken(player, 'assign', count)) return null;
  addDrinkDebt(target, count);
  return { count, targetId: target.id, targetName: target.name };
}

export function useThiefToken(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  const opp = opponentOf(room, playerId);
  if (!player || !opp || !consumeToken(player, 'thief', 1)) return null;
  const steal = roundDebt(Math.min(2, opp.drinkDebt || 0));
  if (steal <= 0) return { stolen: 0 };
  opp.drinkDebt = roundDebt((opp.drinkDebt || 0) - steal);
  addDrinkDebt(player, steal);
  return { stolen: steal, from: opp.name, to: player.name };
}

export function useRedirectToken(room, playerId, penaltyTargetId, amount) {
  const player = room.players.find((p) => p.id === playerId);
  const opp = opponentOf(room, playerId);
  if (!player || !opp || !consumeToken(player, 'redirect', 1)) return null;
  const from = room.players.find((p) => p.id === penaltyTargetId);
  if (!from) return null;
  reduceDrinkDebt(from, amount);
  addDrinkDebt(opp, amount);
  return { amount, from: from.name, to: opp.name };
}

export function tickRiskDebt(room) {
  const risk = room.pendingRiskDebt;
  if (!risk) return null;
  if ((room.turnCount || 0) < risk.dueTurn) return null;
  const player = room.players.find((p) => p.id === risk.playerId);
  room.pendingRiskDebt = null;
  if (player) addDrinkDebt(player, risk.amount);
  return { playerId: risk.playerId, amount: risk.amount };
}
