// ===========================================================================
//  ROOMS — authoritative real-time multiplayer for "Go Fuck Yourself".
//  Each phone is one player. The server owns the deck + game state and pushes
//  a *personalized* snapshot to every connected client (you only ever see
//  your own hand). Reconnect is supported via a per-player token.
// ===========================================================================
import { randomUUID } from 'node:crypto';
import { GoFishGame, rankName, rankTitle, rankDare, rankMeta, rankAskPhrase, deckCatalog, ranksForCategories } from '../../frontend/js/game.js';
import { DEFAULT_CATEGORIES, sanitizeCategories, categoryMeta } from '../../frontend/js/card-categories.js';
import { playerStatus } from '../../frontend/js/bac.js';
import { questionnaireComplete, parseKinkRank, KINK_RANK_OPTIONS } from '../../frontend/js/questionnaire.js';
import { createMockPartner, pickBotAskRank, botAskLine, delay } from './bot.js';
import {
  checkTierCrossing, personalizeDare, pickWheelEvent, queueDrink, queueDrinksForAll, triggerCheersForSet, profileOf,
} from './drinking.js';
import {
  applySetReward, checkDrinkMilestones, economySnapshot, imposeDrinkPenalty,
  initPlayerEconomy, initRoomEconomy, maybeBartenderDeal, queueSetRewardChoice,
  reduceDrinkDebt, addDrinkDebt, resolveDealOffer, resolveDebtChoice, resolveGiftDrink,
  resolveLastCall, resolveSplitOrTake, setHouseRule, SET_REWARDS, tickRiskDebt,
  useAssignToken, useThiefToken, grantTokens, consumeToken,
} from './drink-economy.js';
import { sanitizeDeviceBoundary } from './content-boundaries.js';
import {
  initBluffState, recordLie, grantAskAgainToken, consumeAskAgainToken,
  findActiveLie, markLieCaught, markLieSurvived, pickSuspicionLine,
  bluffStatsFor,
} from './bluff.js';
import {
  applyBottleEffect, checkSuddenDeathTrigger, initBottleChaos, queueBottleChaos,
  resolveFateChoice, shouldTriggerPeriodic,
} from './bottle-chaos.js';
import {
  initBartenderMemory,
  recordAskDenied,
  recordAskSuccess,
  recordLuckyDraw,
  recordSetCompleted,
  recordSetPending,
  recordBluffCaught,
  recordBluffSuccess,
  recordDrinkDebt,
  recordCardStolen,
  recordGameStarted,
  recordPlayerJoined,
  recordWin,
  recordIntervention,
  recordManualAction,
  buildGameRecap,
  formatRecapForPrompt,
} from './bartender-memory.js';
import {
  shouldBartenderSpeak,
  resolveBartenderMode,
  shouldUseNIM,
  pickCachedLine,
  splitBartenderCopy,
  appendEventLog,
  summarizeEventForLog,
  derivePlayerTraits,
} from './bartender-engine.js';

const CHAOS_CARDS = { wheel: { label: 'Chaos Wheel', hint: 'Spin the wheel of filth.' } };

const rooms = new Map(); // code -> room
const MAX_PLAYERS = 2;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6h idle cleanup

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sanitizeProfile(p = {}) {
  const name = String(p.name || 'Player').trim().slice(0, 40) || 'Player';
  const inferred = (() => {
    const n = name.toLowerCase();
    if (n.includes('nandini')) return 'sub';
    if (n.includes('kunal')) return 'dom';
    return null;
  })();
  const playRole = inferred || (p.playRole === 'sub' ? 'sub' : 'dom');
  return {
    name,
    playRole,
    sex: (() => {
      const s = String(p.sex || 'male').toLowerCase();
      if (s.startsWith('f')) return 'female';
      if (s === 'other') return 'other';
      return 'male';
    })(),
    age: clampNum(p.age, 21, 99, 25),
    heightCm: clampNum(p.heightCm, 120, 230, 170),
    weightKg: clampNum(p.weightKg, 35, 250, 70),
    questionnaire: typeof p.questionnaire === 'object' && p.questionnaire ? trimQ(p.questionnaire) : {},
  };
}
function trimQ(q) {
  const allowedRank = new Set(KINK_RANK_OPTIONS.map((o) => o.id));
  const out = {};
  for (const [k, v] of Object.entries(q)) {
    if (k === 'kinkRank') {
      const ids = parseKinkRank(v).filter((id) => allowedRank.has(id));
      if (ids.length) out.kinkRank = ids.join(',');
      continue;
    }
    if (v && String(v).trim()) out[String(k).slice(0, 30)] = String(v).slice(0, 80);
  }
  return out;
}
function clampNum(v, lo, hi, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

let eventSeq = 0;
let hostLineFn = async () => '';

export function attachRooms(wss, { getHostLine }) {
  if (typeof getHostLine === 'function') hostLineFn = getHostLine;
  setInterval(cleanupRooms, 10 * 60 * 1000).unref?.();

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      handle(ws, msg).catch((err) => {
        console.error('[rooms]', err);
        send(ws, { t: 'error', message: 'Something fucked up on the server.' });
      });
    });
    ws.on('close', () => onDisconnect(ws));
  });

  // heartbeat to drop dead sockets
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30000);
  hb.unref?.();
}

async function handle(ws, msg) {
  switch (msg.t) {
    case 'create': return createRoom(ws, msg);
    case 'join': return joinRoom(ws, msg);
    case 'rejoin': return rejoinRoom(ws, msg);
    case 'start': return startRoom(ws, msg);
    case 'setCategories': return doSetCategories(ws, msg);
    case 'ask': return doAsk(ws, msg);
    case 'bluffRespond': return doBluffRespond(ws, msg);
    case 'createSet': return doCreateSet(ws);
    case 'logDrink': return doLogDrink(ws, msg);
    case 'skipDrink': return doSkipDrink(ws);
    case 'dareChicken': return doDareChicken(ws, msg);
    case 'sideGameLoss': return doSideGameLoss(ws, msg);
    case 'hostAction': return doHostAction(ws, msg);
    case 'react': return doReact(ws, msg);
    case 'resolveChaos': return doResolveChaos(ws, msg);
    case 'penaltyStart': return doPenaltyStart(ws, msg);
    case 'penaltyPick': return doPenaltyPick(ws, msg);
    case 'penaltyDetail': return doPenaltyDetail(ws, msg);
    case 'penaltyConfirm': return doPenaltyConfirm(ws, msg);
    case 'playAgain': return doPlayAgain(ws);
    case 'leave': return onDisconnect(ws);
    case 'debtChoice': return doDebtChoice(ws, msg);
    case 'splitOrTake': return doSplitOrTake(ws, msg);
    case 'lastCall': return doLastCall(ws, msg);
    case 'dealOffer': return doDealOffer(ws, msg);
    case 'setReward': return doSetReward(ws, msg);
    case 'giftDrink': return doGiftDrink(ws, msg);
    case 'useDrinkToken': return doUseDrinkToken(ws, msg);
    case 'payDebt': return doPayDebt(ws, msg);
    case 'resolveBottleChaos': return doResolveBottleChaos(ws, msg);
    default: return;
  }
}

const FEED_MAX = 24;
const FLAVOR_LINES = {
  miss: [
    '{asker} is fishing in the wrong fucking pond.',
    '{target} said absolutely not. Embarrassing.',
    'Wrong ask. GO FUCK YOURSELF energy.',
    '{asker} got humbled in public.',
  ],
  hit: [
    '{asker} just robbed {target}.',
    '{target} handed over the goods like a good little bitch.',
    '{asker} is hoarding cards. Greedy fuck.',
    'That ask actually worked. Rare.',
  ],
  set: [
    'SET LOCKED. {asker} is running the table.',
    '{asker} completed a set — someone\'s drinking.',
    'Four of a kind. {asker} wins that round of shame.',
  ],
  draw: [
    '{asker} drew from the deck. Pain.',
    'Deck said fuck you. Drink up.',
  ],
};

