// Bartender game system — triggers, modes, cached lines, NIM gate.
// Cards → Players → Action → Bartender (commentator pop-in, not chat log).

import { memoryRecallLine } from './bartender-memory.js';

export const BARTENDER_MODES = ['roast', 'hype', 'rivalry', 'chaos', 'drunk'];

/** Rare peaks only — ~90% silence at the table */
const ALWAYS_SPEAK = new Set([
  'set_pending',
  'set_completed',
  'win',
  'bluff_caught',
  'intervention',
]);

const MANUAL_PREFIX = 'manual_';

/** Events that never get bartender commentary (routine table noise). */
const NEVER_SPEAK = new Set(['pond_draw']);

function scoresClose(room) {
  if (!room?.game || room.players.length < 2) return false;
  const counts = room.players.map((p) => room.game.player(p.id)?.books?.length ?? 0);
  return Math.abs(counts[0] - counts[1]) <= 1 && Math.max(...counts) >= 1;
}

export function shouldBartenderSpeak(gameEvent, room = {}) {
  if (!gameEvent?.type) return false;
  const type = gameEvent.type;
  if (NEVER_SPEAK.has(type)) return false;
  if (ALWAYS_SPEAK.has(type)) return true;
  if (type.startsWith(MANUAL_PREFIX)) return true;

  const st = gameEvent.memory?.subject;
  const facts = gameEvent.facts || {};

  switch (type) {
    case 'ask_denied':
      return (st?.denialStreak ?? 0) >= 6;
    case 'ask_success':
      return (facts.count ?? 0) >= 3 && (facts.rankCount ?? 0) >= 3;
    case 'lucky_draw':
      return false;
    case 'bluff_success':
      return (st?.successfulBluffs ?? 0) >= 4 && Math.random() < 0.2;
    case 'drink_debt':
      return (facts.total ?? 0) >= 4;
    case 'card_stolen':
      return (facts.count ?? 0) >= 3;
    case 'hand_milestone':
      return (facts.handCount ?? 0) >= 12;
    case 'pond_draw':
      return (facts.drawn ?? 0) >= 3;
    default:
      return false;
  }
}

export function resolveBartenderMode(gameEvent, room, { drunkLevel = 0 } = {}) {
  const type = gameEvent?.type || '';
  const facts = gameEvent?.facts || {};

  if (type === 'intervention' || drunkLevel >= 7) return 'drunk';
  if (drunkLevel >= 4 && Math.random() < 0.25) return 'drunk';
  if (scoresClose(room) && ['ask_success', 'set_completed', 'card_stolen', 'ask_denied'].includes(type)) {
    return 'rivalry';
  }
  if (type === 'set_pending') return 'hype';
  if (['set_completed', 'lucky_draw', 'ask_success'].includes(type) && ((facts.count ?? 0) >= 2 || facts.oneFromCollection)) {
    return 'hype';
  }
  if (['ask_denied', 'bluff_caught', 'hand_milestone'].includes(type)) return 'roast';
  if (type.startsWith(MANUAL_PREFIX) && type.includes('roast')) return 'roast';
  if (Math.random() < 0.08) return 'chaos';
  if (['bluff_caught', 'ask_denied'].includes(type)) return 'roast';
  return 'roast';
}

export function shouldUseNIM(gameEvent, mode, room = {}) {
  const type = gameEvent?.type || '';
  const big = ['win', 'game_started', 'set_completed', 'bluff_caught', 'intervention', 'player_joined'];
  if (big.includes(type)) return true;
  if (type.startsWith(MANUAL_PREFIX)) return true;
  if (mode === 'rivalry' && scoresClose(room)) return true;
  const st = gameEvent?.memory?.subject;
  if (type === 'ask_denied' && (st?.denialStreak ?? 0) >= 5) return true;
  if (type === 'win') return true;
  if (mode === 'recap') return true;
  return false;
}

