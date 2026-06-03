// Bartender memory + event-anchored commentary context.
// Every roast must cite what actually happened in the game.

import { categoryMeta } from '../../frontend/js/card-categories.js';

function shortName(name) {
  return String(name || 'Player').split(' ')[0];
}

function playerStats(memory, playerId) {
  if (!memory?.players[playerId]) {
    return {
      denials: 0,
      denialStreak: 0,
      successfulBluffs: 0,
      failedBluffs: 0,
      setsCompleted: 0,
      pondDraws: 0,
      cardsReceived: 0,
      cardsGiven: 0,
      biggestHand: 0,
      steals: 0,
      drinksOwed: 0,
    };
  }
  return memory.players[playerId];
}

export function initBartenderMemory(room) {
  room.bartenderMemory = {
    players: {},
    lastEvent: null,
    gameStartedAt: null,
    eventLog: [],
    narratives: {},
  };
  for (const p of room.players || []) {
    resetPlayerMemory(room, p.id);
  }
}

function resetPlayerMemory(room, playerId) {
  if (!room.bartenderMemory) initBartenderMemory(room);
  room.bartenderMemory.players[playerId] = {
    denials: 0,
    denialStreak: 0,
    successfulBluffs: 0,
    failedBluffs: 0,
    setsCompleted: 0,
    pondDraws: 0,
    cardsReceived: 0,
    cardsGiven: 0,
    biggestHand: 0,
    steals: 0,
    drinksOwed: 0,
    drinksTaken: 0,
    misses: 0,
    winStreak: 0,
    lossStreak: 0,
    favoriteCategory: null,
    traits: [],
    lastBluffCaughtAt: null,
  };
}

export function getBartenderMemory(room) {
  if (!room.bartenderMemory) initBartenderMemory(room);
  return room.bartenderMemory;
}

function ensurePlayer(room, playerId) {
  const mem = getBartenderMemory(room);
  if (!mem.players[playerId]) resetPlayerMemory(room, playerId);
  return mem.players[playerId];
}

function syncHandPeak(room, playerId) {
  const gp = room.game?.player(playerId);
  if (!gp) return 0;
  const count = gp.hand.length;
  const st = ensurePlayer(room, playerId);
  if (count > st.biggestHand) st.biggestHand = count;
  return count;
}

function syncDebt(room, playerId) {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) return 0;
  const debt = p.drinkDebt || 0;
  ensurePlayer(room, playerId).drinksOwed = debt;
  return debt;
}

/** Build structured game event + update memory. Returns gameEvent for runHost. */
export function buildGameEvent(room, type, subject, facts = {}) {
  const opponent = room.players.find((p) => p.id !== subject?.id) || null;
  const mem = getBartenderMemory(room);
  const subjectStats = subject ? playerStats(mem, subject.id) : null;
  const opponentStats = opponent ? playerStats(mem, opponent.id) : null;

  const gameEvent = {
    type,
    subjectId: subject?.id || null,
    subjectName: shortName(subject?.name),
    opponentName: shortName(opponent?.name),
    facts: { ...facts },
    memory: {
      subject: subjectStats,
      opponent: opponentStats,
    },
  };

  mem.lastEvent = { type, subjectId: subject?.id, at: Date.now(), facts: { ...facts } };
  return gameEvent;
}

export function recordAskDenied(room, asker, target, { card, rank } = {}) {
  const st = ensurePlayer(room, asker.id);
  st.denials += 1;
  st.misses += 1;
  st.denialStreak += 1;
  st.winStreak = 0;
  st.pondDraws += 1;
  if (target) ensurePlayer(room, target.id).denialStreak = 0;

  const handCount = syncHandPeak(room, asker.id);
  syncDebt(room, asker.id);

  return buildGameEvent(room, 'ask_denied', asker, {
    targetName: shortName(target?.name),
    card: card || rank,
    rank,
    denialNumber: st.denials,
    denialStreak: st.denialStreak,
    handCount,
    drinksOwed: st.drinksOwed,
  });
}

export function recordAskSuccess(room, asker, target, { card, rank, count = 1 } = {}) {
  const st = ensurePlayer(room, asker.id);
  st.denialStreak = 0;
  st.winStreak = (st.winStreak || 0) + 1;
  st.cardsReceived += count;
  if (target) ensurePlayer(room, target.id).cardsGiven += count;

  const handCount = syncHandPeak(room, asker.id);
  const rankCount = room.game?.player(asker.id)?.hand.filter((c) => c.rank === rank).length || count;

  return buildGameEvent(room, 'ask_success', asker, {
    targetName: shortName(target?.name),
    card: card || rank,
    rank,
    count,
    handCount,
    rankCount,
    oneFromCollection: rankCount === 3,
  });
}