function pickFlavor(pool, vars) {
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

function pushFeed(room, entry) {
  if (!room.feed) room.feed = [];
  room.feed.push({ id: randomUUID().slice(0, 8), at: Date.now(), ...entry });
  if (room.feed.length > FEED_MAX) room.feed.splice(0, room.feed.length - FEED_MAX);
}

function sanitizeGameMode(m) {
  return ['casual', 'drinking', 'savage'].includes(m) ? m : 'casual';
}

function isDrinkingMode(room) {
  return room.gameMode === 'drinking' || room.gameMode === 'savage';
}

function penalizeDrinksForAll(room, reason, extra = {}) {
  for (const p of room.players) {
    if (!p.isBot) penalizeDrink(room, p.id, reason, 1, extra);
  }
}

/** Drinking-mode penalties go through Drink Debt; casual uses legacy queue. */
function penalizeDrink(room, playerId, reason, baseCount = 1, extra = {}) {
  if (!isDrinkingMode(room)) return;
  return imposeDrinkPenalty(room, playerId, reason, baseCount, extra);
}

const STRIP_PRESETS = ['Shirt off 👕', 'Pants off 👖', 'Socks off 🧦', 'Wildcard — their pick 🎲'];
const DRINK_PRESETS = [
  { key: 'beer', label: 'Beer 🍺', detail: 'Beer — 330ml' },
  { key: 'wine', label: 'Wine 🍷', detail: 'Wine — one glass' },
  { key: 'shot', label: 'Shot 🥃', detail: 'Shot — 40ml' },
  { key: 'double', label: 'Double 🥃🥃', detail: 'Double shot' },
  { key: 'chug', label: 'Chug it 🍻', detail: 'Chug your drink' },
];

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
function createRoom(ws, msg) {
  if (!questionnaireComplete(msg.profile?.questionnaire)) {
    return send(ws, { t: 'error', message: 'Answer ALL six roast-fuel questions before creating a room.' });
  }
  const code = makeCode();
  const room = {
    code,
    players: [],
    game: null,
    started: false,
    finished: false,
    gameMode: sanitizeGameMode(msg.gameMode),
    cardCategories: sanitizeCategories(msg.cardCategories),
    hostText: "Room's open. Get your partner on the code, you degenerate.",
    hostMode: 'idle',
    hostBusy: false,
    pendingDrinks: [],
    pendingChaos: null,
    pendingPenalty: null,
    feed: [],
    reactions: [],
    lastEvent: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  initRoomEconomy(room);
  initBluffState(room);
  initBottleChaos(room);
  initBartenderMemory(room);
  pushFeed(room, {
    kind: 'system',
    text: `Room ${code} open — ${sanitizeGameMode(msg.gameMode)} mode · ${formatCategorySummary(room.cardCategories)}.`,
  });
  rooms.set(code, room);
  const player = addPlayer(room, ws, msg.profile, true);
  send(ws, { t: 'joined', you: { id: player.id, token: player.token, isHost: true }, code });
  broadcast(room);
}

function joinRoom(ws, msg) {
  const code = String(msg.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) return send(ws, { t: 'error', message: `No room "${code}". Check the fucking code.` });
  if (room.started) return send(ws, { t: 'error', message: 'That game already fucking started.' });
  if (room.players.length >= MAX_PLAYERS) return send(ws, { t: 'error', message: 'Room is full, fuck off.' });
  if (!questionnaireComplete(msg.profile?.questionnaire)) {
    return send(ws, { t: 'error', message: 'Answer ALL six roast-fuel questions — the bartender needs ammo.' });
  }
  const player = addPlayer(room, ws, msg.profile, false);
  send(ws, { t: 'joined', you: { id: player.id, token: player.token, isHost: false }, code });
  broadcast(room);
  void welcomeRoast(room, player);
}

async function welcomeRoast(room, player) {
  if (room.started || room.players.length < 2) return;
  const gameEvent = recordPlayerJoined(room, player);
  await announceGameEvent(room, gameEvent);
}

function rejoinRoom(ws, msg) {
  const code = String(msg.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) return send(ws, { t: 'error', message: 'That room is gone.', fatal: true });
  const player = room.players.find((p) => p.token === msg.token);
  if (!player) return send(ws, { t: 'error', message: 'Could not rejoin — start fresh.', fatal: true });
  bindSocket(player, ws, room.code);
  player.connected = true;
  send(ws, { t: 'joined', you: { id: player.id, token: player.token, isHost: player.isHost }, code });
  room.lastActivity = Date.now();
  broadcast(room);
}

function addPlayer(room, ws, profile, isHost) {
  const player = {
    id: randomUUID().slice(0, 8),
    token: randomUUID(),
    ...sanitizeProfile(profile),
    drinks: [],
    lastDrunkTier: 0,
    ws: null,
    connected: true,
    isHost,
  };
  initPlayerEconomy(player);
  room.players.push(player);
  bindSocket(player, ws, room.code);
  room.lastActivity = Date.now();
  return player;
}

function bindSocket(player, ws, code) {
  const prev = player.ws;
  if (prev && prev !== ws && prev.readyState <= WebSocket.OPEN) {
    try { prev.close(4000, 'replaced'); } catch { /* noop */ }
  }
  player.ws = ws;
  ws._roomCode = code;
  ws._playerId = player.id;
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function formatCategorySummary(categories) {
  const cats = sanitizeCategories(categories);
  const ranks = ranksForCategories(categories);
  const c = categoryMeta(cats[0]);
  return `${c.emoji} ${c.label} · ${ranks.length} situations`;
}

async function doSetCategories(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player?.isHost) return;
  if (room.started && !room.finished) return;
  const categories = sanitizeCategories(msg.categories);
  const ranks = ranksForCategories(categories);
  if (!ranks.length) {
    return send(ws, { t: 'error', message: 'Pick a category with cards in the deck.' });
  }
  room.cardCategories = categories;
  room.lastActivity = Date.now();
  const label = room.finished ? 'Next round' : 'Deck';
  pushFeed(room, { kind: 'system', text: `🎴 ${label}: ${formatCategorySummary(categories)}.` });
  if (room.finished) {
    room.hostText = `Next round: ${formatCategorySummary(categories)}. Host deals when ready.`;
  }
  broadcast(room);
}

async function finishGameRoom(room) {
  if (!room?.game) return;
  room.finished = true;
  room.winnerId = room.game.winnerId;
  const winner = room.players.find((p) => p.id === room.winnerId);
  const loser = room.players.find((p) => p.id !== room.winnerId);
  room.gameRecap = buildGameRecap(room);
  room.hostPopIn = true;
  broadcast(room);
  if (winner) {
    await announceGameEvent(room, recordWin(room, winner, loser));
    await runHost(room, 'recap', winner, {
      gameRecap: room.gameRecap,
      popIn: true,
      bartenderMode: 'hype',
      extra: formatRecapForPrompt(room.gameRecap),
    });
  }
}

async function startRoom(ws, msg = {}) {
  const { room, player } = ctxOf(ws);
  if (!room || !player?.isHost) return;
  if (room.started) return;

  const humans = room.players.filter((p) => !p.isBot);
  if (humans.length < 1) {
    return send(ws, { t: 'error', message: 'Where the fuck did you go?' });
  }

  // Only one human? Spawn a mock partner automatically — no second phone needed.
  if (humans.length < 2 && !room.players.some((p) => p.isBot)) {
    const bot = createMockPartner(room, player);
    room.hostText = `${bot.name} is in — mock partner, auto-plays. Chalo, let's go.`;
    broadcast(room);
  }

  if (room.players.length < 2) {
    return send(ws, { t: 'error', message: 'Still waiting on a player, fucker.' });
  }

  if (!room.cardCategories?.length) room.cardCategories = [...DEFAULT_CATEGORIES];
  const activeRanks = ranksForCategories(room.cardCategories);
  if (!activeRanks.length) {
    return send(ws, { t: 'error', message: 'Pick a category before starting.' });
  }

  room.classicRules = true;
  const dealCount = room.players.length >= 5 ? 4 : 5;
  room.game = new GoFishGame(room.players.map((p) => ({ id: p.id, name: p.name })), {
    categories: room.cardCategories,
    interactiveSets: true,
  });
  room.started = true;
  room.finished = false;
  room.pendingDrinks = [];
  room.pendingChaos = null;
  room.pendingPenalty = null;
  room.pendingCreateSet = null;
  initBluffState(room);
  initRoomEconomy(room);
  initBottleChaos(room);
  initBartenderMemory(room);
  room.setProgress = {};
  room.soloMode = room.players.some((p) => p.isBot);
  room.booksBanked = 0;
  room.feed = [];
  for (const p of room.players) {
    p.lastDrunkTier = 0;
    initPlayerEconomy(p);
  }
  const first = room.players.find((p) => p.id === room.game.current.id);
  setEvent(room, { kind: 'start', solo: room.soloMode });
  pushFeed(room, {
    kind: 'system',
    text: `🎴 Shuffled & dealt ${dealCount} cards each (${room.players.length >= 5 ? '5+ players' : '2–4 players'}). ${first.name.split(' ')[0]} goes first — clockwise.`,
  });
  room.hostText = `Cards dealt. ${first.name} is up first — don't choke, na.`;
  broadcast(room);
  await announceGameEvent(room, recordGameStarted(room, first));
  await maybeRunBot(room);
}

async function queueChaos(room, player, res) {
  const chaosType = res.chaosDraw;
  const meta = CHAOS_CARDS[chaosType];
  if (!meta) return;

  if (chaosType === 'wheel') {
    const ev = pickWheelEvent();
    await applyWheelEvent(room, player, ev);
    setEvent(room, { kind: 'wheel', eventId: ev.id, text: ev.text, playerId: player.id });
    pushFeed(room, { kind: 'chaos', text: `🎡 ${ev.text}` });
    broadcast(room);
    return;
  }

  const others = room.players.filter((p) => p.id !== player.id);
  const target = others[Math.floor(Math.random() * others.length)] || player;
  let challengeText = meta.hint;

  if (chaosType === 'bartender') {
    room.hostBusy = true;
    broadcast(room);
    try {
      challengeText = await hostLineFn({
        mode: 'dare',
        player: { name: player.name, sex: player.sex, age: player.age, playRole: player.playRole, questionnaire: player.questionnaire },
        targetPlayer: target.name,
        drunkLevel: playerStatus(profileOf(player), player.drinks).level,
        extra: 'Bartender card — short drink + silly challenge.',
      });
    } catch {}
    room.hostBusy = false;
    if (!challengeText) challengeText = 'Take a sip. Then explain why pineapple belongs on pizza.';
    challengeText = sanitizeDeviceBoundary(challengeText);
  } else if (chaosType === 'truth') {
    challengeText = `${target.name.split(' ')[0]} asks you a truth. Answer honestly.`;
  } else if (chaosType === 'dare') {
    challengeText = `Complete a dare from ${target.name.split(' ')[0]}.`;
  } else if (chaosType === 'roast') {
    challengeText = `${target.name.split(' ')[0]} gives you a challenge — accent, roast, or compliment everyone.`;
  } else if (chaosType === 'reverse_roast') {
    challengeText = `Bounce it back — ${target.name.split(' ')[0]} does YOUR challenge instead.`;
  }

  const subjectId = chaosType === 'reverse_roast' ? target.id : player.id;
  room.pendingChaos = {
    playerId: subjectId,
    chaosType,
    targetId: target.id,
    text: challengeText,
    label: meta.label,
  };
  room.hostText = challengeText.slice(0, 120);
  broadcast(room);
}

async function applyWheelEvent(room, player, ev) {
  const g = room.game;
  if (!g) return;
  const drinking = isDrinkingMode(room);

  switch (ev.id) {
    case 'all_drink':
      if (drinking) penalizeDrinksForAll(room, 'Chaos Wheel — everyone drinks.');
      break;
    case 'all_draw':
      for (const p of room.players) {
        g.drawFromDeck(p.id, 1);
      }
      break;
    case 'shot_round':
      if (drinking) penalizeDrinksForAll(room, 'Chaos Wheel — shot round.', { cheers: true });
      break;
    case 'cheers':
      if (drinking) penalizeDrinksForAll(room, 'Chaos Wheel — CHEERS!', { cheers: true });
      break;
    case 'double':
      setHouseRule(room, 'double');
      break;
    case 'house_reverse':
      setHouseRule(room, 'reverse');
      break;
    case 'house_mercy':
      setHouseRule(room, 'mercy');
      break;
    case 'house_chaos':
      setHouseRule(room, 'chaos');
      break;
    case 'safe':
      g.safeRound = true;
      setTimeout(() => { if (room.game) room.game.safeRound = false; }, 60000);
      break;
    default:
      break;
  }
  room.hostText = ev.text;
}

async function spinWheelFor(room, player) {
  const ev = pickWheelEvent();
  await applyWheelEvent(room, player, ev);
  setEvent(room, { kind: 'wheel', eventId: ev.id, text: ev.text, playerId: player.id });
  pushFeed(room, { kind: 'chaos', text: ev.text });
}

async function maybeTriggerBottleChaos(room) {
  if (!room?.started || room.finished || room.pendingBottleChaos) return false;
  if (!isDrinkingMode(room)) return false;

  let payload = null;
  const sudden = checkSuddenDeathTrigger(room);
  if (sudden) {
    payload = queueBottleChaos(room, { trigger: 'suddenDeath', targetId: sudden.targetId });
  } else if (shouldTriggerPeriodic(room)) {
    payload = queueBottleChaos(room, { trigger: 'periodic' });
  }
  if (!payload) return false;

  setEvent(room, { kind: 'bottleChaos', ...payload });
  pushFeed(room, { kind: 'chaos', text: `${payload.title} — bottle spins!` });
  room.hostText = `${payload.title} Everyone watch the bottle.`;
  broadcast(room);
  return true;
}

async function doResolveBottleChaos(ws, msg) {
  const { room } = ctxOf(ws);
  if (!room?.pendingBottleChaos) return;

  const chaos = { ...room.pendingBottleChaos };
  room.pendingBottleChaos = null;

  if (chaos.fateChoice && msg.fateChoice) {
    chaos.effect = resolveFateChoice(msg.fateChoice);
    chaos.fateChosen = msg.fateChoice;
  }

  applyBottleEffect(room, chaos, {
    penalizeDrink,
    penalizeDrinksForAll,
    isDrinkingMode,
  });

  const target = room.players.find((p) => p.id === chaos.targetId);
  setEvent(room, {
    kind: 'bottleResolved',
    ...chaos,
    effectLabel: chaos.effect?.label,
    effectGood: !!chaos.effect?.good,
  });
  pushFeed(room, {
    kind: 'chaos',
    text: `${target?.name.split(' ')[0] || 'Player'} — ${chaos.effect?.label || 'Chaos'}`,
  });
  room.hostText = `${chaos.title} → ${target?.name.split(' ')[0]}: ${chaos.effect?.label}`;
  broadcast(room);
  if (chaos.effect?.apply === 'steal' && target) {
    const victim = room.players.find((p) => p.id !== target.id);
    if (victim) {
      await announceGameEvent(room, recordCardStolen(room, target, victim, { count: 1 }));
    }
  }
  await resolveBotDrinks(room);
  await maybeRunBot(room);
}

function consumeSkipTurnIfNeeded(room) {
  const g = room.game;
  if (!g || g.finished) return false;
  const current = g.current;
  const skips = room.skipTurnQueue?.[current.id] || 0;
  if (skips <= 0) return false;

  room.skipTurnQueue[current.id] = skips - 1;
  g.advanceTurn();
  const p = room.players.find((x) => x.id === current.id);
  setEvent(room, {
    kind: 'turnSkipped',
    playerId: current.id,
    playerName: p?.name,
    source: 'bottle',
  });
  pushFeed(room, {
    kind: 'system',
    text: `💀 ${p?.name.split(' ')[0] || 'Player'} loses a turn — bottle chaos.`,
  });
  room.hostText = `${p?.name.split(' ')[0]} skips a turn. Bottle said so.`;
  broadcast(room);
  return true;
}

async function doResolveChaos(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !room.pendingChaos) return;
  if (room.pendingChaos.playerId !== player.id) return;

  const action = msg.action === 'skip' ? 'skip' : 'done';
  const chaos = room.pendingChaos;
  room.pendingChaos = null;

  if (action === 'skip') {
    if (isDrinkingMode(room)) {
      penalizeDrink(room, player.id, 'Skipped chaos card — drink up.', 2);
    } else {
      room.game.drawFromDeck(player.id, 2);
      pushFeed(room, { kind: 'system', text: `${player.name.split(' ')[0]} skipped — drew 2 cards.` });
    }
  } else {
    pushFeed(room, { kind: 'system', text: `${player.name.split(' ')[0]} completed ${chaos.label || 'chaos'}.` });
  }

  setEvent(room, { kind: 'chaosResolved', playerId: player.id, action, chaosType: chaos.chaosType });
  broadcast(room);
  await resolveBotDrinks(room);
  await maybeRunBot(room);
}

// ---------------------------------------------------------------------------
// Penalty — opponent picks strip / cards / drink on their device
// ---------------------------------------------------------------------------
function penaltyOptionsFor(room, drawType) {
  const drinking = isDrinkingMode(room);
  if (drawType === 'draw2' && drinking) return ['draw', 'drink'];
  return ['draw', 'strip'];
}

function penaltyView(room, player) {
  const p = room.pendingPenalty;
  if (!p) return null;
  const victim = room.players.find((x) => x.id === p.victimId);
  const chooser = room.players.find((x) => x.id === p.chooserId);
  const role = player.id === p.victimId ? 'victim' : player.id === p.chooserId ? 'chooser' : 'spectator';
  return {
    id: p.id,
    phase: p.phase,
    role,
    cardCount: p.cardCount,
    options: p.options,
    choice: p.choice,
    detail: p.detail,
    victimName: victim?.name?.split(' ')[0] || 'Them',
    chooserName: chooser?.name?.split(' ')[0] || 'Them',
    source: p.source,
    drawType: p.drawType,
    stripPresets: STRIP_PRESETS,
    drinkPresets: DRINK_PRESETS.map((d) => d.label),
  };
}

function advancePenaltyPick(room, choice) {
  const p = room.pendingPenalty;
  if (!p) return;
  p.choice = choice;
  if (choice === 'draw') {
    p.detail = `Take ${p.cardCount} cards 🂠`;
    p.phase = 'confirm';
  } else {
    p.phase = 'detail';
  }
}

async function maybeAutoPickPenalty(room) {
  const p = room.pendingPenalty;
  if (!p || p.phase !== 'pick') return;
  const chooser = room.players.find((x) => x.id === p.chooserId);
  if (!chooser?.isBot) return;
  await delay(700 + Math.random() * 600);
  if (!room.pendingPenalty || room.pendingPenalty.id !== p.id) return;
  let choice = 'draw';
  if (p.options.includes('strip') && Math.random() < 0.38) choice = 'strip';
  else if (p.options.includes('drink') && Math.random() < 0.32) choice = 'drink';
  advancePenaltyPick(room, choice);
  if (choice === 'strip') {
    room.pendingPenalty.detail = pick(STRIP_PRESETS);
    room.pendingPenalty.phase = 'confirm';
  } else if (choice === 'drink') {
    room.pendingPenalty.detail = pick(DRINK_PRESETS).detail;
    room.pendingPenalty.phase = 'confirm';
  }
  pushFeed(room, { kind: 'system', text: `🤖 ${chooser.name.split(' ')[0]} picked ${choice} for ${room.players.find((x) => x.id === p.victimId)?.name.split(' ')[0]}.` });
  broadcast(room);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function doPenaltyStart(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !room.started) return;
  if (room.pendingPenalty) return;

  const victim = room.players.find((p) => p.id === msg.victimId);
  if (!victim) return;
  const chooser = room.players.find((p) => p.id !== victim.id);
  if (!chooser) return;

  const drawType = String(msg.drawType || 'draw4').slice(0, 24);
  const cardCount = clampNum(msg.cardCount, 1, 25, 2);
  const options = Array.isArray(msg.options) && msg.options.length
    ? msg.options.filter((o) => ['draw', 'strip', 'drink'].includes(o))
    : penaltyOptionsFor(room, drawType);

  room.pendingPenalty = {
    id: randomUUID().slice(0, 8),
    victimId: victim.id,
    chooserId: chooser.id,
    cardCount,
    drawType,
    source: String(msg.source || 'uno').slice(0, 16),
    options,
    phase: 'pick',
    choice: null,
    detail: null,
    startedBy: player.id,
  };
  room.lastActivity = Date.now();
  pushFeed(room, {
    kind: 'system',
    text: `⚖️ ${victim.name.split(' ')[0]} owes a penalty — ${chooser.name.split(' ')[0]} picks.`,
  });
  setEvent(room, { kind: 'penaltyStart', victimId: victim.id, chooserId: chooser.id, cardCount });
  broadcast(room);
  await maybeAutoPickPenalty(room);
}

async function doPenaltyPick(ws, msg) {
  const { room, player } = ctxOf(ws);
  const p = room?.pendingPenalty;
  if (!p || p.phase !== 'pick' || p.chooserId !== player.id) return;
  const choice = msg.choice;
  if (!p.options.includes(choice)) return;

  advancePenaltyPick(room, choice);
  room.lastActivity = Date.now();
  const victim = room.players.find((x) => x.id === p.victimId);
  pushFeed(room, {
    kind: 'system',
    text: `${player.name.split(' ')[0]} chose ${choice} for ${victim?.name.split(' ')[0]}.`,
  });
  broadcast(room);
}

async function doPenaltyDetail(ws, msg) {
  const { room, player } = ctxOf(ws);
  const p = room?.pendingPenalty;
  if (!p || p.phase !== 'detail' || p.chooserId !== player.id) return;

  p.detail = String(msg.detail || '').trim().slice(0, 120);
  if (!p.detail) return;
  p.phase = 'confirm';
  room.lastActivity = Date.now();
  broadcast(room);
}

async function doPenaltyConfirm(ws, msg) {
  const { room, player } = ctxOf(ws);
  const p = room?.pendingPenalty;
  if (!p || p.phase !== 'confirm' || p.victimId !== player.id) return;

  const result = { ...p };
  room.pendingPenalty = null;
  room.lastActivity = Date.now();

  if (result.choice === 'draw' && result.source === 'gfy' && room.game) {
    room.game.drawFromDeck(result.victimId, result.cardCount);
  }
  if (result.choice === 'drink' && isDrinkingMode(room)) {
    penalizeDrink(room, result.victimId, result.detail || 'Penalty drink.');
  }

  setEvent(room, {
    kind: 'penaltyResolved',
    victimId: result.victimId,
    chooserId: result.chooserId,
    choice: result.choice,
    detail: result.detail,
    cardCount: result.cardCount,
    source: result.source,
    drawType: result.drawType,
  });
  pushFeed(room, {
    kind: 'system',
    text: `✓ ${player.name.split(' ')[0]} completed: ${result.detail || result.choice}`,
  });
  broadcast(room);
  await resolveBotDrinks(room);
  await maybeRunBot(room);
}

async function doAsk(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !room.started || room.finished || !player) return;
  if (player.isBot) return;
  if (room.game.current.id !== player.id) return send(ws, { t: 'error', message: "Not your fucking turn." });
  if (hasPending(room)) return;
  if (consumeSkipTurnIfNeeded(room)) {
    await maybeRunBot(room);
    return;
  }

  await processAsk(room, player, msg.targetId, msg.rank);
}