export function truncateBartenderLine(text, max = 88) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function splitBartenderCopy(text) {
  const full = String(text || '').replace(/\s+/g, ' ').trim();
  const line = truncateBartenderLine(full);
  return { line, full };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(tpl, gameEvent, room = {}) {
  const { subjectName, opponentName, facts = {}, memory } = gameEvent || {};
  const st = memory?.subject || {};
  const turn = room.turnCount || 0;
  const recall = memoryRecallLine(gameEvent);

  return tpl
    .replaceAll('{subject}', subjectName || 'Player')
    .replaceAll('{target}', facts.targetName || opponentName || 'them')
    .replaceAll('{opponent}', opponentName || 'them')
    .replaceAll('{victim}', facts.victimName || opponentName || 'them')
    .replaceAll('{asker}', facts.askerName || opponentName || 'them')
    .replaceAll('{card}', facts.card || 'that card')
    .replaceAll('{count}', String(facts.count || 1))
    .replaceAll('{handCount}', String(facts.handCount || 0))
    .replaceAll('{denialStreak}', String(facts.denialStreak || st.denialStreak || 0))
    .replaceAll('{setCount}', String(facts.setCount || st.setsCompleted || 1))
    .replaceAll('{turn}', String(turn))
    .replaceAll('{level}', String(facts.drunkLevel || 0))
    .replaceAll('{recall}', recall ? ` ${recall}` : '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LINE_BANK = {
  roast: [
    '{subject} just got fucking robbed.',
    '{subject} spent a whole turn accomplishing absolutely nothing.',
    '{turn} turns in and {subject} is still collecting Ls.',
    '{subject} asked for {card}. Got denied. Shocking.',
    '{denialStreak} misses in a row — {subject} is conducting research on failure.',
    'Confidence no longer detected from {subject}.',
    '{subject} and the pond are in a committed relationship now.',
    'That ask had the energy of a drunk text at 2am.',
    '{subject} just donated another turn to the void.',
    'Poor decision making — now with cardboard.',
  ],
  hype: [
    'That\'s {count} cards — someone call the fucking authorities.',
    '{subject} just hit {subject} with a four-piece combo.',
    'Clean theft. {target} didn\'t stand a chance.',
    '{subject} is one card away from a set — lock in.',
    'The table felt that one.',
    '{subject} stays on the attack. Respect.',
    'That\'s how you punish a bad defense.',
    '{count} cards delivered — {target} is bleeding.',
  ],
  rivalry: [
    'These two are fighting over cardboard like it\'s a custody battle.',
    '{subject} and {opponent} — somehow both losing, somehow both winning.',
    'Scores tied. Egos not.',
    'This is becoming a documentary about poor decision making.',
    'Neither of them will admit they\'re evenly matched disasters.',
    'Close game. Closer egos.',
  ],
  chaos: [
    'Nobody asked for this card. Nobody wanted this card. Yet here we are.',
    'The deck has opinions tonight.',
    'Chaos is a flat circle and we\'re on lap three.',
    'I didn\'t write this script. I\'m just narrating the crash.',
    'Somewhere a game designer is crying.',
  ],
  drunk: [
    'Still functional. Barely.',
    'Decision quality is beginning to decline.',
    'This strategy session has become interpretive art.',
    'Water exists. Just saying.',
    'The BAC meter is trending the wrong direction.',
    '{subject} — level {level}. Sit down hero.',
  ],
};

const EVENT_LINES = {
  set_pending: [
    '{subject} has four — tap CREATE SET before {opponent} cries.',
    'Bank it, {subject}. {opponent} is watching the meltdown loading.',
  ],
  set_completed: [
    '{subject} locked {card}. {opponent} is still organizing excuses.',
    'Set complete — {subject} takes another trophy.',
  ],
  bluff_caught: [
    'Bluff detected. The confidence was impressive. The execution was not.',
    '{subject} got caught lying about {card}. Drink up.',
  ],
  card_stolen: [
    '{subject} just yoinked from {victim}. Emotionally devastating.',
    'Aggressive steal from {subject}. No notes.',
  ],
  win: [
    '{subject} wins. {opponent} takes the L.',
    'Game over — {subject} on top.',
  ],
  game_started: [
    '{subject} opens the table. May the least delusional win.',
    'Cards dealt. Drama loading.',
  ],
  lucky_draw: [
    'Denied, then the pond delivered. {subject} catches a break.',
    'Lucky draw — {subject} goes again.',
  ],
  ask_denied: [
    '{subject} got denied on {card}. Go fish, go cry.',
    '{target} said no. {subject} draws from the pond.',
  ],
  ask_success: [
    '{target} handed over {count}. {subject} stays dangerous.',
    '{subject} got {count}× {card}. Go again.',
  ],
};

export function pickCachedLine(mode, gameEvent, room = {}, { avoid } = {}) {
  const eventBank = EVENT_LINES[gameEvent?.type];
  const modeBank = LINE_BANK[mode] || LINE_BANK.roast;
  const pool = eventBank?.length ? [...eventBank, ...modeBank] : modeBank;
  const avoidNorm = avoid ? String(avoid).trim() : '';
  for (let i = 0; i < 6; i++) {
    const line = fill(pick(pool), gameEvent, room);
    if (!avoidNorm || line !== avoidNorm) return line;
  }
  return fill(pick(pool), gameEvent, room);
}

export function appendEventLog(room, entry) {
  const mem = room.bartenderMemory;
  if (!mem) return;
  if (!mem.eventLog) mem.eventLog = [];
  mem.eventLog.push({ at: Date.now(), turn: room.turnCount || 0, ...entry });
  if (mem.eventLog.length > 24) mem.eventLog.shift();
}

export function derivePlayerTraits(player, stats = {}) {
  const q = player?.questionnaire || {};
  const traits = [];
  if (stats.denialStreak >= 3) traits.push('always fishes wrong');
  if (stats.successfulBluffs >= 2) traits.push('bluffer');
  if (stats.setsCompleted >= 2) traits.push('competitive');
  if (stats.steals >= 2) traits.push('aggressive');
  if (stats.failedBluffs >= 2) traits.push('bad liar');
  if (stats.pondDraws >= 5) traits.push('pond regular');
  if (q.vibe === 'chaos' || q.intensity === 'wild') traits.push('chaotic');
  if (player?.playRole === 'dom') traits.push('trash talker');
  if (!traits.length) traits.push('unpredictable');
  return [...new Set(traits)].slice(0, 4);
}

export function formatMemoryForPrompt(room, gameEvent) {
  const mem = room.bartenderMemory;
  const lines = [`Turn ${room.turnCount || 0} on the table.`];
  if (mem?.eventLog?.length) {
    lines.push('Recent events (reference ONE if relevant):');
    for (const e of mem.eventLog.slice(-6)) {
      lines.push(`- Turn ${e.turn}: ${e.summary}`);
    }
  }
  for (const p of room.players || []) {
    const st = mem?.players?.[p.id];
    if (!st) continue;
    const traits = derivePlayerTraits(p, st);
    lines.push(`${p.name.split(' ')[0]}: ${st.setsCompleted} sets, ${st.denials} misses, ${st.steals} steals, streak ${st.denialStreak || st.winStreak || 0}. Traits: ${traits.join(', ')}.`);
  }
  if (scoresClose(room)) lines.push('Scores are neck-and-neck — rivalry energy.');
  return lines.join('\n');
}

export function summarizeEventForLog(gameEvent) {
  const { type, subjectName, facts = {} } = gameEvent || {};
  switch (type) {
    case 'ask_denied': return `${subjectName} missed on ${facts.card || 'a card'}`;
    case 'ask_success': return `${subjectName} stole ${facts.count || 1} from ${facts.targetName}`;
    case 'set_pending': return `${subjectName} can bank ${facts.card || 'a set'}`;
    case 'set_completed': return `${subjectName} completed ${facts.card || 'a set'}`;
    case 'bluff_caught': return `${subjectName} got caught bluffing`;
    case 'card_stolen': return `${subjectName} stole from ${facts.victimName}`;
    case 'lucky_draw': return `${subjectName} lucky pond draw`;
    default: return `${subjectName} — ${type}`;
  }
}

export function bartenderStingMode(mode) {
  return {
    roast: 'record',
    hype: 'airhorn',
    rivalry: 'crowd',
    chaos: 'scratch',
    drunk: 'glass',
  }[mode] || 'glass';
}