export function recordLuckyDraw(room, asker, { card, rank } = {}) {
  const st = ensurePlayer(room, asker.id);
  st.denialStreak = 0;
  const handCount = syncHandPeak(room, asker.id);

  return buildGameEvent(room, 'lucky_draw', asker, {
    card: card || rank,
    rank,
    handCount,
  });
}

export function recordPondDraw(room, player, { card, rank, reason } = {}) {
  const st = ensurePlayer(room, player.id);
  st.pondDraws += 1;
  const handCount = syncHandPeak(room, player.id);
  syncDebt(room, player.id);

  const eventType = handCount >= 10 && handCount % 2 === 0 ? 'hand_milestone' : 'pond_draw';
  return buildGameEvent(room, eventType, player, {
    card: card || rank,
    rank,
    handCount,
    drawNumber: st.pondDraws,
    drinksOwed: st.drinksOwed,
    reason,
  });
}

export function recordSetCompleted(room, player, { card, rank, setCount } = {}) {
  const st = ensurePlayer(room, player.id);
  st.setsCompleted += 1;
  const handCount = syncHandPeak(room, player.id);
  const opponent = room.players.find((p) => p.id !== player.id);
  const opponentSets = room.game?.player(opponent?.id)?.books.length || 0;

  return buildGameEvent(room, 'set_completed', player, {
    card: card || rank,
    rank,
    setCount: st.setsCompleted,
    handCount,
    opponentSets,
    tookLead: st.setsCompleted > opponentSets,
  });
}

/** Four of a kind on the table — bank-it moment before finalize. */
export function recordSetPending(room, player, { card, rank } = {}) {
  const handCount = syncHandPeak(room, player.id);
  const opponent = room.players.find((p) => p.id !== player.id);
  return buildGameEvent(room, 'set_pending', player, {
    card: card || rank,
    rank,
    handCount,
    opponentName: shortName(opponent?.name),
    oneFromCollection: true,
  });
}

export function recordBluffCaught(room, defender, asker, { card, rank, phrase } = {}) {
  const st = ensurePlayer(room, defender.id);
  st.failedBluffs += 1;
  st.lastBluffCaughtAt = Date.now();
  syncDebt(room, defender.id);

  return buildGameEvent(room, 'bluff_caught', defender, {
    askerName: shortName(asker?.name),
    card: card || rank,
    rank,
    denialPhrase: phrase,
    failedBluffCount: st.failedBluffs,
    drinksOwed: st.drinksOwed,
  });
}

export function recordBluffSuccess(room, defender, asker, { card, rank } = {}) {
  const st = ensurePlayer(room, defender.id);
  st.successfulBluffs += 1;

  return buildGameEvent(room, 'bluff_success', defender, {
    askerName: shortName(asker?.name),
    card: card || rank,
    rank,
    successfulBluffCount: st.successfulBluffs,
  });
}

export function recordDrinkDebt(room, player, { added = 1, total, reason } = {}) {
  syncDebt(room, player.id);
  const st = ensurePlayer(room, player.id);

  return buildGameEvent(room, 'drink_debt', player, {
    added,
    total: total ?? st.drinksOwed,
    reason,
    drinksOwed: st.drinksOwed,
  });
}

export function recordCardStolen(room, thief, victim, { count = 1 } = {}) {
  const st = ensurePlayer(room, thief.id);
  st.steals += 1;
  syncHandPeak(room, thief.id);
  syncHandPeak(room, victim.id);

  return buildGameEvent(room, 'card_stolen', thief, {
    victimName: shortName(victim?.name),
    count,
    stealNumber: st.steals,
    thiefHandCount: room.game?.player(thief.id)?.hand.length || 0,
  });
}

export function recordGameStarted(room, firstPlayer) {
  const mem = getBartenderMemory(room);
  mem.gameStartedAt = Date.now();
  for (const p of room.players) resetPlayerMemory(room, p.id);

  return buildGameEvent(room, 'game_started', firstPlayer, {
    firstName: shortName(firstPlayer?.name),
    deckSize: room.game?.deck?.length || 0,
    playerCount: room.players.length,
  });
}

export function recordPlayerJoined(room, player) {
  return buildGameEvent(room, 'player_joined', player, {
    playerName: shortName(player?.name),
    waitingForPartner: room.players.length < 2,
  });
}