async function doBluffRespond(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !room.started || room.finished || !player) return;
  const pb = room.pendingBluff;
  if (!pb || pb.defenderId !== player.id) return;

  room.pendingBluff = null;
  room.lastActivity = Date.now();
  const asker = room.players.find((p) => p.id === pb.askerId);
  if (!asker) return;

  if (msg.truth) await finishAskTruth(room, asker, pb.defenderId, pb.rank, pb);
  else await finishAskLie(room, asker, pb.defenderId, pb.rank, pb);
}

async function bustDefenderIfLying(room, defenderId, rank, askerId) {
  const lie = findActiveLie(room, defenderId, rank);
  if (!lie) return null;

  const mult = lie.lieMultiplier || 1;
  const defender = room.players.find((p) => p.id === defenderId);
  markLieCaught(room, lie, { punishment: 'bottle' });

  if (consumeToken(defender, 'bluffShield', 1)) {
    setEvent(room, {
      kind: 'lieCaught',
      defenderId,
      defenderName: defender?.name,
      askerId,
      rank,
      turnNumber: lie.turnNumber,
      denialPhrase: lie.phrase,
      punishment: '🎭 Bluff Shield — bust negated',
      punishmentId: 'bluffShield',
      punishmentDetail: 'Bluff Shield blocked the bust',
      lieMultiplier: mult,
      revealHand: false,
    });
    pushFeed(room, {
      kind: 'system',
      text: `🛡️ ${defender?.name.split(' ')[0]} blocked the bust with Bluff Shield`,
    });
    room.hostText = `${defender?.name.split(' ')[0]} had a Bluff Shield — bottle spared them.`;
    broadcast(room);
    return lie;
  }

  const payload = queueBottleChaos(room, { trigger: 'bluff', targetId: defenderId });
  if (!payload) return lie;

  setEvent(room, {
    kind: 'bottleChaos',
    ...payload,
    defenderId,
    askerId,
    rank,
    turnNumber: lie.turnNumber,
    denialPhrase: lie.phrase,
    lieMultiplier: mult,
  });
  pushFeed(room, {
    kind: 'chaos',
    text: `${payload.title} — ${defender?.name.split(' ')[0]} spins for their punishment`,
  });
  room.hostText = `${payload.title} The bottle decides ${defender?.name.split(' ')[0]}'s fate.`;
  broadcast(room);
  const asker = room.players.find((p) => p.id === askerId);
  await announceGameEvent(room, recordBluffCaught(room, defender, asker, {
    card: rankTitle(rank),
    rank,
    phrase: lie.phrase,
  }));
  return lie;
}

async function finishAskTruth(room, asker, targetId, rank, meta = {}) {
  const res = room.game.giveRank(targetId, rank);
  if (res.error) return res;
  const caught = await bustDefenderIfLying(room, targetId, rank, asker.id);
  return publishAskResult(room, asker, res, { ...meta, outcome: 'truth', defenderReaction: 'give', bluffBusted: !!caught });
}

async function finishAskLie(room, asker, targetId, rank, meta = {}) {
  recordLie(room, {
    defenderId: targetId,
    askerId: asker.id,
    rank,
    turnNumber: meta.turnNumber,
    lieMultiplier: meta.lieMultiplier || 1,
  });
  grantAskAgainToken(room, asker.id, targetId, rank, (meta.lieMultiplier || 1) + 1);
  grantTokens(asker, { assign: 1 });
  markLieSurvived(room, targetId);
  const st = bluffStatsFor(room, targetId);
  const res = room.game.goFishAfterLie(rank);
  const suspicion = Math.random() < 0.1 ? pickSuspicionLine() : null;
  return publishAskResult(room, asker, res, {
    ...meta,
    outcome: 'lie',
    lied: true,
    defenderPhrase: 'Nope.',
    suspicion,
    masterBluff: st.masterBluff,
  });
}

async function finishAskGoFish(room, asker, targetId, rank, meta = {}) {
  const res = room.game.goFish(rank, targetId);
  return publishAskResult(room, asker, res, { ...meta, outcome: 'honestDenial', honestDenial: true });
}