export function recordWin(room, winner, loser) {
  const st = ensurePlayer(room, winner.id);
  return buildGameEvent(room, 'win', winner, {
    loserName: shortName(loser?.name),
    winnerSets: room.game?.player(winner.id)?.books.length || st.setsCompleted,
    loserSets: room.game?.player(loser?.id)?.books.length || 0,
  });
}

export function recordIntervention(room, player, { level } = {}) {
  return buildGameEvent(room, 'intervention', player, {
    drunkLevel: level,
  });
}

export function recordManualAction(room, player, mode) {
  const mem = getBartenderMemory(room);
  const last = mem.lastEvent;
  return buildGameEvent(room, `manual_${mode}`, player, {
    lastEventType: last?.type || 'none',
    lastEventFacts: last?.facts || {},
    requestedMode: mode,
  });
}

export function memoryRecallLine(gameEvent) {
  const { type, memory, subjectName, facts } = gameEvent || {};
  const st = memory?.subject;
  if (!st) return '';

  if (type === 'ask_denied' && st.denials >= 4) {
    return `Four turns later and ${subjectName} is still recovering from that disaster.`;
  }
  if (type === 'ask_denied' && st.denialStreak >= 3) {
    return `${subjectName} missed ${st.denialStreak} asks in a row.`;
  }
  if (type === 'ask_success' && st.steals >= 2) {
    return `${subjectName} stole ${st.steals} times tonight.`;
  }
  if (type === 'set_completed' && st.setsCompleted >= 2) {
    return `${subjectName} has ${st.setsCompleted} sets on the board now.`;
  }
  if (type === 'bluff_caught' && st.failedBluffs > 1) {
    return `${subjectName} got caught bluffing again.`;
  }
  if (type === 'bluff_success' && st.successfulBluffs > 1) {
    return `${subjectName} is on a bluff hot streak.`;
  }
  if (facts?.turn && facts.turn >= 12) {
    return `Turn ${facts.turn} — this table has history.`;
  }
  return '';
}

const FALLBACK = {
  ask_denied: [
    '{subject} asked for {card} and got absolutely nothing.{recall}',
    '{subject} got denied — denial #{denialNumber} tonight.{recall}',
    '{target} said no. {subject} draws from the pond.',
  ],
  ask_success: [
    '{target} handed over {count}. {subject} now holds {rankCount} of that rank.{near}',
    '{subject} stole {count} from {target}. Clean hit.',
  ],
  lucky_draw: [
    '{subject} got denied, then pulled {card} from the pond. Lucky.',
    'Denied on {card}, then the pond delivered anyway.',
  ],
  pond_draw: [
    '{subject} drew from the pond — {handCount} cards deep now.',
  ],
  hand_milestone: [
    '{subject} has {handCount} cards. That is hoarding, not strategy.',
  ],
  set_completed: [
    '{subject} locked {card}. Set #{setCount} on the board.{lead}',
    'Set complete — {card}. {lead}',
  ],
  bluff_caught: [
    'Bluff detected on {card}. {subject} got caught.{recall}',
    '{subject} lied about {card}. The replay says otherwise.',
  ],
  bluff_success: [
    '{subject} bluffed {asker} on {card} and got away with it.',
  ],
  drink_debt: [
    '{subject} now owes {total} drink{drinkPlural}.',
  ],
  card_stolen: [
    '{subject} steals from {victim} — steal #{stealNumber} tonight.',
  ],
  game_started: [
    '{first} opens the table. May the least delusional win.',
    'Cards dealt. {first} leads off.',
  ],
  player_joined: [
    '{subject} joined. Two phones, one code, zero mercy.',
  ],
  win: [
    '{subject} wins — {winnerSets} to {loserSets} over {loser}.',
    'Game over. {subject} on top.',
  ],
  intervention: [
    '{subject} is at level {level}/10. Water, not booze.',
  ],
};