async function publishAskResult(room, player, res, extra = {}) {
  if (res.error) {
    if (player.ws) send(player.ws, { t: 'error', message: res.error });
    return res;
  }

  room.lastActivity = Date.now();
  const drinking = isDrinkingMode(room);
  const safe = room.game?.safeRound;

  if (res.newBooks.length && drinking && !safe) {
    for (const r of res.newBooks) {
      logSetProgress(room, player, r);
    }
    queueSetRewardChoice(room, player.id);
    room.booksBanked = (room.booksBanked || 0) + res.newBooks.length;
    if (room.booksBanked % 2 === 0) await spinWheelFor(room, player);
  }
  if (res.goFuckYourself && drinking && !safe) {
    penalizeDrink(room, player.id, 'GO FUCK YOURSELF — draw one from the pond and drink.');
    if (room.gameMode === 'savage' && Math.random() < 0.28) await spinWheelFor(room, player);
  }

  const shortAsker = res.askerName.split(' ')[0];
  const shortTarget = res.targetName.split(' ')[0];

  if (res.pendingCreateSet) {
    room.pendingCreateSet = { playerId: player.id, rank: res.pendingCreateSet };
    pushFeed(room, {
      kind: 'set',
      text: `${shortAsker} has 4× ${rankTitle(res.pendingCreateSet)} — CREATE SET!`,
      askerId: player.id,
      rank: res.pendingCreateSet,
    });
  }

  setEvent(room, {
    kind: 'ask',
    askerId: player.id,
    targetId: res.targetId,
    askerName: res.askerName,
    targetName: res.targetName,
    rank: res.rank,
    scenario: res.rankName,
    gotCards: res.gotCards,
    goFuckYourself: res.goFuckYourself,
    drewAsked: res.drewAsked,
    newBooks: res.newBooks,
    pendingCreateSet: res.pendingCreateSet,
    gameOver: res.gameOver,
    outcome: extra.outcome || null,
    lied: !!extra.lied,
    honestDenial: !!extra.honestDenial,
    defenderReaction: extra.defenderReaction || null,
    defenderPhrase: extra.defenderPhrase || null,
    suspicion: extra.suspicion || null,
    masterBluff: !!extra.masterBluff,
    doubleDown: !!extra.doubleDown,
    cardCount: extra.cardCount || res.gotCards || 0,
  });

  if (res.drewAsked) {
    pushFeed(room, { kind: 'lucky', text: `Lucky draw — ${shortAsker} got ${rankTitle(res.rank)}! Go again.` });
  } else if (extra.outcome === 'lie') {
    pushFeed(room, { kind: 'gfy', text: `${shortTarget}: "Nope."` });
  } else if (res.goFuckYourself) {
    pushFeed(room, { kind: 'gfy', text: `${shortTarget}: "Go fuck yourself!"` });
  } else if (res.gotCards > 0) {
    pushFeed(room, {
      kind: 'give',
      text: `${shortTarget} handed over ${res.gotCards}× ${rankTitle(res.rank)}`,
      askerId: player.id,
      targetId: res.targetId,
    });
  }

  if (res.newBooks.length) {
    for (const r of res.newBooks) {
      pushFeed(room, {
        kind: 'set',
        text: `SET CREATED — ${shortAsker} locked ${rankTitle(r)}! 🏆`,
        askerId: player.id,
        rank: r,
      });
    }
  }

  if (extra.suspicion) {
    pushFeed(room, { kind: 'flavor', text: `🍸 Bartender noticed something off.` });
  }

  if (extra.masterBluff) {
    pushFeed(room, { kind: 'system', text: `🎭 ${res.targetName.split(' ')[0]} — MASTER BLUFF` });
  }

  const target = room.players.find((p) => p.id === res.targetId);

  if (res.gameOver) {
    room.winnerId = res.winnerId;
    room.game.winnerId = res.winnerId;
    await finishGameRoom(room);
    return res;
  }

  if (res.pendingCreateSet) {
    room.hostText = `${shortAsker} has four — tap CREATE SET!`;
    broadcast(room);
    await announceGameEvent(room, recordSetPending(room, player, {
      card: rankTitle(res.pendingCreateSet),
      rank: res.pendingCreateSet,
    }));
    if (player.isBot) await autoCreateSetForBot(room, player);
    return res;
  }

  if (res.newBooks.length) {
    const banked = res.newBooks.map((r) => rankTitle(r)).join(' & ');
    room.hostText = `SET CREATED — ${shortAsker} officially has ${banked}!`;
    broadcast(room);
    for (const r of res.newBooks) {
      await announceGameEvent(room, recordSetCompleted(room, player, {
        card: rankTitle(r),
        rank: r,
        setCount: room.game?.player(player.id)?.books.length || 1,
      }));
    }
  } else if (res.drewAsked) {
    room.hostText = `Lucky pond draw — ${shortAsker} pulled ${rankTitle(res.rank)}! Go again.`;
    broadcast(room);
    await announceGameEvent(room, recordLuckyDraw(room, player, {
      card: rankTitle(res.rank),
      rank: res.rank,
    }));
  } else if (extra.outcome === 'lie' && extra.lied) {
    room.hostText = `${shortTarget} denied it. Go fish.`;
    broadcast(room);
    await announceGameEvent(room, recordBluffSuccess(room, target, player, {
      card: rankTitle(res.rank),
      rank: res.rank,
    }));
  } else if (res.goFuckYourself) {
    room.hostText = extra.lied
      ? `${shortTarget} denied it. Go fish.`
      : `${shortTarget} had none. GO FUCK YOURSELF — draw one.`;
    broadcast(room);
    await announceGameEvent(room, recordAskDenied(room, player, target, {
      card: rankTitle(res.rank),
      rank: res.rank,
    }));
  } else if (res.gotCards > 0 && !extra.bluffBusted) {
    room.hostText = `${shortAsker} got ${res.gotCards}× ${rankTitle(res.rank)}. Go again.`;
    broadcast(room);
    await announceGameEvent(room, recordAskSuccess(room, player, target, {
      card: rankTitle(res.rank),
      rank: res.rank,
      count: res.gotCards,
    }));
  }

  await resolveBotDrinks(room);
  if (isDrinkingMode(room)) {
    const risk = tickRiskDebt(room);
    if (risk) {
      const p = room.players.find((x) => x.id === risk.playerId);
      pushFeed(room, { kind: 'system', text: `🍸 Deal lost — ${p?.name.split(' ')[0]} owes ${risk.amount} drinks` });
    }
    if (!hasPending(room) && !player.isBot) maybeBartenderDeal(room, player.id);
  }
  if (!hasPending(room)) await maybeTriggerBottleChaos(room);
  await maybeRunBot(room);
  return res;
}

async function processAsk(room, player, targetId, rank) {
  const g = room.game;
  const v = g.validateAsk(targetId, rank);
  if (v.error) {
    if (player.ws) send(player.ws, { t: 'error', message: v.error });
    return v;
  }

  room.askCounter = (room.askCounter || 0) + 1;
  room.turnCount = (room.turnCount || 0) + 1;
  const turnNumber = room.askCounter;
  const doubleDownMult = consumeAskAgainToken(room, player.id, targetId, rank);
  const doubleDown = doubleDownMult != null;
  const lieMultiplier = doubleDownMult || 1;

  room.lastActivity = Date.now();

  pushFeed(room, {
    kind: 'ask',
    text: `${player.name.split(' ')[0]}: "${rankAskPhrase(rank)}"`,
    askerId: player.id,
    targetId,
    rank,
  });

  const defender = room.players.find((p) => p.id === targetId);
  const meta = { turnNumber, doubleDown, lieMultiplier, cardCount: v.matchCount };

  if (v.matchCount === 0) {
    return finishAskGoFish(room, player, targetId, rank, meta);
  }

  if (room.classicRules !== false) {
    if (defender?.isBot) {
      await delay(500 + Math.random() * 400);
    }
    return finishAskTruth(room, player, targetId, rank, meta);
  }

  if (defender?.isBot) {
    await delay(500 + Math.random() * 400);
    const lie = Math.random() < 0.22;
    if (lie) return finishAskLie(room, player, targetId, rank, meta);
    return finishAskTruth(room, player, targetId, rank, meta);
  }

  room.pendingBluff = {
    askerId: player.id,
    defenderId: targetId,
    rank,
    cardCount: v.matchCount,
    turnNumber,
    doubleDown,
    lieMultiplier,
  };

  setEvent(room, {
    kind: 'askPending',
    askerId: player.id,
    targetId,
    askerName: player.name,
    targetName: defender.name,
    rank,
    scenario: rankName(rank),
    turnNumber,
    doubleDown,
    lieMultiplier,
    cardCount: v.matchCount,
  });

  room.hostText = doubleDown
    ? `${defender.name.split(' ')[0]} — DOUBLE DOWN? Truth or lie?`
    : `${defender.name.split(' ')[0]} — you have this card. Truth or lie?`;
  broadcast(room);
  return { pending: true };
}

async function resolveBotBluff(room) {
  const pb = room.pendingBluff;
  if (!pb) return false;
  const defender = room.players.find((p) => p.id === pb.defenderId);
  if (!defender?.isBot) return false;
  room.pendingBluff = null;
  const asker = room.players.find((p) => p.id === pb.askerId);
  if (!asker) return false;
  await delay(700 + Math.random() * 500);
  const lie = Math.random() < 0.22;
  if (lie) await finishAskLie(room, asker, pb.defenderId, pb.rank, pb);
  else await finishAskTruth(room, asker, pb.defenderId, pb.rank, pb);
  return true;
}

/** Auto-skip drink prompts for the mock partner so solo play keeps moving. */
async function resolveBotDrinks(room) {
  if (await resolveBotBluff(room)) return;

  let changed = false;
  for (const d of [...room.pendingDrinks]) {
    const p = room.players.find((x) => x.id === d.playerId);
    if (p?.isBot) {
      clearPendingFor(room, p.id);
      p.drinks.push({ name: 'Mock sip', volumeMl: 50, abv: 5, at: Date.now() });
      setEvent(room, { kind: 'drinkLogged', playerId: p.id, name: p.name, drink: 'mock sip (bot)', level: 0, bot: true });
      changed = true;
    }
  }
  if (room.pendingChaos) {
    const p = room.players.find((x) => x.id === room.pendingChaos.playerId);
    if (p?.isBot) {
      room.pendingChaos = null;
      changed = true;
    }
  }
  if (room.pendingPenalty) {
    const chooser = room.players.find((x) => x.id === room.pendingPenalty.chooserId);
    if (chooser?.isBot && room.pendingPenalty.phase === 'pick') {
      // maybeAutoPickPenalty handles bot chooser on start
    }
    const victim = room.players.find((x) => x.id === room.pendingPenalty.victimId);
    if (victim?.isBot && room.pendingPenalty.phase === 'confirm') {
      room.pendingPenalty = null;
      changed = true;
    }
  }
  if (room.drinkChoice?.playerId) {
    const p = room.players.find((x) => x.id === room.drinkChoice.playerId);
    if (p?.isBot) {
      const dc = room.drinkChoice;
      if (dc.type === 'splitOrTake') resolveSplitOrTake(room, p.id, 'take');
      else if (dc.type === 'debtChoice') resolveDebtChoice(room, p.id, 'save');
      else if (dc.type === 'setReward') {
        room.drinkChoice = null;
        addDrinkDebt(room.players.find((x) => x.id !== p.id), 2);
      } else room.drinkChoice = null;
      changed = true;
    }
  }
  if (room.pendingBottleChaos && room.soloMode) {
    await delay(3200);
    const chaos = { ...room.pendingBottleChaos };
    room.pendingBottleChaos = null;
    applyBottleEffect(room, chaos, { penalizeDrink, penalizeDrinksForAll, isDrinkingMode });
    const target = room.players.find((p) => p.id === chaos.targetId);
    setEvent(room, {
      kind: 'bottleResolved',
      ...chaos,
      effectLabel: chaos.effect?.label,
      effectGood: !!chaos.effect?.good,
    });
    pushFeed(room, {
      kind: 'chaos',
      text: `${target?.name.split(' ')[0] || 'Player'} — ${chaos.effect?.label || 'Chaos'}`,
    });
    changed = true;
  }
  if (changed) broadcast(room);
}

let botBusy = false;

async function maybeRunBot(room) {
  if (botBusy || !room?.started || room.finished || !room.game) return;
  await resolveBotDrinks(room);
  if (hasPending(room)) return;
  if (consumeSkipTurnIfNeeded(room)) return;

  const current = room.players.find((p) => p.id === room.game.current.id);
  if (!current?.isBot) return;

  botBusy = true;
  try {
    await delay(900 + Math.random() * 1100);
    if (!room.game || room.finished || room.game.current.id !== current.id) return;
    if (hasPending(room)) return;

    const human = room.players.find((p) => !p.isBot && p.connected);
    if (!human) return;

    const rank = pickBotAskRank(room.game, current.id);
    if (!rank) return;

    room.hostText = `${current.name}: "${botAskLine(rank)}"`;
    broadcast(room);
    await delay(600);

    await processAsk(room, current, human.id, rank);
  } finally {
    botBusy = false;
  }
}

async function doLogDrink(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const pending = room.pendingDrinks.find((d) => d.playerId === player.id);
  const drinkCount = pending?.drinkCount || 1;
  const d = msg.drink || {};
  const base = {
    name: String(d.name || 'Drink').slice(0, 60),
    volumeMl: clampNum(d.volumeMl, 1, 2000, 330),
    abv: clampNum(d.abv, 0, 96, 5),
    scanned: !!d.scanned,
    visionSource: d.visionSource ? String(d.visionSource).slice(0, 24) : null,
  };
  if (pending?.cheersToast && msg.cheersToast) {
    const said = String(msg.cheersToast).trim().slice(0, 120);
    pushFeed(room, {
      kind: 'cheers',
      text: `🍻 ${player.name.split(' ')[0]}: "${said}"`,
      playerId: player.id,
    });
  }
  const now = Date.now();
  for (let i = 0; i < drinkCount; i++) {
    player.drinks.push({ ...base, at: now + i });
  }
  clearPendingFor(room, player.id);
  reduceDrinkDebt(player, drinkCount);
  room.lastActivity = Date.now();

  const st = playerStatus(profileOf(player), player.drinks);
  const milestones = isDrinkingMode(room) ? checkDrinkMilestones(room, player) : [];
  setEvent(room, {
    kind: 'drinkLogged',
    playerId: player.id,
    name: player.name,
    drink: drinkCount > 1 ? `${base.name} ×${drinkCount}` : base.name,
    level: st.level,
    cheers: !!pending?.cheers,
    drinkCount,
    debt: player.drinkDebt,
    milestones: milestones.map((m) => ({ id: m.id, label: m.label })),
  });
  broadcast(room);

  if (isDrinkingMode(room)) {
    const crossing = checkTierCrossing(player);
    if (crossing) {
      const short = player.name.split(' ')[0];
      for (const p of room.players) {
        if (p.id === player.id || p.isBot) continue;
        penalizeDrink(room, p.id, `CHEERS — ${short} hit ${crossing.label}!`, 1, { cheers: true });
      }
      setEvent(room, {
        kind: 'tierCheers',
        playerId: player.id,
        name: player.name,
        tier: crossing.tier,
        level: crossing.level,
        label: crossing.label,
      });
      pushFeed(room, { kind: 'system', text: `🍻 ${short} crossed tier ${crossing.tier} — CHEERS!` });
      broadcast(room);
    }
    for (const m of milestones) {
      pushFeed(room, { kind: 'system', text: `🍸 ${m.label} — ${m.hostLine}` });
      setEvent(room, {
        kind: 'drinkMilestone',
        playerId: player.id,
        name: player.name,
        milestoneId: m.id,
        label: m.label,
      });
      broadcast(room);
    }
  }

  if (st.shouldStop) {
    const gameEvent = recordIntervention(room, player, { level: st.level });
    await announceGameEvent(room, gameEvent);
    setEvent(room, { kind: 'intervention', playerId: player.id, level: st.level });
    broadcast(room);
  }
  await maybeRunBot(room);
}

async function doSkipDrink(ws) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  clearPendingFor(room, player.id);
  setEvent(room, { kind: 'skipped', playerId: player.id, name: player.name });
  broadcast(room);
  await maybeRunBot(room);
}

async function doDareChicken(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !isDrinkingMode(room)) return;
  const reason = String(msg.reason || 'Chickened out on the dare — drink up.').slice(0, 120);
  penalizeDrink(room, player.id, reason, 1);
  setEvent(room, { kind: 'dareChicken', playerId: player.id, name: player.name, rank: msg.rank || null });
  pushFeed(room, { kind: 'system', text: `🐔 ${player.name.split(' ')[0]} chickened out.` });
  broadcast(room);
  await announceGameEvent(room, recordDrinkDebt(room, player, {
    added: 1,
    total: player.drinkDebt,
    reason: 'chickened out on a dare',
  }));
  await maybeRunBot(room);
}

async function doSideGameLoss(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !room.started || !isDrinkingMode(room)) return;
  const loserId = String(msg.loserId || '').slice(0, 12);
  const loser = room.players.find((p) => p.id === loserId);
  if (!loser || loser.isBot) return;
  const reason = String(msg.reason || 'Lost the side game — drink.').slice(0, 120);
  penalizeDrink(room, loser.id, reason);
  pushFeed(room, { kind: 'system', text: `🎮 ${loser.name.split(' ')[0]} lost a side game — drinks.` });
  broadcast(room);
}

async function doHostAction(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const mode = ['roast', 'question', 'dare'].includes(msg.mode) ? msg.mode : 'roast';
  const other = room.players.find((p) => p.id !== player.id);
  const gameEvent = recordManualAction(room, player, mode);
  const bartenderMode = mode === 'dare' ? 'chaos' : mode === 'roast' ? 'roast' : 'chaos';
  await runHost(room, `manual_${mode}`, player, { gameEvent, targetPlayer: other?.name, bartenderMode, popIn: true });
}

function doReact(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !room.started) return;
  const emoji = String(msg.emoji || '').slice(0, 4);
  if (!emoji) return;
  const allowed = ['😂', '😭', '🔥', '🐟', '🍺', '😈', '💀'];
  if (!allowed.includes(emoji)) return;
  room.reactions = room.reactions || [];
  room.reactions.push({
    id: randomUUID().slice(0, 8),
    playerId: player.id,
    name: player.name.split(' ')[0],
    emoji,
    at: Date.now(),
  });
  if (room.reactions.length > 12) room.reactions.splice(0, room.reactions.length - 12);
  pushFeed(room, { kind: 'reaction', text: `${player.name.split(' ')[0]} ${emoji}`, playerId: player.id });
  room.lastActivity = Date.now();
  broadcast(room);
}

async function doPayDebt(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !isDrinkingMode(room)) return;
  const amount = Math.min(Number(msg.amount) || player.drinkDebt || 0, player.drinkDebt || 0);
  if (amount <= 0) return send(ws, { t: 'error', message: 'Nothing owed right now.' });
  return doLogDrink(ws, { ...msg, drink: msg.drink || { name: 'Debt payment', volumeMl: 330, abv: 5 }, _payAmount: amount });
}

async function doDebtChoice(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const result = resolveDebtChoice(room, player.id, msg.action);
  if (!result) return;
  if (result.action === 'pay') {
    room.drinkChoice = null;
    const count = Math.max(1, Math.round(result.amount || 1));
    queueDrink(room, player.id, 'Paying drink debt', count);
    broadcast(room);
    return;
  }
  setEvent(room, { kind: 'debtChoice', playerId: player.id, action: result.action, total: result.total });
  pushFeed(room, {
    kind: 'system',
    text: result.action === 'double'
      ? `${player.name.split(' ')[0]} doubled down — ${result.total} drinks owed`
      : `${player.name.split(' ')[0]} saved ${result.total} drinks for later`,
  });
  broadcast(room);
  await maybeRunBot(room);
}

async function doSplitOrTake(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const result = resolveSplitOrTake(room, player.id, msg.action);
  if (!result) return;
  setEvent(room, { kind: 'splitOrTake', playerId: player.id, ...result });
  pushFeed(room, {
    kind: 'system',
    text: result.action === 'give'
      ? `${player.name.split(' ')[0]} gave ${result.amount} drink(s) to ${result.targetName?.split(' ')[0]}`
      : `${player.name.split(' ')[0]} took ${result.amount} drink(s) themselves`,
  });
  broadcast(room);
  await maybeRunBot(room);
}

async function doLastCall(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const result = resolveLastCall(room, player.id, msg.action);
  if (!result) return;
  if (result.action === 'punish') {
    room.drinkChoice = {
      type: 'lastCallPunish',
      playerId: player.id,
      victimId: player.id,
      chooserId: result.opponentId,
      amount: result.amount,
    };
    broadcast(room);
    return;
  }
  addDrinkDebt(player, result.amount);
  setEvent(room, { kind: 'lastCall', playerId: player.id, action: 'drink', amount: result.amount });
  pushFeed(room, { kind: 'system', text: `${player.name.split(' ')[0]} drank under Last Call — ${result.amount} added to debt` });
  broadcast(room);
  await maybeRunBot(room);
}

async function doDealOffer(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const result = resolveDealOffer(room, player.id, msg.action);
  if (!result) return;
  setEvent(room, { kind: 'dealOffer', playerId: player.id, ...result });
  pushFeed(room, {
    kind: 'system',
    text: result.action === 'now'
      ? `${player.name.split(' ')[0]} took the deal — ${result.amount} drink now`
      : `${player.name.split(' ')[0]} gambled — ${result.amount} drinks if they lose`,
  });
  broadcast(room);
  await maybeRunBot(room);
}

async function doSetReward(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player) return;
  const choice = room.drinkChoice;
  if (!choice || choice.type !== 'setReward' || choice.playerId !== player.id) return;
  room.drinkChoice = null;
  let reward = applySetReward(room, player, msg.rewardId);
  if (msg.rewardId === 'assign2') {
    reward = SET_REWARDS.find((r) => r.id === 'assign2');
    const opp = room.players.find((p) => p.id !== player.id);
    if (opp) addDrinkDebt(opp, 2);
  } else if (msg.rewardId === 'askAgain') {
    reward = SET_REWARDS.find((r) => r.id === 'askAgain');
    const opp = room.players.find((p) => p.id !== player.id);
    const ranks = room.game?.askableRanks?.(player.id) || [];
    if (opp && ranks.length) grantAskAgainToken(room, player.id, opp.id, ranks[0], 2);
  } else if (!reward) return;
  setEvent(room, { kind: 'setReward', playerId: player.id, rewardId: reward.id, label: reward.label });
  pushFeed(room, { kind: 'system', text: `🏆 ${player.name.split(' ')[0]} claimed ${reward.label}` });
  broadcast(room);
  await maybeRunBot(room);
}