function fillTemplate(tpl, gameEvent) {
  const { subjectName, opponentName, facts = {}, memory } = gameEvent;
  const st = memory?.subject || {};
  const rankCount = facts.rankCount || facts.count || 0;
  const near = rankCount === 3
    ? `One card away from completing ${facts.card || 'that collection'}.`
    : '';
  const streak = st.denialStreak >= 3
    ? `${st.denialStreak} denials in a row.`
    : '';
  const lead = facts.tookLead
    ? `${subjectName} just took the lead.`
    : '';
  const recall = memoryRecallLine(gameEvent);
  const setPlural = (facts.setCount || 1) > 1 ? 's' : '';
  const drinkPlural = (facts.total || 1) !== 1 ? 's' : '';
  const reasonShort = String(facts.reason || 'a penalty').split('—')[0].trim().slice(0, 60);

  return tpl
    .replaceAll('{subject}', subjectName)
    .replaceAll('{target}', facts.targetName || opponentName)
    .replaceAll('{opponent}', opponentName)
    .replaceAll('{victim}', facts.victimName || opponentName)
    .replaceAll('{asker}', facts.askerName || opponentName)
    .replaceAll('{card}', facts.card || 'that card')
    .replaceAll('{count}', String(facts.count || 1))
    .replaceAll('{rankCount}', String(rankCount))
    .replaceAll('{handCount}', String(facts.handCount || 0))
    .replaceAll('{denialNumber}', String(facts.denialNumber || st.denials || 1))
    .replaceAll('{denialStreak}', String(facts.denialStreak || st.denialStreak || 0))
    .replaceAll('{total}', String(facts.total || st.drinksOwed || 1))
    .replaceAll('{added}', String(facts.added || 1))
    .replaceAll('{setCount}', String(facts.setCount || 1))
    .replaceAll('{stealNumber}', String(facts.stealNumber || 1))
    .replaceAll('{first}', facts.firstName || subjectName)
    .replaceAll('{loser}', facts.loserName || opponentName)
    .replaceAll('{winnerSets}', String(facts.winnerSets ?? 0))
    .replaceAll('{loserSets}', String(facts.loserSets ?? 0))
    .replaceAll('{level}', String(facts.drunkLevel || '?'))
    .replaceAll('{near}', near)
    .replaceAll('{streak}', streak)
    .replaceAll('{lead}', lead)
    .replaceAll('{recall}', recall)
    .replaceAll('{setPlural}', setPlural)
    .replaceAll('{drinkPlural}', drinkPlural)
    .replaceAll('{reasonShort}', reasonShort)
    .replace(/\s+/g, ' ')
    .trim();
}

export function eventAnchoredFallback(ctx = {}) {
  const gameEvent = ctx.gameEvent;
  if (!gameEvent?.type) return fallbackGeneric(ctx);

  const bank = FALLBACK[gameEvent.type];
  if (!bank?.length) return fallbackGeneric(ctx);

  const tpl = bank[Math.floor(Math.random() * bank.length)];
  const line = fillTemplate(tpl, gameEvent);
  return line.length > 100 ? `${line.slice(0, 97)}…` : line;
}

function fallbackGeneric(ctx) {
  const name = shortName(ctx.player?.name);
  return `${name} did something on the table. The bartender saw it — details pending.`;
}

export function formatGameEventForPrompt(gameEvent) {
  if (!gameEvent) return 'No game event — do not invent one.';
  const lines = [
    'GAME EVENT (anchor every sentence to these facts):',
    `Type: ${gameEvent.type}`,
    `Focus player: ${gameEvent.subjectName}`,
    `Other player: ${gameEvent.opponentName}`,
    '',
    'What happened:',
  ];

  for (const [k, v] of Object.entries(gameEvent.facts || {})) {
    if (v != null && v !== '') lines.push(`- ${k}: ${v}`);
  }

  const st = gameEvent.memory?.subject;
  if (st) {
    lines.push('', 'Player memory stats (use when relevant — do not invent):');
    lines.push(`- Total denials tonight: ${st.denials}`);
    lines.push(`- Current denial streak: ${st.denialStreak}`);
    lines.push(`- Successful bluffs: ${st.successfulBluffs}`);
    lines.push(`- Failed bluffs: ${st.failedBluffs}`);
    lines.push(`- Collections completed: ${st.setsCompleted}`);
    lines.push(`- Pond draws: ${st.pondDraws}`);
    lines.push(`- Biggest hand reached: ${st.biggestHand}`);
    lines.push(`- Drinks currently owed: ${st.drinksOwed}`);
    lines.push(`- Card steals: ${st.steals}`);
  }

  const recall = memoryRecallLine(gameEvent);
  if (recall) lines.push('', `Memory callback suggestion: ${recall}`);

  return lines.join('\n');
}

function awardEntry(key, label, emoji, playerName, detail, playerId = null) {
  if (!playerName || !detail) return null;
  return { key, label, emoji, playerName, detail, playerId };
}

/** End-of-round scoreboard from bartender memory + final sets. */
export function buildGameRecap(room) {
  const mem = getBartenderMemory(room);
  const humans = (room.players || []).filter((p) => !p.isBot);
  const rows = humans.map((p) => {
    const st = playerStats(mem, p.id);
    const sets = room.game?.player(p.id)?.books?.length ?? 0;
    return {
      id: p.id,
      name: shortName(p.name),
      fullName: p.name,
      sets,
      stats: { ...st },
    };
  });

  const bySets = [...rows].sort((a, b) => b.sets - a.sets);
  const winnerRow = room.winnerId
    ? rows.find((r) => r.id === room.winnerId) || bySets[0]
    : bySets[0];
  const loserRow = rows.find((r) => r.id !== winnerRow?.id) || bySets[1] || bySets[0];

  const pickMax = (field, min = 1) => {
    const top = [...rows].sort((a, b) => (b.stats[field] || 0) - (a.stats[field] || 0));
    const val = top[0]?.stats[field] || 0;
    if (val < min) return null;
    const tied = top.filter((r) => (r.stats[field] || 0) === val);
    return { row: tied[0], value: val, tied: tied.length > 1 };
  };

  const awards = [];

  const bestLiar = pickMax('successfulBluffs', 1);
  if (bestLiar) {
    awards.push(awardEntry(
      'best_liar',
      'Best Liar',
      '🎭',
      bestLiar.row.name,
      bestLiar.tied
        ? `${bestLiar.value} bluffs landed (tie)`
        : `${bestLiar.value} bluff${bestLiar.value === 1 ? '' : 's'} landed`,
      bestLiar.row.id,
    ));
  }

  const bullshit = pickMax('failedBluffs', 1);
  if (bullshit && bullshit.row.id !== bestLiar?.row?.id) {
    awards.push(awardEntry(
      'bullshit',
      'Bullshit Award',
      '🚨',
      bullshit.row.name,
      `${bullshit.value} lie${bullshit.value === 1 ? '' : 's'} caught`,
      bullshit.row.id,
    ));
  }

  const pond = pickMax('pondDraws', 2);
  if (pond) {
    awards.push(awardEntry(
      'pond_rat',
      'Pond Rat',
      '🎣',
      pond.row.name,
      `${pond.value} draws from the pond`,
      pond.row.id,
    ));
  }

  const hoarder = pickMax('biggestHand', 5);
  if (hoarder) {
    awards.push(awardEntry(
      'hoarder',
      'Card Hoarder',
      '🃏',
      hoarder.row.name,
      `Peak hand: ${hoarder.value} cards`,
      hoarder.row.id,
    ));
  }

  const thief = pickMax('steals', 1);
  if (thief) {
    awards.push(awardEntry(
      'thief',
      'Pickpocket',
      '🫳',
      thief.row.name,
      `${thief.value} steal${thief.value === 1 ? '' : 's'}`,
      thief.row.id,
    ));
  }

  if (winnerRow) {
    awards.unshift(awardEntry(
      'winner',
      'Winner',
      '🏆',
      winnerRow.name,
      `${winnerRow.sets} set${winnerRow.sets === 1 ? '' : 's'} banked`,
      winnerRow.id,
    ));
  }
  if (loserRow && loserRow.id !== winnerRow?.id) {
    awards.push(awardEntry(
      'loser',
      'Loser',
      '💀',
      loserRow.name,
      `${loserRow.sets} set${loserRow.sets === 1 ? '' : 's'} — cooked`,
      loserRow.id,
    ));
  }

  const catId = room.cardCategories?.[0] || 'filthy';
  const cat = categoryMeta(catId);

  return {
    winner: winnerRow ? { id: winnerRow.id, name: winnerRow.name, sets: winnerRow.sets } : null,
    loser: loserRow ? { id: loserRow.id, name: loserRow.name, sets: loserRow.sets } : null,
    awards: awards.filter(Boolean),
    categoryId: catId,
    categoryLabel: cat.label,
    categoryEmoji: cat.emoji,
    scores: rows.map((r) => ({ name: r.name, sets: r.sets, id: r.id })),
  };
}

export function formatRecapForPrompt(recap) {
  if (!recap) return 'No recap stats.';
  const lines = [
    'ROUND RECAP (use these facts — do not invent):',
    recap.categoryLabel ? `Category played: ${recap.categoryEmoji || ''} ${recap.categoryLabel}`.trim() : '',
    recap.winner ? `Winner: ${recap.winner.name} (${recap.winner.sets} sets)` : '',
    recap.loser ? `Loser: ${recap.loser.name} (${recap.loser.sets} sets)` : '',
    '',
    'Awards:',
  ];
  for (const a of recap.awards || []) {
    lines.push(`- ${a.label}: ${a.playerName} — ${a.detail}`);
  }
  return lines.filter(Boolean).join('\n');
}