async function doGiftDrink(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !isDrinkingMode(room)) return;
  const result = resolveGiftDrink(room, player.id, msg.action);
  if (!result) return;
  setEvent(room, { kind: 'giftDrink', playerId: player.id, ...result });
  pushFeed(room, {
    kind: 'system',
    text: result.action === 'give'
      ? `🎁 ${player.name.split(' ')[0]} gifted a drink to ${result.targetName?.split(' ')[0]}`
      : `🎁 ${player.name.split(' ')[0]} took one for the team`,
  });
  broadcast(room);
}

async function doUseDrinkToken(ws, msg) {
  const { room, player } = ctxOf(ws);
  if (!room || !player || !isDrinkingMode(room)) return;
  const type = String(msg.tokenType || '').slice(0, 20);
  let result = null;
  if (type === 'assign') {
    result = useAssignToken(room, player.id, msg.targetId, Math.max(1, Number(msg.count) || 1));
  } else if (type === 'thief') {
    result = useThiefToken(room, player.id);
  }
  if (!result) return send(ws, { t: 'error', message: 'Cannot use that token right now.' });
  setEvent(room, { kind: 'drinkToken', playerId: player.id, tokenType: type, ...result });
  pushFeed(room, { kind: 'system', text: `🍺 ${player.name.split(' ')[0]} used a ${type} token` });
  broadcast(room);
  if (type === 'thief' && result.stolen > 0) {
    const victim = room.players.find((p) => p.id === msg.targetId) || room.players.find((p) => p.id !== player.id);
    await announceGameEvent(room, recordDrinkDebt(room, player, {
      added: result.stolen,
      total: player.drinkDebt,
      reason: `stole ${result.stolen} drinks from ${victim?.name.split(' ')[0] || 'opponent'}`,
    }));
  }
}

async function doPlayAgain(ws) {
  const { room, player } = ctxOf(ws);
  if (!room || !player?.isHost) return;
  if (!room.finished) return;
  const categories = sanitizeCategories(room.cardCategories);
  if (!ranksForCategories(categories).length) {
    return send(ws, { t: 'error', message: 'Pick a category for the next round first.' });
  }
  room.cardCategories = categories;
  room.classicRules = true;
  const dealCount = room.players.length >= 5 ? 4 : 5;
  room.game = new GoFishGame(room.players.map((p) => ({ id: p.id, name: p.name })), {
    categories,
    interactiveSets: true,
  });
  room.started = true;
  room.finished = false;
  room.winnerId = null;
  room.gameRecap = null;
  room.pendingDrinks = [];
  room.pendingChaos = null;
  room.pendingPenalty = null;
  room.pendingCreateSet = null;
  initBluffState(room);
  initRoomEconomy(room);
  initBottleChaos(room);
  initBartenderMemory(room);
  room.setProgress = {};
  room.booksBanked = 0;
  room.feed = [];
  for (const p of room.players) {
    p.drinks = [];
    p.lastDrunkTier = 0;
    initPlayerEconomy(p);
  }
  const first = room.players.find((p) => p.id === room.game.current.id);
  pushFeed(room, {
    kind: 'system',
    text: `🔁 Shuffled & dealt ${dealCount} each — ${formatCategorySummary(categories)}. ${first.name.split(' ')[0]} starts.`,
  });
  room.hostText = `${formatCategorySummary(categories)}. ${first.name.split(' ')[0]}, you're up.`;
  setEvent(room, { kind: 'restart' });
  broadcast(room);
  await announceGameEvent(room, recordGameStarted(room, first));
  await maybeRunBot(room);
}

// ---------------------------------------------------------------------------
// AI host — event-anchored commentary only
// ---------------------------------------------------------------------------
async function announceGameEvent(room, gameEvent) {
  if (!gameEvent?.subjectId) return;
  if (!shouldBartenderSpeak(gameEvent, room)) return;

  appendEventLog(room, {
    summary: summarizeEventForLog(gameEvent),
    type: gameEvent.type,
    playerId: gameEvent.subjectId,
  });

  const player = room.players.find((p) => p.id === gameEvent.subjectId);
  if (!player) return;

  const st = playerStatus(profileOf(player), player.drinks);
  const mem = room.bartenderMemory?.players?.[player.id];
  if (mem) mem.traits = derivePlayerTraits(player, mem);

  const bartenderMode = resolveBartenderMode(gameEvent, room, { drunkLevel: st.level });
  room.bartenderMode = bartenderMode;
  await runHost(room, 'commentary', player, { gameEvent, bartenderMode, popIn: true });
}

async function runHost(room, mode, player, extra = {}) {
  if (!player) return;
  if (room.hostBusy) return;
  const opponent = room.players.find((p) => p.id !== player.id) || null;
  const st = playerStatus(profileOf(player), player.drinks);
  const effectiveMode = st.shouldStop && mode !== 'commentary' && mode !== 'win' && mode !== 'recap' && mode !== 'intervention'
    ? 'intervention'
    : mode;
  const bartenderMode = extra.bartenderMode || resolveBartenderMode(extra.gameEvent, room, { drunkLevel: st.level });
  room.hostBusy = true;
  room.hostMode = effectiveMode;
  room.bartenderMode = bartenderMode;
  broadcast(room);

  let text = '';
  const ctx = {
    mode: effectiveMode,
    bartenderMode,
    player: {
      name: player.name,
      sex: player.sex,
      age: player.age,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      playRole: player.playRole,
      questionnaire: player.questionnaire,
    },
    opponentPlayer: opponent ? {
      name: opponent.name,
      sex: opponent.sex,
      age: opponent.age,
      playRole: opponent.playRole,
      questionnaire: opponent.questionnaire,
    } : null,
    drunkLevel: st.level,
    bac: st.bac,
    drinksConsumed: player.drinks.length,
    targetPlayer: extra.targetPlayer || opponent?.name,
    gameEvent: extra.gameEvent || null,
    card: extra.card,
    book: extra.book,
    extra: extra.extra,
    roomMemory: room.bartenderMemory,
    turnCount: room.turnCount || 0,
    allPlayers: room.players,
    roomSnapshot: room,
  };

  try {
    const useNim = shouldUseNIM(extra.gameEvent, bartenderMode, room);
    if (useNim) {
      text = await hostLineFn(ctx);
    } else if (extra.gameEvent) {
      text = pickCachedLine(bartenderMode, extra.gameEvent, room, { avoid: room.lastHostLine });
    } else {
      text = await hostLineFn(ctx);
    }
  } catch (err) {
    console.error('[host]', err.message);
    if (extra.gameEvent) text = pickCachedLine(bartenderMode, extra.gameEvent, room, { avoid: room.lastHostLine });
  }

  room.hostBusy = false;
  if (text) {
    const cleaned = sanitizeDeviceBoundary(text, 'In the room only — no devices. Drink up.');
    const { line, full } = splitBartenderCopy(cleaned);
    room.lastHostLine = line;
    room.hostFullText = full;
    room.hostLine = line;
    room.hostText = line;
    room.hostPopIn = extra.popIn !== false;
    room.hostMode = bartenderMode;
  }
  broadcast(room);
}

// ---------------------------------------------------------------------------
// Disconnect / cleanup
// ---------------------------------------------------------------------------
function onDisconnect(ws) {
  const code = ws._roomCode;
  const room = code && rooms.get(code);
  if (!room) return;
  const player = room.players.find((p) => p.ws === ws);
  if (player) { player.connected = false; player.ws = null; }
  room.lastActivity = Date.now();

  // Handle host transfer if host leaves during game
  if (room.started && player.isHost) {
    // Find the next available player (prefer human, then bot)
    const newHost = room.players.find((p) => p.connected && !p.isBot) ||
                    room.players.find((p) => p.connected && p.isBot);

    if (newHost) {
      // Transfer host privileges
      player.isHost = false;
      newHost.isHost = true;

      // Update host text to announce the transfer
      room.hostText = `${newHost.name.split(' ')[0]} is now the host. Game continues.`;
      broadcast(room);

      // If the disconnected player was the current turn, advance turn
      if (room.game && room.game.current.id === player.id) {
        room.game._advanceTurn();
        // Broadcast updated state after turn advancement
        broadcast(room);
      }
      return; // Early return since we've handled host transfer
    }
  }

  // If everyone's gone and game never started, drop the room.
  if (!room.started && room.players.every((p) => !p.connected)) {
    rooms.delete(code);
    return;
  }

  // If game has started and all humans are disconnected, end the game
  if (room.started && room.players.every((p) => !p.connected || p.isBot)) {
    room.finished = true;
    room.hostText = "All players disconnected. Game ended.";
    broadcast(room);
    return;
  }

  broadcast(room);
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const dead = room.players.every((p) => !p.connected);
    if (now - room.lastActivity > ROOM_TTL_MS || (dead && now - room.lastActivity > 5 * 60 * 1000)) {
      rooms.delete(code);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ctxOf(ws) {
  const code = ws._roomCode;
  const room = code && rooms.get(code);
  if (!room) return {};
  const player = room.players.find((p) => p.id === ws._playerId);
  return { room, player };
}

function logSetProgress(room, player, rank) {
  if (!room.setProgress) room.setProgress = {};
  if (!room.setProgress[player.id]) room.setProgress[player.id] = { sets: [] };
  const m = rankMeta(rank);
  room.setProgress[player.id].sets.push({
    rank,
    line: m.line,
    category: m.category,
    at: Date.now(),
  });
}

async function finalizeCreatedSet(room, player, rank) {
  const opponent = room.players.find((p) => p.id !== player.id);
  await bustDefenderIfLying(room, player.id, rank, opponent?.id);

  const drinking = isDrinkingMode(room);
  const safe = room.game?.safeRound;
  const shortAsker = player.name.split(' ')[0];

  const cardLine = rankName(rank);

  if (drinking && !safe) {
    const cheers = triggerCheersForSet(room, player, rank);
    if (cheers?.queued?.length) {
      setEvent(room, {
        kind: 'cheersRound',
        bankerId: player.id,
        bankerName: player.name,
        rank,
        cardLine: cheers.cardLine,
        toastLine: cheers.toastLine,
      });
      pushFeed(room, {
        kind: 'system',
        text: `🍻 ${cheers.toastLine} — everyone else drinks!`,
        askerId: player.id,
        rank,
      });
      broadcast(room);
    }
    queueSetRewardChoice(room, player.id);
    room.booksBanked = (room.booksBanked || 0) + 1;
    if (room.booksBanked % 2 === 0) {
      await spinWheelFor(room, player);
    }
  }

  logSetProgress(room, player, rank);
  pushFeed(room, {
    kind: 'set',
    text: `Sweet, ${shortAsker} officially has ${rankTitle(rank)}! 🏆`,
    askerId: player.id,
    rank,
  });

  setEvent(room, {
    kind: 'setCreated',
    playerId: player.id,
    playerName: player.name,
    rank,
    line: rankName(rank),
    gameOver: !!room.game?.finished,
    winnerId: room.game?.winnerId || null,
  });

  if (room.game?.finished) {
    room.winnerId = room.game.winnerId;
    await finishGameRoom(room);
    return;
  }

  room.hostText = `SET CREATED — ${shortAsker} officially has ${rankTitle(rank)}!`;
  broadcast(room);
  await announceGameEvent(room, recordSetCompleted(room, player, {
    card: rankTitle(rank),
    rank,
    setCount: room.game?.player(player.id)?.books.length || 1,
  }));
  await resolveBotDrinks(room);
  await maybeRunBot(room);
}

async function doCreateSet(ws) {
  const { room, player } = ctxOf(ws);
  if (!room || !room.started || room.finished || !player || player.isBot) return;
  const pending = room.pendingCreateSet;
  if (!pending || pending.playerId !== player.id || !room.game) return;

  const rank = room.game.createSet(player.id, pending.rank);
  if (!rank) return;

  room.pendingCreateSet = null;
  room.lastActivity = Date.now();
  await finalizeCreatedSet(room, player, rank);
}

async function autoCreateSetForBot(room, bot) {
  const pending = room.pendingCreateSet;
  if (!pending || pending.playerId !== bot.id || !room.game) return false;
  const rank = room.game.createSet(bot.id, pending.rank);
  if (!rank) return false;
  room.pendingCreateSet = null;
  await finalizeCreatedSet(room, bot, rank);
  return true;
}

function hasPending(room) {
  return room.pendingDrinks.length > 0 || !!room.drinkChoice || !!room.pendingChaos || !!room.pendingPenalty
    || !!room.pendingCreateSet || !!room.pendingBluff || !!room.pendingBottleChaos;
}

function clearPendingFor(room, playerId) {
  const i = room.pendingDrinks.findIndex((d) => d.playerId === playerId);
  if (i >= 0) room.pendingDrinks.splice(i, 1);
}

function setEvent(room, ev) { room.lastEvent = { ...ev, seq: ++eventSeq }; }

function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }
}

function personalizedState(room, player) {
  const g = room.game;
  const players = room.players.map((p) => {
    const gp = g?.player(p.id);
    return {
      id: p.id,
      name: p.name,
      sex: p.sex,
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      questionnaire: p.questionnaire,
      drinks: p.drinks,
      connected: p.connected,
      isHost: p.isHost,
      isBot: !!p.isBot,
      books: gp ? gp.books.slice() : [],
      handCount: gp ? gp.hand.length : 0,
      economy: economySnapshot(p),
    };
  });
  const me = g?.player(player.id);
  const opponent = room.players.find((p) => p.id !== player.id) || null;
  const pending = room.pendingDrinks.find((d) => d.playerId === player.id) || null;
  const chaos = room.pendingChaos?.playerId === player.id ? room.pendingChaos : null;
  const drinkChoice = room.drinkChoice?.playerId === player.id ? { ...room.drinkChoice } : null;
  const otherPending = room.pendingDrinks.find((d) => d.playerId !== player.id) || null;
  const waitingOn = otherPending ? (room.players.find((p) => p.id === otherPending.playerId)?.name || null) : null;
  const createSet = room.pendingCreateSet || null;
  const bluffPending = room.pendingBluff || null;
  const bottleChaos = room.pendingBottleChaos ? { ...room.pendingBottleChaos } : null;
  const bottleReveal = room.bottleReveal && room.bottleReveal.until > Date.now()
    && room.bottleReveal.playerId !== player.id
    ? { ...room.bottleReveal } : null;

  let prompt = null;
  if (bluffPending?.defenderId === player.id) {
    const asker = room.players.find((p) => p.id === bluffPending.askerId);
    const m = rankMeta(bluffPending.rank);
    prompt = {
      type: 'bluff',
      rank: bluffPending.rank,
      line: m.line,
      title: m.title,
      art: m.art,
      askerName: asker?.name || 'They',
      doubleDown: !!bluffPending.doubleDown,
      lieMultiplier: bluffPending.lieMultiplier || 1,
      cardCount: bluffPending.cardCount || 1,
    };
  } else if (pending) {
    prompt = {
      type: 'drink',
      reason: pending.reason,
      drinkCount: pending.drinkCount,
      cheers: !!pending.cheers,
      cheersSet: !!pending.cheersSet,
      requireToast: !!pending.requireToast,
      cheersBankerName: pending.cheersBankerName || null,
      cheersCard: pending.cheersCard || null,
      cheersToast: pending.cheersToast || pending.reason || null,
    };
  } else if (createSet?.playerId === player.id) {
    const m = rankMeta(createSet.rank);
    prompt = {
      type: 'createSet',
      rank: createSet.rank,
      line: m.line,
      category: m.category,
      art: m.art,
    };
  } else if (drinkChoice) {
    prompt = { ...drinkChoice, type: drinkChoice.type };
  } else if (bottleChaos?.fateChoice && bottleChaos.targetId === player.id) {
    prompt = {
      type: 'bottleFate',
      title: bottleChaos.title,
      targetName: bottleChaos.targetName,
    };
  } else if (bluffPending) {
    const asker = room.players.find((p) => p.id === bluffPending.askerId);
    const defender = room.players.find((p) => p.id === bluffPending.defenderId);
    prompt = {
      type: 'bluffWait',
      askerName: asker?.name?.split(' ')[0] || 'They',
      defenderName: defender?.name?.split(' ')[0] || 'Them',
      rank: bluffPending.rank,
    };
  } else if (createSet) {
    const owner = room.players.find((p) => p.id === createSet.playerId);
    prompt = {
      type: 'createSetWait',
      playerName: owner?.name?.split(' ')[0] || 'They',
      rank: createSet.rank,
      line: rankMeta(createSet.rank).line,
    };
  } else if (chaos) {
    prompt = {
      type: 'chaos',
      chaosType: chaos.chaosType,
      label: chaos.label,
      text: chaos.text,
      hint: CHAOS_CARDS[chaos.chaosType]?.hint || '',
    };
  }

  return {
    code: room.code,
    you: player.id,
    started: room.started,
    finished: room.finished,
    winnerId: room.winnerId || null,
    gameRecap: room.gameRecap || null,
    turnId: g ? g.current.id : null,
    deckCount: g ? g.deck.length : 0,
    totalSets: g ? g.totalSets : ranksForCategories(room.cardCategories || DEFAULT_CATEGORIES).length,
    cardCategories: room.cardCategories || [...DEFAULT_CATEGORIES],
    deckCatalog: deckCatalog(room.cardCategories || DEFAULT_CATEGORIES),
    players,
    yourHand: me ? me.hand.map((c) => {
      const m = rankMeta(c.rank);
      const dare = isDrinkingMode(room)
        ? sanitizeDeviceBoundary(personalizeDare(c.rank, player, opponent))
        : sanitizeDeviceBoundary(m.dare);
      return {
        rank: c.rank,
        suit: c.suit,
        scenario: m.line,
        line: m.line,
        title: m.title,
        dare,
        art: m.art,
        category: m.category || 'filthy',
      };
    }) : [],
    askableRanks: g && g.current.id === player.id ? g.askableRanks(player.id) : [],
    host: (() => {
      const popIn = !!room.hostPopIn;
      if (popIn) room.hostPopIn = false;
      return {
        line: popIn ? (room.hostLine || room.hostText || '') : '',
        text: popIn ? (room.hostFullText || room.hostLine || room.hostText || '') : '',
        mode: room.hostMode,
        bartenderMode: room.bartenderMode || room.hostMode,
        busy: room.hostBusy,
        popIn,
      };
    })(),
    prompt,
    waitingOn,
    soloMode: !!room.soloMode,
    classicRules: room.classicRules !== false,
    gameMode: room.gameMode || 'casual',
    feed: room.feed || [],
    reactions: (room.reactions || []).slice(-8),
    event: room.lastEvent,
    penalty: penaltyView(room, player),
    setProgress: room.setProgress || {},
    askAgainToken: room.askAgainTokens?.[player.id] || null,
    bluffStats: bluffStatsFor(room, player.id),
    houseRule: room.houseRule || null,
    drinkEconomy: economySnapshot(player),
    bottleChaos,
    bottleReveal,
  };
}

function broadcast(room) {
  for (const p of room.players) {
    if (p.ws && p.ws.readyState === 1) send(p.ws, { t: 'state', state: personalizedState(room, p) });
  }
}
