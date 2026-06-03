// ===========================================================================
//  GO FUCK YOURSELF — client controller (two-phone real-time multiplayer).
//  All game state is authoritative on the server; this file just renders the
//  personalized snapshots it pushes over the WebSocket and sends intents back.
// ===========================================================================
import gsap from '/vendor/gsap/index.js';
import { rankName, rankMeta, TOTAL_SETS, categoryMeta, CATEGORY_LIST, DEFAULT_CATEGORIES, sanitizeCategories, deckCatalog, ranksForCategories } from './game.js?v=63';
import { buildActiveCardElement, renderPhysicalDeck, renderOpponentHandVisual, playGameMoment, CardAudio, setProgressBlocks, setProgressLabel, animateHandCountBump, computeSuggestedAsk } from './cards.js?v=82';
import {
  animateCardPlay, animateComboComplete, animateBartenderRoast,
  hideBartenderRoast, dismissBartenderPop, animateDrinkPenalty, setOpponentTurnMode, animateOpponentPlay,
  animateEndgameCinematic, animateCardSnap,
} from './animations.js?v=64';
import {
  animateCardGive, animateHonestDenial, animateLieDenial, animateSuspicion,
  animateLieCaught, animatePunishmentReveal, animateAskAgainToken, animateDoubleDownPrompt,
  animateMasterBluff, showLieBadge, animateGoFishDraw,
} from './bluff-animations.js?v=63';
import { playerStatus } from './bac.js';
import { GameSocket, getHealth, askHost } from './api.js';
import { openGamesHub, launchSideGame, SIDE_GAMES } from './sidegames/index.js';
import {
  initMobileUX, copyText, haptic, requestWakeLock, releaseWakeLock, setGameplayChrome,
} from './mobile.js';
import { setGameScrollLock, refreshHandTouchUI, initGameTouchUI } from './touch-ui.js?v=3';
import { initHandDragAsk } from './hand-drag-ask.js?v=2';
import { initCardHero, destroyCardHero } from './card-hero.js?v=2';
import { initHandFocus, getFocusedRank, clearHandFocus, setFocusedRank } from './interactions/hand-focus.js?v=1';
import { renderHandDiff, resetHandRenderCache } from './render/hand-render.js?v=2';
import {
  renderOpponentDiff,
  renderGamePromptDiff,
  renderTurnPanelsDiff,
  resetTableDiffCache,
  primaryActionSignature,
} from './render/table-diff.js?v=1';
import { escapeHtml } from './dom-utils.js';
import { inferPlayRole } from './questionnaire.js';
import {
  CardStackModel,
  CardStackAnimator,
  stackSelector,
} from './card-stacks.js?v=5';
import { GameAudio, BartenderVoice, speakAnnouncer } from './game-audio.js?v=64';
import { initIntroCinematic } from './intro-cinematic.js?v=70';
import { bindBottomSheetGestures } from './sheet-gestures.js?v=1';
import { runTableOpening, isTableOpeningBusy } from './table-opening.js?v=3';
import { animateAskIntent } from './ask-theatre.js?v=1';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

import { initOnboarding, openOnboarding, getOnboardingState, presetOnboardingName, ONBOARD_RECOMMENDED, retryOnboardingLaunch, clearLaunchTimer } from './onboarding.js?v=72';
import { renderDrinkEconomyHud, syncDrinkChoiceSheet, resetDrinkEconomyUi, openGiftSheet } from './drink-economy-ui.js?v=73';
import { renderDrinkingBars, pulseDrinkingBar } from './drinking-bar.js?v=1';
import { mountDrinkScanner } from './drink-scanner.js?v=1';
import { mountCardInspectOverlay, animateCardInspectIn } from './card-inspect.js?v=1';
import { playBottleChaos, resetBottleChaosUi } from './chaos-bottle.js?v=70';
import { resolveTableRank } from './gfy-board.js?v=2';

const S = {
  socket: null,
  me: null,
  isHost: false,
  code: null,
  view: null,
  mode: 'create', // create | join
  sex: 'male',
  gameMode: 'drinking',
  cardCategories: [...ONBOARD_RECOMMENDED],
  categoryFilter: null,
  showCatLegend: false,
  bartenderExpanded: false,
  selectedTarget: null,
  selectedRank: null,
  aiEnabled: false,
  seenEvent: 0,
  seenFeedLen: 0,
  seenReactionTs: 0,
  drinkSheetOpen: false,
  createSetSheetOpen: false,
  createSetSheetRank: null,
  bluffSheetOpen: false,
  bluffSheetRank: null,
  choseLieThisRound: false,
  winShown: false,
  interventionSeq: 0,
  handExpanded: true,
  lastPlottingTurn: null,
  opponentToastTimer: null,
  lastActiveRank: null,
  tableActiveRank: null,
  cardRevealBusy: false,
  lastDrinkLevels: {},
  pendingAskCard: null,
  lastHostSig: '',
  askInFlight: false,
  bartenderCollapseTimer: null,
  gameToastTimer: null,
  hostWhisperTimer: null,
  moreOpen: false,
  chaosSheetOpen: false,
  penaltySheetOpen: false,
  penaltyResolver: null,
  hadMyTurn: false,
  snapshotSynced: false,
  skipCardLand: false,
  openingPlayed: false,
};

const RULES_KEY = 'gfy_rules_seen';
const FEED_VISIBLE = 4;
const DEFAULT_DRINK = { name: 'Beer', volumeMl: 330, abv: 5, sub: '330ml · 5%' };

function wireMultiSelectList(containerSelector, { getSelected, onChange, min = 1 } = {}) {
  const container = $(containerSelector);
  if (!container) return;
  container.querySelectorAll('.ios-row-selectable').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.v;
      let selected = getSelected?.() || [];
      const has = selected.includes(id);
      if (has && selected.length <= min) {
        toast('Keep at least one category in the deck.');
        return;
      }
      if (has) selected = selected.filter((x) => x !== id);
      else selected = [...selected, id];
      selected = sanitizeCategories(selected);
      container.querySelectorAll('.ios-row-selectable').forEach((r) => {
        const on = selected.includes(r.dataset.v);
        r.classList.toggle('active', on);
        r.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      onChange?.(selected);
      haptic('light');
    });
  });
}

function categoryPickerRows(selected) {
  const active = sanitizeCategories(selected)[0];
  return CATEGORY_LIST.map((c) => {
    const on = c.id === active;
    return `<li><button type="button" class="ios-row-selectable${on ? ' active' : ''}" data-v="${c.id}" role="radio" aria-checked="${on}">
      <span class="ios-row-label">${c.emoji} ${c.label}</span>
      <span class="ios-row-detail">${escapeHtml(c.desc)}</span>
      <span class="ios-row-check" aria-hidden="true"></span>
    </button></li>`;
  }).join('');
}

function syncCategoryPreview(categories, previewEl, deckPreviewEl) {
  const cats = sanitizeCategories(categories);
  const ranks = ranksForCategories(cats);
  const cards = ranks.length * 4;
  const c = categoryMeta(cats[0]);
  const text = `${c.emoji} ${c.label} · ${ranks.length} situation${ranks.length === 1 ? '' : 's'} · ${cards} cards`;
  if (previewEl) previewEl.textContent = text;
  if (deckPreviewEl) {
    deckPreviewEl.innerHTML = ranks.length
      ? `<p class="deck-preview-sealed">${text} · one category per round</p>`
      : '<p class="muted">Pick a category.</p>';
  }
  return ranks.length > 0;
}

function mountCategoryPicker(containerSelector, { getSelected, setSelected, previewEl, deckPreviewEl, readonly = false } = {}) {
  const container = $(containerSelector);
  if (!container) return;
  const selected = sanitizeCategories(getSelected?.() || DEFAULT_CATEGORIES);
  container.innerHTML = categoryPickerRows(selected);
  container.classList.toggle('readonly', readonly);
  syncCategoryPreview(selected, previewEl, deckPreviewEl);
  if (readonly) return;
  wireSelectableList(containerSelector, (id) => {
    const cats = sanitizeCategories([id]);
    setSelected?.(cats);
    syncCategoryPreview(cats, previewEl, deckPreviewEl);
    container.querySelectorAll('.ios-row-selectable').forEach((r) => {
      const on = r.dataset.v === id;
      r.classList.toggle('active', on);
      r.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  });
}

function wireSelectableList(containerSelector, onSelect) {
  const container = $(containerSelector);
  if (!container) return;
  container.querySelectorAll('.ios-row-selectable').forEach((row) => {
    row.addEventListener('click', () => {
      container.querySelectorAll('.ios-row-selectable').forEach((r) => {
        r.classList.remove('active');
        r.setAttribute('aria-checked', 'false');
      });
      row.classList.add('active');
      row.setAttribute('aria-checked', 'true');
      onSelect?.(row.dataset.v);
      haptic('light');
    });
  });
}

function renderCodeCells(container, code) {
  if (!container) return;
  const chars = (code || '····').padEnd(4, '·').slice(0, 4).split('');
  const cells = container.querySelectorAll('.code-cell');
  if (cells.length) {
    cells.forEach((cell, i) => {
      const c = chars[i] || '·';
      cell.textContent = c === '·' ? '' : c;
      cell.classList.toggle('filled', c !== '·' && c !== ' ');
    });
    return;
  }
  container.innerHTML = chars.map((c) =>
    `<span class="code-cell${c !== '·' && c !== ' ' ? ' filled' : ''}">${c === '·' ? '' : c}</span>`
  ).join('');
}

// ---------------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------------
async function verifyUiAssets() {
  try {
    const r = await fetch('/css/styles.css?v=94', { method: 'HEAD', cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || !ct.includes('text/css')) throw new Error('css missing');
  } catch {
    const el = $('#conn-banner');
    if (el) {
      el.classList.remove('hidden');
      el.dataset.mode = 'offline';
      el.textContent = 'Styles did not load — use https://go-f-yourself.onrender.com and hard-refresh (not 8ljg)';
    }
  }
}

function init() {
  initMobileUX();
  initGameTouchUI();
  initHandFocus({
    onFocusChange: () => {
      if (S.view) renderPrimaryAction(S.view);
    },
  });
  initHandDragAsk(() => {
    const view = S.view;
    const myTurn = view?.turnId === view?.you;
    const blocked = !!view?.prompt || !!view?.waitingOn;
    const opponents = view ? opponentsOf(view) : [];
    if (opponents.length === 1 && view) S.selectedTarget = opponents[0].id;
    return {
      playable: myTurn && !blocked && !!S.selectedTarget,
      blocked,
      askInFlight: !!S.askInFlight,
      view,
      onAsk: (rank, el, opts) => sendAsk(rank, el, opts),
      onPreview: (card, el) => openCardExpandOverlay(card, view, {
        playable: myTurn && !blocked && view?.askableRanks?.includes(card.rank),
        cardEl: el,
      }),
    };
  });
  initCardHero();
  updateConnBanner('connecting');
  void verifyUiAssets();

  // Update AI status first — side-game imports must not block this.
  buildLobbyGames();
  initIntroDemo();
  window.addEventListener('gfy-opening-done', (e) => {
    if (S.view?.started) renderHand(S.view, S.view.turnId === S.view.you);
    const n = e.detail?.cardsPerPlayer ?? (S.view?.players?.length >= 5 ? 4 : 5);
    const band = e.detail?.playerBand ?? (S.view?.players?.length >= 5 ? '5–6 players' : '2–4 players');
    showGameToast(`🎴 Shuffled & dealt ${n} each (${band}) · clockwise`, 4200);
  });

  getHealth().then((h) => {
    S.aiEnabled = !!h.aiEnabled;
    const serverOk = h.ok || h.transport === 'websocket';
    $('#ai-status').textContent = h.aiEnabled
      ? 'AI bartender locked & loaded — prepare to get roasted'
      : serverOk
        ? 'Offline filth engine — still fucking playable'
        : 'Server offline — fix your shit and reload';
    if (serverOk) revealIntroDemo();
  }).catch(() => {
    $('#ai-status').textContent = 'Server offline — fix your shit and reload';
  });

  initOnboarding({
    onSubmit: submitOnboardingProfile,
    onCancel: () => goto('intro'),
    onChange: ({ gameMode, cardCategories }) => {
      if (gameMode) S.gameMode = gameMode;
      if (cardCategories) S.cardCategories = cardCategories;
    },
  });
  wireUI();

  S.socket = new GameSocket();
  S.socket
    .on('joined', onJoined)
    .on('state', onState)
    .on('error', onSocketError)
    .on('connected', () => updateConnBanner('online'))
    .on('disconnected', () => updateConnBanner('offline'))
    .on('reconnecting', () => updateConnBanner('reconnecting'))
    .on('flush', ({ count }) => {
      if (count > 0) toast(`Back online — sending ${count} queued ${count === 1 ? 'action' : 'actions'}…`);
    })
    .on('close', () => {})
    .connect();

  // auto-rejoin a previous session (e.g. phone locked / reload)
  const sess = S.socket.loadSession();
  if (sess?.code && sess?.token) {
    // GameSocket re-joins automatically on open; just wait for state.
  }

  registerSW();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

function updateConnBanner(mode) {
  const el = $('#conn-banner');
  if (!el) return;
  el.dataset.mode = mode;
  el.classList.toggle('hidden', mode === 'online');
  const labels = {
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    offline: 'Connection lost — retrying',
    online: '',
  };
  el.textContent = labels[mode] || '';
}

function goto(name) {
  $$('.screen').forEach((s) => {
    const on = s.id === `screen-${name}`;
    s.classList.toggle('active', on);
    if (on) {
      s.removeAttribute('hidden');
      s.removeAttribute('aria-hidden');
    } else {
      s.setAttribute('hidden', '');
      s.setAttribute('aria-hidden', 'true');
    }
  });
  window.scrollTo(0, 0);
  if (name === 'game') {
    setGameScrollLock(true);
    requestWakeLock();
    setGameplayChrome(true);
  } else {
    setGameScrollLock(false);
    setGameplayChrome(false);
    if (name === 'intro') releaseWakeLock();
  }
}

// ---------------------------------------------------------------------------
// UI WIRING
// ---------------------------------------------------------------------------
function revealIntroDemo() {
  const wrap = $('#intro-demo-wrap');
  if (!wrap || wrap.dataset.revealed) return;
  wrap.dataset.revealed = '1';
  requestAnimationFrame(() => {
    S.introCinematic?.play();
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function initIntroDemo() {
  const btn = $('#btn-demo');
  const showcase = $('#intro-showcase');
  if (!showcase) return;

  S.introCinematic = initIntroCinematic(showcase);

  btn?.addEventListener('click', () => {
    revealIntroDemo();
    const wrap = $('#intro-demo-wrap');
    wrap?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    S.introCinematic?.stop();
    S.introCinematic?.play();
    haptic('light');
  });
}

function introName() {
  return ($('#intro-name')?.value || '').trim();
}

function buildQuickProfile(name) {
  const playRole = inferPlayRole(name) || 'dom';
  return {
    name,
    sex: playRole === 'sub' ? 'female' : 'male',
    playRole,
    age: 30,
    heightCm: 170,
    weightKg: 70,
    questionnaire: {},
  };
}

function quickLaunchCreate() {
  const name = introName();
  if (name.length < 2) {
    toast('Enter your name.');
    $('#intro-name')?.focus();
    return;
  }
  S.mode = 'create';
  S.gameMode = 'drinking';
  S.cardCategories = [...ONBOARD_RECOMMENDED];
  const profile = buildQuickProfile(name);
  S.socket.clearSession();
  S.socket.send({ t: 'create', profile, gameMode: S.gameMode, cardCategories: S.cardCategories });
  haptic('medium');
}

function quickLaunchJoin() {
  const name = introName();
  if (name.length < 2) {
    toast('Enter your name.');
    $('#intro-name')?.focus();
    return;
  }
  S.mode = 'join';
  presetOnboardingName(name);
  openOnboarding('join');
  goto('profile');
}

function wireUI() {
  $('#btn-create').addEventListener('click', quickLaunchCreate);
  $('#btn-join').addEventListener('click', quickLaunchJoin);
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.back)));

  $$('.react-btn').forEach((b) =>
    b.addEventListener('click', () => {
      if (!S.socket) return;
      S.socket.send({ t: 'react', emoji: b.dataset.emoji });
      haptic('light');
    })
  );

  $('#btn-hand-toggle')?.addEventListener('click', () => {});

  $('#btn-more')?.addEventListener('click', () => {
    $('#game-actions-sheet')?.classList.remove('hidden');
    haptic('light');
  });
  $('#btn-actions-close')?.addEventListener('click', closeGameActionsSheet);
  $('#game-actions-sheet')?.addEventListener('click', (e) => {
    if (e.target.id === 'game-actions-sheet') closeGameActionsSheet();
  });
  $('#ga-rules')?.addEventListener('click', () => {
    closeGameActionsSheet();
    openRulesSheet();
  });
  $('#ga-stats')?.addEventListener('click', () => {
    closeGameActionsSheet();
    $('#meters-drawer')?.classList.remove('hidden');
    if (S.view) renderMetersWhenOpen(S.view);
    haptic('light');
  });
  $('#ga-leave')?.addEventListener('click', () => {
    closeGameActionsSheet();
    goHome();
    haptic('light');
  });
  $$('#game-actions-sheet .game-action-row[data-host]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!S.socket) return;
      S.socket.send({ t: 'hostAction', mode: b.dataset.host });
      closeGameActionsSheet();
      haptic('light');
    })
  );
  $('#ga-side-games')?.addEventListener('click', () => {
    closeGameActionsSheet();
    openSideGames();
    haptic('light');
  });

  $('#btn-bartender-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setBartenderExpanded(!S.bartenderExpanded);
    haptic('light');
  });
  $('#host-whisper')?.addEventListener('click', (e) => {
    if (e.target.closest('.bartender-toggle')) return;
    if ($('#host-whisper')?.classList.contains('host-whisper--collapsed')) {
      setBartenderExpanded(true);
      haptic('light');
    }
  });
  $('#btn-start').addEventListener('click', () => S.socket.send({ t: 'start' }));
  $('#btn-copy-code').addEventListener('click', copyCode);
  $('#btn-leave-lobby').addEventListener('click', goHome);
  $('#btn-lobby-home').addEventListener('click', goHome);
  $('#btn-game-home').addEventListener('click', goHome);

  $$('.qa[data-host]').forEach((b) => b.addEventListener('click', () => S.socket.send({ t: 'hostAction', mode: b.dataset.host })));
  $('#qa-games')?.addEventListener('click', openSideGames);
  $('#qa-gift-drink')?.addEventListener('click', () => {
    if (S.view && S.socket) openGiftSheet(S.socket, S.view);
    haptic('light');
  });

  $('#btn-meters-close')?.addEventListener('click', () => $('#meters-drawer').classList.add('hidden'));
  $('#meters-drawer').addEventListener('click', (e) => { if (e.target.id === 'meters-drawer') e.currentTarget.classList.add('hidden'); });
}

function openProfile() {
  openOnboarding(S.mode);
  goto('profile');
}

function submitOnboardingProfile(profile) {
  const ob = getOnboardingState();
  const name = profile?.name?.trim();
  if (!name || name.length < 2 || name === 'Player') {
    toast('Enter your display name.');
    return false;
  }
  if (!profile.playRole) {
    toast('Pick Dom or Sub on the About You step.');
    return false;
  }
  S.gameMode = ob?.gameMode || S.gameMode;
  S.cardCategories = ob?.cardCategories || S.cardCategories;
  S.socket.clearSession();
  if (S.mode === 'join') {
    const code = ob?.joinCode || '';
    if (code.length !== 4) {
      toast('Enter the 4-letter room code.');
      return false;
    }
    S.socket.send({ t: 'join', code, profile });
  } else {
    S.socket.send({ t: 'create', profile, gameMode: S.gameMode, cardCategories: S.cardCategories });
  }
  return true;
}

// ---------------------------------------------------------------------------
// SOCKET EVENTS
// ---------------------------------------------------------------------------
function onJoined(msg) {
  if (S.code && S.code !== msg.code) resetSyncCursors();
  S.me = msg.you.id;
  S.isHost = !!msg.you.isHost;
  S.code = msg.code;
  if ($('#screen-profile')?.classList.contains('active')) {
    S.pendingLobby = true;
  }
}

function onSocketError(msg) {
  toast(msg.message || 'Error');
  if ($('#screen-profile')?.classList.contains('active') && $('#onboard-complete')?.querySelector('.onboard-launch-status')) {
    onboardingLaunchFailed(msg.message || 'Server error — try again.');
  }
  if (msg.fatal) { S.socket.clearSession(); goto('intro'); }
}

function onboardingLaunchFailed(message) {
  const mount = $('#onboard-complete');
  if (!mount) return;
  mount.querySelector('.onboard-launch-status')?.remove();
  let err = mount.querySelector('.onboard-launch-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'onboard-launch-error';
    mount.querySelector('.onboard-complete-inner')?.append(err);
  }
  err.textContent = message;
  let retry = mount.querySelector('.onboard-retry-btn');
  if (!retry) {
    retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn-secondary onboard-retry-btn';
    retry.textContent = 'Try Again';
    retry.addEventListener('click', () => retryOnboardingLaunch());
    mount.querySelector('.onboard-complete-inner')?.append(retry);
  }
}

/** After refresh/rejoin, mark server snapshot as already seen — no Go Fuck Yourself replay. */
function resetSyncCursors() {
  S.snapshotSynced = false;
  S.seenEvent = 0;
  S.seenFeedLen = 0;
  S.seenReactionTs = 0;
  S.interventionSeq = 0;
  S.lastActiveRank = null;
  S.hadMyTurn = false;
  S.winShown = false;
  S.openingPlayed = false;
}

function absorbSnapshot(view) {
  if (view.event?.seq != null) {
    S.seenEvent = Math.max(S.seenEvent, view.event.seq);
  }
  if (view.event?.kind === 'intervention' && view.event.seq != null) {
    S.interventionSeq = Math.max(S.interventionSeq, view.event.seq);
  }
  const feed = (view.feed || []).filter((f) => f.kind !== 'flavor');
  S.seenFeedLen = Math.max(S.seenFeedLen, feed.length);
  const reactions = view.reactions || [];
  const latestRx = reactions[reactions.length - 1];
  if (latestRx?.at) S.seenReactionTs = Math.max(S.seenReactionTs, latestRx.at);
  if (view.event?.kind === 'ask' && view.event.rank) {
    S.lastActiveRank = view.event.rank;
  }
  if (view.finished) S.winShown = true;
  S.skipCardLand = true;
  if (view.event?.kind === 'start' || view.event?.kind === 'restart') {
    S.openingPlayed = false;
  } else {
    S.openingPlayed = true;
  }
}

function maybeRunTableOpening(view) {
  if (S.openingPlayed || !view?.started || view.finished) return;
  if (view.event?.kind !== 'start' && view.event?.kind !== 'restart') return;
  try {
    if (sessionStorage.getItem('gfy_table_opening_seen') === '1') return;
    sessionStorage.setItem('gfy_table_opening_seen', '1');
  } catch { /* private mode */ }
  S.openingPlayed = true;
  const cardsPerPlayer = view.players.length >= 5 ? 4 : 5;
  const playerBand = view.players.length >= 5 ? '5–6 players' : '2–4 players';
  const players = view.players.map((p) => ({
    name: p.name,
    isMe: p.id === view.you,
  }));
  requestAnimationFrame(() => {
    void runTableOpening({ players, cardsPerPlayer, playerBand });
  });
}

function setOpponentReaction(kind = 'idle') {
  const stage = $('#opponent-avatar-stage');
  const hand = $('#opponent-avatar-hand');
  if (!stage) return;
  stage.classList.remove(
    'opponent-avatar-stage--react-got',
    'opponent-avatar-stage--react-lost',
    'opponent-avatar-stage--react-set',
    'opponent-avatar-stage--react-think',
  );
  const map = {
    got: 'opponent-avatar-stage--react-got',
    lost: 'opponent-avatar-stage--react-lost',
    set: 'opponent-avatar-stage--react-set',
    win: 'opponent-avatar-stage--react-set',
    think: 'opponent-avatar-stage--react-think',
    idle: '',
  };
  const cls = map[kind] || '';
  if (cls) stage.classList.add(cls);
  hand?.classList.toggle('opponent-avatar-hand--alive', kind === 'think' || kind === 'got');
}

function onState(view) {
  S.view = view;
  S.me = view.you;
  S.code = view.code;
  S.pendingLobby = false;
  S.askInFlight = false;
  const meP = view.players.find((p) => p.id === view.you);
  S.isHost = !!meP?.isHost;

  const hydrating = !S.snapshotSynced;
  if (hydrating) {
    S.snapshotSynced = true;
    absorbSnapshot(view);
  }

  if (!view.started) {
    renderLobby(view);
    goto('lobby');
    clearLaunchTimer();
  } else {
    if (!$('#screen-game').classList.contains('active')) goto('game');
    renderGame(view);
    maybeRunTableOpening(view);
  }

  if (!hydrating) handleEvent(view);

  if (S.skipCardLand) S.skipCardLand = false;

  syncPenaltySheet(view);

  syncCreateSetSheet(view);
  syncBluffSheet(view);
  syncDrinkChoiceSheet(view, S.socket);

  if (view.bottleReveal && !S.bottleRevealShown) {
    S.bottleRevealShown = view.bottleReveal;
    const who = view.players.find((p) => p.id === view.bottleReveal.playerId)?.name?.split(' ')[0] || 'They';
    showGameToast(`🎭 ${who}'s hand: ${view.bottleReveal.line || 'a card'}`, 5000);
  }
  if (!view.bottleReveal) S.bottleRevealShown = null;

  if (view.prompt?.type === 'drink' && !S.drinkSheetOpen && !view.finished) {
    openDrinkSheet(view.prompt.reason, view);
  }

  // win — wait for bartender recap line before showing sheet
  if (view.finished && !S.winShown) {
    S.winShown = true;
    void animateEndgameCinematic(view).then(async () => {
      const deadline = Date.now() + 14000;
      while (S.view?.host?.busy && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 280));
      }
      openWinSheet(S.view || view);
    });
  }
  if (!view.finished) S.winShown = false;
}

async function queueCardReveal(rank, ev) {
  if (!rank || S.cardRevealBusy) return;
  S.cardRevealBusy = true;
  S.lastActiveRank = rank;
  S.tableActiveRank = rank;
  renderActiveCard(S.view);
  const mount = $('#active-card');
  const isMyAsk = ev.askerId === S.me;
  const isDraw = ev.goFuckYourself && isMyAsk;
  const deckEl = $('#deck-pile-wrap');
  try {
    if (ev.outcome === 'truth' && ev.gotCards > 0 && isMyAsk) {
      await animateCardGive({
        rank,
        targetName: ev.targetName,
        cardCount: ev.gotCards || ev.cardCount || 1,
        destEl: mount,
      });
      const count = S.view?.yourHand?.filter((c) => c.rank === rank).length || 0;
      if (count >= 2) {
        GameAudio.collectionProgress(count);
        animateHandCountBump(rank, count);
        pulseCollectionGroup(rank, count);
      }
    } else if (ev.outcome === 'lie') {
      if (ev.targetId !== S.me) {
        await animateLieDenial({ targetName: ev.targetName });
      }
      if (isMyAsk && isDraw) await animateGoFishDraw(rank, { deckEl, destEl: mount });
    } else if (ev.outcome === 'honestDenial' || (ev.goFuckYourself && ev.honestDenial)) {
      await animateHonestDenial({ deckEl });
      if (isDraw && isMyAsk) await animateGoFishDraw(rank, { deckEl, destEl: mount });
    } else if (isMyAsk) {
      if (isDraw) {
        await animateHonestDenial({ deckEl });
        await animateGoFishDraw(rank, { deckEl, destEl: mount });
      } else {
        const fromEl = document.querySelector(`.hand-rank-card[data-rank="${rank}"], .hand-topic-group[data-rank="${rank}"] .gfy-card-slot:last-child`);
        await animateCardPlay(fromEl, mount, rank);
      }
    } else {
      await animateOpponentPlay(ev.askerName?.split(' ')[0] || 'THEM', mount, rank);
    }
  } finally {
    S.cardRevealBusy = false;
    S.tableActiveRank = null;
    renderActiveCard(S.view);
  }
}

function handleEvent(view) {
  const ev = view.event;
  if (!ev || ev.seq <= S.seenEvent) return;
  S.seenEvent = ev.seq;

  if (ev.kind === 'askPending') {
    if (S.view?.classicRules !== false) return;
    if (ev.askerId === S.me) GameAudio.askTick();
    if (ev.askerId === S.me && ev.doubleDown) animateDoubleDownPrompt();
    if (ev.targetId === S.me) GameAudio.heartbeatStart?.();
    return;
  }

  if (ev.kind === 'start') {
    return;
  }

  if (ev.kind === 'ask') {
    if (ev.outcome === 'lie' && ev.targetId === S.me && S.choseLieThisRound) {
      showLieBadge();
      S.choseLieThisRound = false;
    }
    if (ev.outcome === 'lie' && ev.askerId === S.me) {
      animateAskAgainToken({ multiplier: (ev.lieMultiplier || 1) + 1 });
    }
    if (ev.suspicion) animateSuspicion(ev.suspicion);
    if (ev.masterBluff) animateMasterBluff(ev.targetName);

    if (ev.targetId === S.me && ev.gotCards > 0 && ev.outcome === 'truth') {
      showDefenderPopup(`${ev.askerName.split(' ')[0]} asked`, `Giving ${ev.gotCards}`);
    } else if (ev.targetId === S.me && ev.goFuckYourself && ev.outcome !== 'lie') {
      showDefenderPopup(`${ev.askerName.split(' ')[0]} asked`, 'GO FUCK YOURSELF!');
    }

    GameAudio.heartbeatStop?.();

    if (ev.drewAsked) {
      if (ev.askerId === S.me) {
        GameAudio.legendaryReveal?.();
        playGameMoment('Lucky draw!', `You pulled ${rankName(ev.rank) || ev.rank} — show the group & go again`, { variant: 'lucky', ms: 2800 });
      } else CardAudio.flip();
    } else if (ev.goFuckYourself && ev.outcome !== 'lie' && ev.outcome !== 'honestDenial') {
      if (ev.askerId === S.me) {
        setOpponentReaction('lost');
        showGameToast('GO FUCK YOURSELF', 3200);
      } else if (ev.targetId === S.me) setOpponentReaction('got');
    } else if (ev.gotCards > 0 && ev.askerId === S.me && ev.outcome === 'truth') {
      setOpponentReaction('lost');
      GameAudio.cardSlide?.();
    } else if (ev.gotCards > 0 && ev.targetId === S.me) {
      setOpponentReaction('got');
    }

    if (ev.rank) queueCardReveal(ev.rank, ev);
    if (ev.pendingCreateSet && ev.askerId === S.me) {
      CardAudio.slam();
      playGameMoment('CREATE\nSET', rankName(ev.pendingCreateSet), { variant: 'set', ms: 2200 });
      $('#sets-compact')?.classList.add('sets-done-strip--ready');
    } else if (ev.pendingCreateSet && ev.askerId !== S.me) {
      notifyOpponentSetReady(ev.askerName);
    }
  } else if (ev.kind === 'lieCaught') {
    animateLieCaught({
      defenderName: ev.defenderName,
      turnNumber: ev.turnNumber,
      denialPhrase: ev.denialPhrase,
      punishment: ev.punishment,
      lieMultiplier: ev.lieMultiplier,
    });
    if (ev.revealHand && ev.defenderId !== S.me) {
      showGameToast(`👀 ${ev.defenderName?.split(' ')[0]}'s hand revealed!`, 4000);
    }
  } else if (ev.kind === 'bottleChaos') {
    GameAudio.bottleThunk?.();
    void playBottleChaos(view, ev, S.socket);
  } else if (ev.kind === 'bottleResolved') {
    const who = ev.targetName?.split(' ')[0] || 'They';
    showGameToast(`${who}: ${ev.effectLabel || 'Chaos'}`, 3200);
    if (ev.effectGood) haptic('success');
    else haptic('medium');
  } else if (ev.kind === 'turnSkipped') {
    showGameToast(`💀 ${ev.playerName?.split(' ')[0] || 'Player'} loses a turn`);
  } else if (ev.kind === 'setCreated') {
    setOpponentReaction(ev.playerId === S.me ? 'set' : 'lost');
    const line = ev.line || rankName(ev.rank);
    const who = ev.playerId === S.me ? 'You' : (ev.playerName?.split(' ')[0] || 'They');
    playGameMoment(
      ev.playerId === S.me ? 'Sweet, I officially have' : `${who} officially has`,
      line,
      { variant: 'set', ms: 3200 },
    );
    animateComboComplete({
      rank: ev.rank,
      line,
      groupEl: document.querySelector(`.hand-rank-card[data-rank="${ev.rank}"], .hand-topic-group[data-rank="${ev.rank}"], .card-stack[data-rank="${ev.rank}"]`),
    });
    flashSetComplete();
    showGameToast(`🏆 Sweet — ${who} officially has ${line}`, 3600);
  } else if (ev.kind === 'wheel') {
    showGameToast(ev.text || 'Chaos Wheel spun');
    CardAudio.slam();
    haptic('medium');
  } else if (ev.kind === 'cheersRound') {
    const who = ev.bankerId === S.me ? 'You' : (ev.bankerName?.split(' ')[0] || 'They');
    if (ev.bankerId !== S.me) {
      showGameToast(`🍻 ${ev.toastLine || `CHEERS TO ${who}!`}`, 4500);
      GameAudio.glassClink?.();
    } else {
      showGameToast(`🏆 Set banked — make them drink!`, 3200);
    }
  } else if (ev.kind === 'tierCheers') {
    showGameToast(`🍻 ${ev.playerId === S.me ? 'You' : (ev.name?.split(' ')[0] || 'They')} — ${ev.label || 'new tier'}`, 2800);
    CardAudio.slam();
    haptic('success');
  } else if (ev.kind === 'dareChicken') {
    const who = ev.playerId === S.me ? 'You chickened out' : `${ev.name?.split(' ')[0]} chickened out`;
    showGameToast(`🐔 ${who} — drink up`);
    if (ev.playerId !== S.me) haptic('light');
  } else if (ev.kind === 'penaltyResolved') {
    if (S.penaltyResolver) {
      S.penaltyResolver(ev);
      S.penaltyResolver = null;
    }
  } else if (ev.kind === 'drinkLogged') {
    const short = ev.name?.split(' ')[0] || 'They';
    const prev = S.lastDrinkLevels[ev.playerId] ?? Math.max(0, (ev.level || 1) - 1);
    S.lastDrinkLevels[ev.playerId] = ev.level;
    pulseDrinkingBar(ev.playerId);
    const meter = document.querySelector(`.status-chip[data-player-id="${ev.playerId}"], .drinking-bar[data-player-id="${ev.playerId}"]`);
    if (meter) animateDrinkPenalty(meter, prev, ev.level);
    if (ev.cheers && ev.playerId === S.me) {
      showGameToast('🍻 Cheered. Bar updated.', 2200);
    }
    if (ev.milestones?.length) {
      for (const m of ev.milestones) {
        showGameToast(`🏆 ${m.label} unlocked`, 2400);
      }
    }
    if (ev.playerId === S.me) {
      haptic('success');
    } else if (!ev.bot) {
      const msg = ev.cheers
        ? `🍻 CHEERS! ${short} drank — ${ev.drink}`
        : `🍺 ${short} logged ${ev.drink}`;
      showGameToast(msg);
      CardAudio.flip();
      haptic('light');
    }
    if (ev.level >= 8) toast(`${short} is at ${ev.level}/10 — maybe slow down 🛑`);
  } else if (ev.kind === 'intervention' && ev.playerId === S.me && ev.seq > S.interventionSeq) {
    S.interventionSeq = ev.seq;
    openInterventionSheet(ev.level);
  } else if (ev.kind === 'setReward') {
    showGameToast(`🏆 Reward: ${ev.label || ev.rewardId}`);
    CardAudio.slam();
    haptic('success');
  } else if (ev.kind === 'splitOrTake') {
    const who = ev.playerId === S.me ? 'You' : (ev.targetName?.split(' ')[0] || 'They');
    const n = ev.amount ?? 1;
    const unit = n === 1 ? 'drink' : 'drinks';
    showGameToast(ev.action === 'give' ? `${who} passed ${n} ${unit}` : `${who} took ${n} ${unit}`);
  } else if (ev.kind === 'giftDrink') {
    showGameToast(ev.action === 'give' ? '🎁 Drink gifted' : '🎁 Noble sacrifice');
  } else if (ev.kind === 'drinkMilestone') {
    showGameToast(`🍺 ${ev.label || 'Milestone'} — ${ev.name?.split(' ')[0] || ''}`, 2400);
  } else if (ev.kind === 'dealOffer') {
    showGameToast(ev.action === 'risk' ? '🍸 Gambled on the deal' : '🍸 Took the bartender deal');
  } else if (ev.kind === 'restart') {
    S.winShown = false;
    S.openingPlayed = false;
    resetDrinkEconomyUi();
    S.seenFeedLen = 0;
    S.seenReactionTs = 0;
    S.lastActiveRank = null;
    S.lastDrinkLevels = {};
    S.categoryFilter = null;
    S.choseLieThisRound = false;
    S.bluffSheetOpen = false;
    S.bluffSheetRank = null;
    setOpponentTurnMode(false);
    closeAllSheets();
    maybeRunTableOpening(view);
  }
}

// ---------------------------------------------------------------------------
// LOBBY
// ---------------------------------------------------------------------------
function renderLobby(view) {
  renderCodeCells($('#lobby-code'), view.code);
  const cats = sanitizeCategories(view.cardCategories || DEFAULT_CATEGORIES);
  S.cardCategories = cats;
  const hostControls = S.isHost && !view.started;
  $('#lobby-cat-hint').textContent = hostControls
    ? 'Pick one category for this round — swap after each game.'
    : 'Host picked tonight\'s category — tap a card to preview.';
  mountCategoryPicker('#lobby-categories', {
    getSelected: () => S.cardCategories,
    setSelected: (next) => {
      S.cardCategories = next;
      S.socket.send({ t: 'setCategories', categories: next });
    },
    previewEl: null,
    deckPreviewEl: $('#lobby-deck-preview'),
    readonly: !hostControls,
  });
  if (!hostControls) {
    $('#lobby-categories').querySelectorAll('.ios-row-selectable').forEach((r) => { r.style.pointerEvents = 'none'; });
  }

  const humans = view.players.filter((p) => !p.isBot);
  const humanCount = humans.filter((p) => p.connected).length;
  const ranks = ranksForCategories(S.cardCategories);
  const startBtn = $('#btn-start');
  if (S.isHost) {
    startBtn.classList.remove('hidden');
    startBtn.disabled = ranks.length < 1;
    $('#lobby-status').textContent = humanCount >= 2
      ? (ranks.length ? 'Both here — ready to go fucking fuck yourselves?' : 'Pick a fucking category')
      : 'Mock partner will join — solo fuck mode';
  } else {
    startBtn.classList.add('hidden');
    $('#lobby-status').textContent = humanCount < 2
      ? 'Waiting for someone to fuck this game with you…'
      : 'Waiting for host to ask: ready to go fucking fuck yourself?';
  }

  $('#lobby-players').innerHTML = view.players.map((p) => {
    const initials = (p.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return `
    <li class="pstrip ${p.connected ? '' : 'off'}">
      <div class="pstrip-avatar">${initials}</div>
      <span class="pstrip-name">${escapeHtml(p.name)}${p.isBot ? ' 🤖 mock' : ''}${p.id === view.you ? ' (you)' : ''}</span>
      <span class="pstrip-role">${p.isHost ? 'Host' : p.connected ? 'In' : '…'}</span>
    </li>`;
  }).join('');

  const playable = Math.max(view.players.filter((p) => p.connected || p.isBot).length, humanCount, 1);
  updateLobbyGames(playable);

  const gamesWrap = $('#lobby-games-wrap');
  if (gamesWrap) gamesWrap.classList.toggle('hidden', !SIDE_GAMES.length);

  const lobbyHost = $('#lobby-host');
  const hostLine = view.host?.text?.trim();
  if (lobbyHost) {
    if (hostLine && !view.started) {
      lobbyHost.textContent = hostLine;
      lobbyHost.classList.remove('hidden');
    } else {
      lobbyHost.classList.add('hidden');
      lobbyHost.textContent = '';
    }
  }
}

async function copyCode() {
  const el = $('#lobby-code');
  const code = S.code || [...(el?.querySelectorAll('.code-cell') || [])].map((c) => c.textContent).join('').replace(/[^A-Z0-9]/g, '');
  const ok = await copyText(code);
  haptic('success');
  toast(ok ? 'Code copied — send it to your fuck buddy' : code);
}

function goHome() {
  closeAllSheets();
  $('#meters-drawer')?.classList.add('hidden');
  releaseWakeLock();
  clearHandFocus();
  resetHandRenderCache();
  resetTableDiffCache();
  destroyCardHero();
  S.socket.shouldReconnect = false;
  S.socket.send({ t: 'leave' });
  S.socket.clearSession();
  S.view = null;
  S.code = null;
  S.snapshotSynced = false;
  goto('intro');
}

function leaveGame() {
  goHome();
}

// ---------------------------------------------------------------------------
// GAME RENDER
// ---------------------------------------------------------------------------
function opponentsOf(view) {
  return view.players.filter((p) => p.id !== view.you);
}

function renderGame(view) {
  S.cardCategories = sanitizeCategories(view.cardCategories || S.cardCategories);
  const myTurn = view.turnId === view.you;
  $('#screen-game')?.classList.toggle('your-turn', myTurn && !view.finished);
  $('#room-chip').textContent = view.code;

  const turnName = view.players.find((p) => p.id === view.turnId)?.name || '—';
  const turnPill = $('#turn-pill');
  if (turnPill) {
    if (myTurn) {
      turnPill.textContent = 'Your turn';
      turnPill.setAttribute('aria-label', 'Your turn');
    } else {
      const short = turnName.split(' ')[0] || 'Opponent';
      turnPill.textContent = `${short}'s turn`;
      turnPill.setAttribute('aria-label', `${turnName}'s turn`);
    }
    turnPill.classList.toggle('mine', myTurn);
  }
  if (myTurn) {
    if (!S.hadMyTurn) haptic('turn');
    setBartenderExpanded(false);
  }
  S.hadMyTurn = myTurn;

  if (!myTurn) {
    S.selectedTarget = null;
    S.selectedRank = null;
    clearHandFocus();
  }

  const tableCtx = getTableRenderCtx();
  renderOpponentDiff(view, tableCtx);
  renderGameScoreboard(view);
  renderDeckPile(view);
  renderActiveCard(view);
  renderGamePromptDiff(view, tableCtx);
  renderPrimaryAction(view);
  renderGameToast(view);
  renderHost(view);
  renderTurnPanelsDiff(view, tableCtx);
  renderHand(view, myTurn);
  syncSetCompletionUI(view);
  renderCompletedSets(view);
  renderPlayerStatusBar(view);
  renderDrinkEconomyHud(view, S.socket);
  renderMetersWhenOpen(view);
  renderReactions(view);
}

function getTableRenderCtx() {
  return {
    $,
    S,
    escapeHtml,
    opponentOf,
    opponentsOf,
    renderHand,
    setOpponentReaction,
    setOpponentTurnMode,
    showGameToast,
    playerStatus,
    chaosLabel,
  };
}

function opponentOf(view) {
  return opponentsOf(view)[0] || null;
}

function meOf(view) { return view.players.find((p) => p.id === view.you) || null; }

function chaosLabel(level) {
  if (level >= 8) return 'Wasted';
  if (level >= 6) return 'Chaos';
  if (level >= 4) return 'Buzzed';
  if (level >= 2) return 'Warm';
  return 'Sober';
}

function closeGameActionsSheet() {
  $('#game-actions-sheet')?.classList.add('hidden');
}

function renderGameScoreboard(view) {
  const el = $('#game-scoreboard');
  if (!el) return;
  el.classList.add('hidden');
}

let lastPrimarySig = '';

function renderPrimaryAction(view) {
  const btn = $('#play-primary');
  if (!btn) return;
  const myTurn = view.turnId === view.you;
  const blocked = !!view.prompt || !!view.waitingOn;
  const sig = primaryActionSignature(view, getFocusedRank());
  if (sig === lastPrimarySig && !view.prompt?.type) {
    if (!myTurn || blocked) btn.classList.add('hidden');
    return;
  }
  lastPrimarySig = sig;

  if (view.prompt?.type === 'createSet') {
    btn.classList.remove('hidden');
    btn.classList.add('play-primary--set-ready');
    btn.innerHTML = `<span class="play-primary-label">Sweet — officially bank this set</span>`;
    btn.onclick = () => {
      haptic('heavy');
      const stack = document.querySelector(stackSelector(view.prompt.rank));
      const setsRow = $('#books-row');
      const go = () => {
        S.socket.send({ t: 'createSet' });
        haptic('success');
        flashSetComplete();
      };
      if (stack) {
        void CardStackAnimator.createSetSequence(stack, setsRow, view.prompt.rank).then(go);
      } else {
        go();
      }
    };
    return;
  }

  btn.classList.remove('play-primary--set-ready');

  if (!myTurn || blocked) {
    btn.classList.add('hidden');
    return;
  }
  const rank = getFocusedRank() || computeSuggestedAsk(view.yourHand, view.askableRanks)?.rank;
  if (!rank || !view.askableRanks?.includes(rank)) {
    btn.classList.add('hidden');
    return;
  }
  const opp = opponentOf(view);
  const oppName = opp?.name.split(' ')[0] || 'them';
  const line = rankMeta(rank).line || rank;
  btn.classList.remove('hidden');
  btn.innerHTML = `<span class="play-primary-label">Ask ${escapeHtml(oppName)}</span><span class="play-primary-sub">${escapeHtml(line)}</span>`;
  btn.onclick = () => {
    const card = document.querySelector(`.card-stack[data-rank="${rank}"]`);
    if (!card) {
      haptic('error');
      toast('Pick a card first.');
      return;
    }
    haptic('medium');
    sendAsk(rank, card);
  };
}

function notifyOpponentSetReady(askerName) {
  const stage = $('#opponent-avatar-stage');
  const short = (askerName || 'They').split(' ')[0];
  stage?.classList.add('opponent-avatar-stage--set-pending');
  showGameToast(`${short} can bank a set — watch the table`, 3200);
  setOpponentReaction('set');
}

function showGameToast(msg, ms = 2200) {
  const el = $('#game-toast');
  if (!el || !msg) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(S.gameToastTimer);
  S.gameToastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, ms);
}

function renderDeckPile(view) {
  $('#deck-count').textContent = view.deckCount;
  const stack = $('#deck-stack');
  if (!stack) return;
  const sig = String(view.deckCount);
  if (stack.dataset.deckSig !== sig) {
    stack.dataset.deckSig = sig;
    stack.className = 'deck-stack deck-stack--pond';
    stack.innerHTML = renderPhysicalDeck(view.deckCount);
  }
  $('#deck-pile-wrap')?.classList.toggle('deck-pile-wrap--pond-ready', view.deckCount > 0);
}

function renderGameToast(view) {
  const feed = (view.feed || []).filter((f) => f.kind !== 'flavor');
  const latest = feed[feed.length - 1];
  if (!latest || feed.length === S.seenFeedLen) return;
  S.seenFeedLen = feed.length;

  const emoji = { ask: '', give: '', gfy: '', set: '', lucky: '', chaos: '', system: '', reaction: '' }[latest.kind] || '';
  let text = latest.text || '';
  if (latest.kind === 'ask') {
    const m = text.match(/^(\w+) asks (\w+) for (.+)$/i);
    if (m) text = `${m[1]} asked for ${m[3]}`;
  } else if (latest.kind === 'gfy') {
    const name = text.match(/^(\w+)/)?.[1] || 'Someone';
    text = `${name} drew a card. Unfortunate.`;
  } else if (latest.kind === 'give') {
    text = text.replace(/gave \d+ cards?/i, 'got cards');
  } else if (latest.kind === 'set') {
    text = text.replace(/completed a (book|set)/i, 'finished a set');
  }
  if (text.length > 48) text = `${text.slice(0, 46)}…`;
  showGameToast(emoji ? `${emoji} ${text}` : text);
}

function renderActiveCard(view) {
  const mount = $('#active-card');
  const stage = mount?.closest('.play-zone-stage');
  if (!mount) return;
  if (S.cardRevealBusy) return;

  const rank = resolveTableRank(view, S.tableActiveRank, S.lastActiveRank);
  stage?.classList.toggle('play-zone-stage--live', !!rank);
  mount.closest('.table-center')?.classList.toggle('play-zone--live', !!rank);

  if (rank) {
    mount.classList.remove('empty');
    if (mount.dataset.rank !== rank || !mount.querySelector('.gfy-card-face')) {
      mount.dataset.rank = rank;
      mount.innerHTML = '';
      mount.appendChild(buildActiveCardElement(rank));
    }
    return;
  }

  mount.classList.add('empty');
  mount.dataset.rank = '';
  mount.innerHTML = '';
}

function sendAsk(rank, cardEl = null, { skipTheatre = false } = {}) {
  const view = S.view;
  if (!view || view.turnId !== view.you || !S.selectedTarget || !rank) {
    haptic('error');
    return;
  }
  if (view.prompt || view.waitingOn || isTableOpeningBusy()) {
    haptic('error');
    return;
  }
  if (S.askInFlight) return;
  if (!view.askableRanks?.includes(rank)) {
    haptic('error');
    toast('You can\u2019t ask for that rank.');
    return;
  }

  const fromEl = cardEl || document.querySelector(`.card-stack[data-rank="${rank}"], .hand-rank-card[data-rank="${rank}"], .hand-topic-group[data-rank="${rank}"]`);
  const toEl = $('#active-card');
  const target = view.players.find((p) => p.id === S.selectedTarget);
  S.askInFlight = true;
  const go = () => {
    S.socket.send({ t: 'ask', targetId: S.selectedTarget, rank });
    if (opponentsOf(view).length > 1) S.selectedTarget = null;
    clearHandFocus();
    haptic('light');
  };

  S.tableActiveRank = rank;
  renderActiveCard(view);

  if (skipTheatre) {
    go();
    S.tableActiveRank = null;
    renderActiveCard(S.view);
    S.askInFlight = false;
    return;
  }

  void animateAskIntent({
    rank,
    targetName: target?.name,
    fromEl,
    destEl: toEl,
  }).catch(() => {}).then(() => {
    go();
    S.tableActiveRank = null;
    renderActiveCard(S.view);
  });
}

function setBartenderExpanded(expanded) {
  S.bartenderExpanded = expanded;
  const whisper = $('#host-whisper');
  const btn = $('#btn-bartender-toggle');
  const expandedEl = $('#host-expanded');
  if (!whisper) return;
  whisper.classList.toggle('host-whisper--collapsed', !expanded);
  whisper.classList.toggle('host-whisper--expanded', expanded);
  expandedEl?.classList.toggle('hidden', !expanded);
  expandedEl?.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  if (btn) {
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.textContent = expanded ? 'Collapse' : 'Expand';
  }
  if (!expanded) dismissBartenderPop(6000);
}

function syncBartenderTeaser(text) {
  const teaser = $('#host-teaser');
  if (!teaser) return;
  const t = String(text || '').trim();
  if (!t) {
    teaser.textContent = '';
    return;
  }
  const line = t.length > 96 ? `${t.slice(0, 94)}…` : t;
  teaser.textContent = `"${line}"`;
}

function renderHost(view) {
  const whisper = $('#host-whisper');
  if (!whisper) return;

  const host = view.host || {};
  const line = (host.line || host.text || '').trim();
  const full = (host.text || line).trim();
  const mode = host.bartenderMode || host.mode || 'roast';
  const popIn = !!host.popIn;
  const busy = !!host.busy;

  if (busy) {
    whisper.classList.remove('hidden');
    animateBartenderRoast('', { busy: true, mode });
    return;
  }

  if (!popIn || !line) {
    if (!busy) whisper.classList.add('hidden');
    if (!S.bartenderExpanded) return;
    return;
  }

  const sig = `${line}|${mode}`;
  if (sig === S.lastHostSig && !busy) return;
  S.lastHostSig = sig;

  syncBartenderTeaser(line);
  const hostText = $('#host-text');
  if (hostText) hostText.textContent = full || line;

  setBartenderExpanded(false);
  animateBartenderRoast(line, { mode });
  dismissBartenderPop(mode === 'hype' || mode === 'win' ? 11000 : 8500);
}

function groupHandByRank(hand, catalog = []) {
  const groups = new Map();
  for (const c of hand) {
    if (!c.rank) continue;
    if (!groups.has(c.rank)) groups.set(c.rank, []);
    groups.get(c.rank).push(c);
  }
  const catalogOrder = new Map(catalog.map((d, i) => [d.rank, i]));
  return [...groups.entries()]
    .map(([rank, cards]) => ({ rank, cards }))
    .sort((a, b) => {
      const diff = b.cards.length - a.cards.length;
      if (diff !== 0) return diff;
      return (catalogOrder.get(a.rank) ?? 99) - (catalogOrder.get(b.rank) ?? 99);
    });
}

function renderHand(view, myTurn) {
  const hand = $('#hand');
  const handWrap = $('#hand-wrap');
  const askNext = $('#hand-ask-next');
  const blocked = !!view.prompt || !!view.waitingOn;
  const opponents = opponentsOf(view);
  if (opponents.length === 1) S.selectedTarget = opponents[0].id;
  const playable = myTurn && !blocked && !!S.selectedTarget;

  const rebuilt = renderHandDiff(hand, view, {
    myTurn,
    blocked,
    selectedTarget: S.selectedTarget,
    onAsk: (r, el, opts) => sendAsk(r, el, opts),
    onPreview: (c, el) => openCardExpandOverlay(c, view, {
      playable: playable && view.askableRanks?.includes(c.rank),
      cardEl: el,
    }),
    isOpeningBusy: isTableOpeningBusy,
  });

  const suggested = playable ? computeSuggestedAsk(view.yourHand, view.askableRanks) : null;
  renderAskNext(askNext, { suggested, playable, view });

  if (rebuilt) {
    requestAnimationFrame(() => refreshHandTouchUI(handWrap));
  }
}

function renderCompletedSets(view) {
  const wrap = $('#sets-compact');
  const row = $('#books-row');
  if (!wrap || !row) return;
  if (!view || view.finished) {
    wrap.classList.add('hidden');
    wrap.classList.remove('sets-done-strip--ready');
    row.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  const me = meOf(view);
  const books = me?.books?.length ?? 0;
  const canBank = view.prompt?.type === 'createSet';
  wrap.classList.toggle('sets-done-strip--ready', canBank);

  const fires = books > 0
    ? Array.from({ length: books }, () => '<span class="sets-done-fire" aria-hidden="true">🔥</span>').join('')
    : '<span class="sets-done-empty">—</span>';

  if (canBank) {
    const rankLine = rankName(view.prompt.rank) || view.prompt.rank;
    row.innerHTML = `${fires}<span class="sets-pending-cta" role="status">CREATE SET · ${escapeHtml(rankLine)}</span>`;
    return;
  }
  row.innerHTML = fires;
}

function syncSetCompletionUI(view) {
  const mount = $('#set-completion-mount');
  if (!mount) return;
  /* Primary CTA + collection shelf handle set completion — no duplicate banner */
  mount.classList.add('hidden');
  mount.innerHTML = '';
}

function renderAskNext(el, { suggested, playable, view }) {
  if (!el) return;
  const opp = opponentOf(view);
  const oppName = opp?.name.split(' ')[0] || 'them';
  const blocked = !!view?.prompt || !!view?.waitingOn;

  if (view?.prompt?.type === 'createSet') {
    el.classList.remove('hidden');
    el.innerHTML = `<p class="hand-ask-next-hint">Four of a kind — bank it below</p>`;
    return;
  }

  if (!playable || !suggested || blocked) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  const line = rankName(suggested.rank) || suggested.rank;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="hand-ask-next-inner">
      <span class="hand-ask-next-label">Ask ${escapeHtml(oppName)}</span>
      <span class="hand-ask-next-rank">${escapeHtml(line)}</span>
    </div>`;
}

function closeCardExpandOverlay() {
  const ov = $('#card-expand-overlay');
  if (!ov) return;
  ov.classList.remove('show');
  document.body.classList.remove('card-expand-open');
  setTimeout(() => ov.remove(), 280);
}

function openCardExpandOverlay(card, view = S.view, { playable = false, cardEl = null } = {}) {
  closeAllSheets();
  closeCardExpandOverlay();
  const rank = card.rank;
  const overlay = mountCardInspectOverlay({
    rank,
    view,
    playable,
    onClose: closeCardExpandOverlay,
    onAsk: () => {
      closeCardExpandOverlay();
      sendAsk(rank, cardEl || document.querySelector(`.card-stack[data-rank="${rank}"], .hand-rank-card[data-rank="${rank}"]`));
    },
  });
  document.body.appendChild(overlay);
  animateCardInspectIn(overlay);
}

function pulseCollectionGroup(rank, count) {
  const group = document.querySelector(`.hand-rank-card[data-rank="${rank}"], .hand-topic-group[data-rank="${rank}"]`);
  if (!group) return;
  group.classList.add('collection-progress-pulse');
  const block = group.querySelector(`.set-block:nth-child(${count})`);
  block?.classList.add('set-block--just-filled');
  setTimeout(() => {
    group.classList.remove('collection-progress-pulse');
    block?.classList.remove('set-block--just-filled');
  }, 900);
}

function openCardDetailSheet(card, view = S.view) {
  closeAllSheets();
  const rank = card.rank;
  const meta = rankMeta(rank);
  const cat = categoryMeta(meta.category);
  const owned = (view?.yourHand || []).filter((c) => c.rank === rank).length;
  const need = Math.max(0, 4 - owned);
  const progressLine = owned >= 4
    ? 'Collection complete — create your set!'
    : `${setProgressLabel(owned)} to complete.`;

  const close = openSheet(`
    <div class="grab"></div>
    <div class="card-detail-preview">
      ${cardFaceHtmlForSheet(rank)}
    </div>
    <div class="card-detail-meta">
      <span class="dare-cat-pill" style="--cat-accent:${cat.accent}">${cat.emoji} ${escapeHtml(cat.label)}</span>
      <h3 class="card-detail-title">${escapeHtml(meta.line)}</h3>
      <div class="card-detail-owned">
        <span class="card-detail-owned-label">Owned</span>
        <span class="card-detail-owned-value">×${owned}</span>
      </div>
      <div class="card-detail-progress">
        <span class="card-detail-progress-label">Collection Progress</span>
        <div class="hand-set-blocks card-detail-blocks">${setProgressBlocks(owned)}</div>
        <span class="card-detail-progress-text">${owned} of 4 collected · ${escapeHtml(progressLine)}</span>
      </div>
      <p class="card-detail-collection">Related collection: <strong>${escapeHtml(cat.short.toUpperCase())}</strong></p>
    </div>
    <div class="sheet-actions">
      <button type="button" class="btn-primary" id="card-detail-close">Fucking Got It</button>
      <button type="button" class="btn-secondary" id="card-detail-dare">View Dare</button>
    </div>
  `);
  close.overlay?.querySelector('#card-detail-close')?.addEventListener('click', () => close());
  close.overlay?.querySelector('#card-detail-dare')?.addEventListener('click', () => {
    close();
    openCardDareSheet({ ...card, scenario: meta.line, title: meta.title, dare: meta.dare, category: meta.category, preview: true });
  });
}

function cardFaceHtmlForSheet(rank) {
  const wrap = document.createElement('div');
  wrap.className = 'card-detail-face-wrap';
  wrap.appendChild(buildActiveCardElement(rank));
  return wrap.outerHTML;
}

function syncCollectionNearPulse(view) {
  const counts = new Map();
  for (const c of view.yourHand || []) {
    counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  }
  const almost = [...counts.values()].some((n) => n === 3);
  document.body.classList.toggle('collection-near', almost);
  if (almost) GameAudio.heartbeatStart();
  else GameAudio.heartbeatStop?.();
}

function renderCategoryLegend(view) {
  const el = $('#card-cat-legend');
  const btn = $('#btn-categories');
  if (!el) return;
  const showGame = !!view?.started;
  el.classList.toggle('hidden', !showGame);
  el.classList.toggle('card-cat-legend--collapsed', !S.showCatLegend);
  btn?.classList.toggle('active', S.showCatLegend);
  btn?.setAttribute('aria-pressed', S.showCatLegend ? 'true' : 'false');
  if (!showGame) return;
  const active = sanitizeCategories(view.cardCategories || DEFAULT_CATEGORIES);
  if (active.length === 1) {
    const c = categoryMeta(active[0]);
    const count = (view.deckCatalog || []).length;
    el.innerHTML = `<span class="cat-legend-chip cat-legend--solo cat-legend--${c.id}" style="--cat-accent:${c.accent}">${c.emoji} ${escapeHtml(c.short)} · ${count} cards</span>`
      + `<button type="button" class="cat-legend-chip cat-legend-deck" id="btn-deck-catalog" title="Browse deck">📋 Deck</button>`;
    $('#btn-deck-catalog')?.addEventListener('click', () => openDeckCatalogSheet(view));
    return;
  }
  el.innerHTML = active.map((id) => {
    const c = categoryMeta(id);
    const on = S.categoryFilter === id;
    const count = (view.deckCatalog || []).filter((d) => d.category === id).length;
    return `<button type="button" class="cat-legend-chip cat-legend--${c.id}${on ? ' active' : ''}" data-cat="${c.id}" style="--cat-accent:${c.accent}" title="${escapeHtml(c.desc)}">${c.emoji} ${escapeHtml(c.short)}${count ? ` · ${count}` : ''}</button>`;
  }).join('')
    + `<button type="button" class="cat-legend-chip cat-legend-deck" id="btn-deck-catalog" title="Browse full deck">📋 Deck</button>`;
  el.querySelectorAll('.cat-legend-chip[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cat;
      S.categoryFilter = S.categoryFilter === id ? null : id;
      haptic('light');
      renderCategoryLegend(view);
      renderHand(view, view.turnId === view.you);
      showGameToast(S.categoryFilter ? `Showing ${categoryMeta(id).short} only` : 'Showing all cards');
    });
  });
  $('#btn-deck-catalog')?.addEventListener('click', () => openDeckCatalogSheet(view));
}

function openSituationSheet(rank) {
  const m = rankMeta(rank);
  const cat = categoryMeta(m.category);
  openCardDareSheet({
    rank,
    scenario: m.line,
    title: m.title,
    dare: m.dare,
    category: m.category,
    preview: true,
  });
}

function openDeckCatalogSheet(view) {
  const catalog = view.deckCatalog || [];
  const close = openSheet(`
    <div class="grab"></div>
    <h3>Tonight's Deck</h3>
    <p class="muted">${catalog.length} situations · tap to preview</p>
    <div class="deck-catalog-list">
      ${catalog.map((c) => {
        const cat = categoryMeta(c.category);
        return `<button type="button" class="deck-catalog-row cat-legend--${cat.id}" data-rank="${c.rank}" style="--cat-accent:${cat.accent}">
          <span class="deck-catalog-cat">${cat.emoji}</span>
          <span class="deck-catalog-text">${escapeHtml(c.headline || c.line)}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="sheet-actions"><button type="button" class="btn-primary" id="deck-catalog-close">Close</button></div>
  `);
  close.querySelectorAll('.deck-catalog-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      close();
      openSituationSheet(btn.dataset.rank);
    });
  });
  $('#deck-catalog-close')?.addEventListener('click', () => close());
}

function openCardDareSheet(card) {
  closeAllSheets();
  const drinking = S.view?.gameMode !== 'casual' && !card.preview;
  const cat = categoryMeta(card.category);
  let sec = 30;
  let timerId = null;
  const close = openSheet(`
    <div class="grab"></div>
    <span class="dare-cat-pill" style="--cat-accent:${cat.accent}">${cat.emoji} ${escapeHtml(cat.label)}</span>
    <h3>${escapeHtml(card.scenario || rankName(card.rank))}</h3>
    <p class="muted dare-body">${escapeHtml(card.dare || 'No dare text.')}</p>
    ${drinking ? `<p class="dare-timer" data-dare-timer>${sec}s</p>` : ''}
    <div class="sheet-actions dare-actions">
      <button type="button" class="btn-primary" data-dare-done>${drinking ? 'Fucking nailed it' : 'Fucking got it'}</button>
      ${drinking ? '<button type="button" class="btn-secondary" data-dare-chicken>🐔 Chicken — drink</button>' : ''}
    </div>
  `);
  const overlay = close.overlay;
  const stopTimer = () => { if (timerId) clearInterval(timerId); timerId = null; };
  const finish = () => {
    stopTimer();
    close();
    if (!card.preview) {
      haptic('success');
      showGameToast('✅ Dare done — back to fucking yourself');
    }
  };
  overlay?.querySelector('[data-dare-done]')?.addEventListener('click', finish);
  overlay?.querySelector('[data-dare-chicken]')?.addEventListener('click', () => {
    if (card.preview) return finish();
    S.socket?.send({
      t: 'dareChicken',
      rank: card.rank,
      reason: `Chickened out on ${card.title || rankName(card.rank)} — drink.`,
    });
    finish();
  });
  if (drinking) {
    const el = overlay?.querySelector('[data-dare-timer]');
    timerId = setInterval(() => {
      sec -= 1;
      if (el) el.textContent = `${Math.max(0, sec)}s`;
      if (sec <= 0) {
        stopTimer();
        S.socket?.send({
          t: 'dareChicken',
          rank: card.rank,
          reason: `Ran out of time on ${card.title || rankName(card.rank)} — drink.`,
        });
        finish();
      }
    }, 1000);
  }
}

function renderPlayerStatusBar(view) {
  const bar = $('#player-status-bar');
  const wrap = $('#player-status-meters');
  if (!bar || !wrap) return;
  bar.classList.add('hidden');
  wrap.innerHTML = '';
}

function renderMetersWhenOpen(view) {
  const drawer = $('#meters-drawer');
  if (!drawer || drawer.classList.contains('hidden')) return;
  const drinking = view?.gameMode !== 'casual' ? renderDrinkingBars(view) : '';
  const bac = view.players.map((p) => {
    const st = playerStatus({
      sex: p.sex,
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
    }, p.drinks || []);
    const mine = p.id === view.you;
    return `<div class="meter ${st.shouldStop ? 'danger' : ''}">
      <div class="m-top"><span>${escapeHtml(p.name)}${mine ? ' (you)' : ''}</span><span>${st.level}/10 · ${st.label}</span></div>
      <div class="m-bar"><div class="m-fill" style="width:${st.level * 10}%;background:${st.color}"></div></div>
      <div class="m-stats">🍺 ${st.totalStandardDrinks} std drink${st.totalStandardDrinks === 1 ? '' : 's'} · BAC ~${st.bac}%</div>
    </div>`;
  }).join('');
  const sig = drinking + bac;
  const meters = $('#meters');
  if (meters && meters.dataset.metersSig !== sig) {
    meters.dataset.metersSig = sig;
    meters.innerHTML = (drinking ? `<div class="meters-drinking-block">${drinking}</div>` : '') + bac;
  }
}

function renderReactions(view) {
  const reactions = view.reactions || [];
  const latest = reactions[reactions.length - 1];
  if (!latest || latest.at <= S.seenReactionTs) return;
  S.seenReactionTs = latest.at;
  spawnReactionFloat(latest.emoji, latest.name);
}

function spawnReactionFloat(emoji, name) {
  const layer = $('#reaction-layer');
  const el = document.createElement('div');
  el.className = 'reaction-float';
  el.textContent = emoji;
  el.style.left = `${15 + Math.random() * 70}%`;
  el.style.bottom = `${120 + Math.random() * 80}px`;
  el.title = name || '';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function showDefenderPopup(title, sub) {
  const el = $('#defender-popup');
  el.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(sub)}</span>`;
  el.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  setTimeout(() => el.classList.add('hidden'), 2200);
}

function flashSetComplete() {
  const strip = $('#sets-compact');
  strip?.classList.add('set-flash');
  setTimeout(() => strip?.classList.remove('set-flash'), 800);
}

// ---------------------------------------------------------------------------
// DRINK SHEET
// ---------------------------------------------------------------------------
const QUICK_DRINKS = [
  { name: 'Beer', volumeMl: 330, abv: 5, sub: '330ml · 5%' },
  { name: 'Strong Beer', volumeMl: 650, abv: 8, sub: '650ml · 8%' },
  { name: 'Wine', volumeMl: 150, abv: 12, sub: '150ml · 12%' },
  { name: 'Shot', volumeMl: 40, abv: 40, sub: '40ml · 40%' },
  { name: 'Cocktail', volumeMl: 200, abv: 12, sub: '200ml · 12%' },
  { name: 'Double Shot', volumeMl: 80, abv: 40, sub: '80ml · 40%' },
];

function openDrinkSheet(reason, view = S.view) {
  closeAllSheets();
  S.drinkSheetOpen = true;
  const prompt = view?.prompt;
  const cheers = prompt?.cheers || prompt?.cheersSet
    ? {
      requireToast: !!prompt.requireToast,
      cheersToast: prompt.cheersToast || reason,
      cheersBankerName: prompt.cheersBankerName,
      cheersCard: prompt.cheersCard,
    }
    : null;
  const debt = view?.drinkEconomy?.debt;
  const debtLine = debt > 0 ? `<p class="debt-pay-hint">${debt} drink${debt !== 1 ? 's' : ''} on your tab — scan pays it down.</p>` : '';

  const close = openSheet(`
    <div class="grab"></div>
    <h3>${cheers ? '🍻 Cheers to you!' : '🍺 Drink the fuck up'}</h3>
    ${debtLine}
    <div id="drink-scanner-mount"></div>
    <div class="sheet-actions btn-set">
      <button type="button" class="btn-destructive" id="ds-skip">Chicken Out 🐔</button>
    </div>
  `);

  const mount = close.overlay?.querySelector('#drink-scanner-mount');
  const teardown = mountDrinkScanner(mount, {
    reason: reason || prompt?.reason,
    cheers,
    onConfirm: ({ drink, cheersToast }) => {
      S.socket.send({
        t: 'logDrink',
        drink,
        cheersToast: cheersToast || undefined,
      });
      S.drinkSheetOpen = false;
      close();
      teardown();
    },
  });

  close.overlay?.querySelector('#ds-skip')?.addEventListener('click', () => {
    S.socket.send({ t: 'skipDrink' });
    S.drinkSheetOpen = false;
    close();
    teardown();
  });
}

function openRulesSheet() {
  const close = openSheet(`
    <div class="grab"></div>
    <h3>Official GO FUCK YOURSELF rules</h3>
    <ol class="rules-list">
      <li><strong>Setup</strong> — shuffle the deck. <strong>2–4 players:</strong> 5 cards each. <strong>5+ players:</strong> 4 cards each. Rest is the messy pond.</li>
      <li><strong>Turn order</strong> — clockwise. Most chronically cringe person starts.</li>
      <li><strong>Your turn</strong> — pick a situation in your hand and ask: <em>"Hey, do you have a [situation]?"</em></li>
      <li><strong>They have it</strong> — they hand over <strong>every</strong> match (yes, begrudgingly). Your turn continues.</li>
      <li><strong>They don't</strong> — they say <strong>GO FUCK YOURSELF!</strong> You draw <strong>one</strong> from the pond.</li>
      <li><strong>Lucky draw</strong> — pulled the situation you asked for? Show the group and go again. Otherwise your turn ends.</li>
      <li><strong>Complete a set</strong> — 4 of the same situation → face-up. Announce: <em>"Sweet, I officially have [situation]."</em></li>
      <li><strong>Cheers to you!</strong> — when someone banks a set, everyone else says <em>"CHEERS TO [NAME] FOR THEIR [CARD]!"</em>, scans their drink, and drinks.</li>
      <li><strong>Card categories</strong> — 🔥 Filthy · ⛓️ Heavy CNC · 🎭 Kink · 💀 Family Roasts (dark parent jokes, never sexual with parents).</li>
      <li><strong>House rule</strong> — all dares are in-the-room only. No phones, no reading messages, no camera roll.</li>
      <li><strong>End game</strong> — when the pond runs out, keep playing until all sets are banked. Most sets wins. Tie? Prove yours happened IRL.</li>
    </ol>
    <div class="sheet-actions">
      <button type="button" class="btn-primary btn-play" id="rules-ok">Got it</button>
    </div>
  `);
  $('#rules-ok')?.addEventListener('click', () => close());
}

// ---------------------------------------------------------------------------
// SIDE GAMES HUB — Fucking UNO (pass-and-play, LLM scenarios via /api/host)
// ---------------------------------------------------------------------------
function sideGamesCtx() {
  const view = S.view;
  if (!view) return null;
  const players = view.players.map((p) => ({
    id: p.id,
    name: p.name,
    sex: p.sex,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    questionnaire: p.questionnaire || {},
    drinks: p.drinks || [],
    isBot: !!p.isBot,
  }));
  const current = players.find((p) => p.id === view.turnId) || players.find((p) => p.id === view.you) || players[0];
  return {
    players,
    current,
    me: view.you,
    host: async (mode, player, extra) => {
      const payload = {
        mode: mode || 'uno',
        player: player || players.find((p) => p.id === view.you) || {},
        targetPlayer: typeof extra === 'object' ? extra.targetPlayer : undefined,
        extra: typeof extra === 'string' ? extra : extra?.extra,
      };
      const text = await askHost(payload);
      return text || '';
    },
    drink: (player, reason) => {
      if (player?.id) {
        S.socket.send({
          t: 'sideGameLoss',
          loserId: player.id,
          reason: reason || 'Lost the side game — drink.',
        });
      }
      if (player?.id === view.you) {
        // Server queues pendingDrink — sheet opens from state prompt.
      } else {
        toast(`${(player?.name || 'They').split(' ')[0]} owes a drink — make 'em chug. 🍺`);
      }
    },
    logDrink: (player, drink) => {
      if (player?.id !== view.you) return;
      S.socket.send({
        t: 'logDrink',
        drink: { name: drink.name || 'Drink', volumeMl: drink.volumeMl, abv: drink.abv },
      });
    },
    toast,
    requestPenalty,
    gameMode: view.gameMode,
    goHome,
  };
}

function buildLobbyGames() {
  const root = $('#lobby-games');
  root.innerHTML = SIDE_GAMES.map((g) => `
    <button type="button" class="lobby-game" data-id="${g.id}">
      <span class="lobby-game-emoji">${g.emoji}</span>
      <span class="lobby-game-name">${escapeHtml(g.name)}</span>
      <span class="lobby-game-hint">${g.minPlayers > 1 ? '2 humans or mock' : 'solo + mock ok'}</span>
    </button>`).join('');

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.lobby-game');
    if (!btn || btn.disabled) return;
    const ctx = sideGamesCtx();
    if (!ctx) return toast('Not in a room yet, fucker.');
    launchSideGame(btn.dataset.id, ctx);
  });
}

function updateLobbyGames(connectedCount) {
  $('#lobby-games')?.querySelectorAll('.lobby-game').forEach((btn) => {
    const game = SIDE_GAMES.find((g) => g.id === btn.dataset.id);
    const min = game?.minPlayers || 1;
    const locked = connectedCount < min;
    btn.disabled = locked;
    btn.classList.toggle('locked', locked);
    btn.querySelector('.lobby-game-hint').textContent = locked
      ? `needs ${min}`
      : (game?.id === 'fuckinguno' ? 'solo + mock ok' : (min > 1 ? '2 players' : 'tap to play'));
  });
}

function openSideGames() {
  const ctx = sideGamesCtx();
  if (!ctx) return toast('Go fuck yourself first — start a game.');
  openGamesHub(ctx);
}

// ---------------------------------------------------------------------------
// WIN + INTERVENTION
// ---------------------------------------------------------------------------
function renderRecapAwardsHtml(recap) {
  if (!recap?.awards?.length) return '';
  return `<ul class="win-recap-awards">${recap.awards.map((a) =>
    `<li class="win-recap-award"><span class="win-recap-award__emoji">${a.emoji}</span><span class="win-recap-award__label">${escapeHtml(a.label)}</span><strong>${escapeHtml(a.playerName)}</strong><span class="win-recap-award__detail">${escapeHtml(a.detail)}</span></li>`,
  ).join('')}</ul>`;
}

function openWinSheet(view) {
  const winner = view.players.find((p) => p.id === view.winnerId);
  const recap = view.gameRecap;
  const iWon = view.winnerId === view.you;
  const hostWrap = view.host?.text || view.host?.line || '';
  const playedCat = recap?.categoryLabel
    ? `${recap.categoryEmoji || ''} ${recap.categoryLabel}`.trim()
    : categoryMeta(sanitizeCategories(view.cardCategories)[0]).label;

  const close = openSheet(`
    <div class="grab"></div>
    <div class="win-confetti">${iWon ? '🏆🍻🎉' : '💀🍺'}</div>
    <h3 class="win-recap-title">${escapeHtml(winner?.name?.split(' ')[0] || 'Someone')} wins</h3>
    <p class="win-recap-played muted">Round deck: ${escapeHtml(playedCat)}</p>
    ${renderRecapAwardsHtml(recap)}
    ${hostWrap ? `<div class="host-bubble inline win-recap-host">${escapeHtml(hostWrap)}</div>` : ''}
    <section class="win-next-category">
      <h4 class="win-next-category__title">Next round category</h4>
      <p class="win-next-category__hint">${S.isHost ? 'Host picks one deck — everyone plays that category next.' : 'Waiting for host to pick the next category…'}</p>
      <ul class="ios-inset-list ios-multi-select" id="win-category-picker" aria-label="Next category"></ul>
      <div id="win-deck-preview" class="deck-preview" aria-live="polite"></div>
    </section>
    <div class="sheet-actions btn-set">
      ${S.isHost ? '<button type="button" class="btn-primary btn-play" id="win-again">Deal next round</button>' : '<p class="muted">Waiting for host to deal the next round…</p>'}
      <button type="button" class="btn-secondary btn-cancel" id="win-leave">Leave</button>
    </div>
  `);

  S.cardCategories = sanitizeCategories(view.cardCategories || S.cardCategories);
  mountCategoryPicker('#win-category-picker', {
    getSelected: () => S.cardCategories,
    setSelected: (next) => {
      S.cardCategories = next;
      S.socket.send({ t: 'setCategories', categories: next });
    },
    deckPreviewEl: $('#win-deck-preview'),
    readonly: !S.isHost,
  });

  $('#win-again')?.addEventListener('click', () => { S.socket.send({ t: 'playAgain' }); close(); });
  $('#win-leave').addEventListener('click', () => leaveGame());
}

function openInterventionSheet(level) {
  const close = openSheet(`
    <div class="grab"></div>
    <h3 class="danger-h">🛑 OI — SLOW THE FUCK DOWN</h3>
    <div class="host-bubble inline">${S.view?.host?.text || `Level ${level}/10. That's enough, you drunk fuck. Water, not booze. ❤️`}</div>
    <p>You're in blackout territory. Switch to water, eat something, sit a round out before you die.</p>
    <div class="sheet-actions"><button type="button" class="btn-primary" id="iv-ok">Fucking fine — I'll drink water 💧</button></div>
  `, { danger: true });
  $('#iv-ok').addEventListener('click', () => close());
}

// ---------------------------------------------------------------------------
// SHEET / TOAST PRIMITIVES (iOS-style bottom sheets)
// ---------------------------------------------------------------------------
function openSheet(innerHtml, { danger = false, label = 'Dialog' } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', label);
  overlay.innerHTML = `<div class="sheet ${danger ? 'danger' : ''}">${innerHtml}</div>`;
  const root = $('#modal-root');
  root?.appendChild(overlay);
  const prevFocus = document.activeElement;
  const sheet = overlay.querySelector('.sheet');
  const focusable = () => [...sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
  const close = () => {
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      overlay.remove();
      if (prevFocus?.focus) prevFocus.focus();
    }, 220);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const nodes = focusable();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  bindBottomSheetGestures(overlay, close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    overlay.classList.add('show');
    (focusable()[0] || sheet)?.focus?.();
  });
  close.overlay = overlay;
  return close;
}
function closeAllSheets() {
  $$('#modal-root .sheet-overlay').forEach((o) => o.remove());
  S.drinkSheetOpen = false;
  S.chaosSheetOpen = false;
  S.penaltySheetOpen = false;
  S.createSetSheetOpen = false;
  S.createSetSheetRank = null;
  S.bluffSheetOpen = false;
  S.bluffSheetRank = null;
  $('#opponent-bar')?.classList.remove('bluff-zoom');
}

function syncCreateSetSheet(view) {
  const prompt = view.prompt;
  if (!prompt || prompt.type !== 'createSet' || view.finished) {
    if (S.createSetSheetOpen) closeAllSheets();
    return;
  }
  /* Set completion banner + animation handles create flow */
  S.createSetSheetOpen = false;
  S.createSetSheetRank = prompt.rank;
}

function syncBluffSheet(view) {
  if (view?.classicRules !== false) {
    if (S.bluffSheetOpen) closeAllSheets();
    return;
  }
  const prompt = view.prompt;
  if (!prompt || prompt.type !== 'bluff' || view.finished) {
    if (S.bluffSheetOpen) closeAllSheets();
    return;
  }
  if (S.bluffSheetOpen && S.bluffSheetRank === prompt.rank) return;

  closeAllSheets();
  S.bluffSheetOpen = true;
  S.bluffSheetRank = prompt.rank;
  $('#opponent-bar')?.classList.add('bluff-zoom');

  const artMount = buildActiveCardElement(prompt.rank);
  artMount.classList.add('bluff-card-preview');
  const askerShort = prompt.askerName?.split(' ')[0] || 'They';
  const title = prompt.doubleDown ? 'DOUBLE DOWN?' : 'YOU HAVE THIS CARD';
  const sub = prompt.doubleDown
    ? `${askerShort} asked again — lie multiplier ×${prompt.lieMultiplier || 2}`
    : `${prompt.cardCount || 1} in your hand · ${askerShort} is watching`;

  const close = openSheet(`
    <div class="bluff-sheet-dark">
      <div class="grab"></div>
      <div class="bluff-sheet-inner">
        <p class="bluff-sheet-asker">${escapeHtml(askerShort)} asked for:</p>
        <h3 class="bluff-sheet-title">${escapeHtml(title)}</h3>
        <p class="bluff-sheet-line">${escapeHtml(prompt.line || rankName(prompt.rank))}</p>
        <div class="bluff-art-wrap"></div>
        <p class="bluff-sheet-sub muted">${escapeHtml(sub)}</p>
        <div class="sheet-actions bluff-actions btn-set">
          <button type="button" class="btn-primary" id="btn-bluff-truth">✓ Tell Truth</button>
          <button type="button" class="btn-destructive" id="btn-bluff-lie">🎭 Lie</button>
        </div>
      </div>
    </div>
  `, { danger: true });

  const wrap = document.querySelector('.bluff-art-wrap');
  if (wrap) wrap.appendChild(artMount);

  $('#btn-bluff-truth')?.addEventListener('click', () => {
    S.choseLieThisRound = false;
    S.socket.send({ t: 'bluffRespond', truth: true });
    S.bluffSheetOpen = false;
    S.bluffSheetRank = null;
    $('#opponent-bar')?.classList.remove('bluff-zoom');
    close();
    haptic('medium');
  });

  $('#btn-bluff-lie')?.addEventListener('click', () => {
    S.choseLieThisRound = true;
    S.socket.send({ t: 'bluffRespond', truth: false });
    S.bluffSheetOpen = false;
    S.bluffSheetRank = null;
    $('#opponent-bar')?.classList.remove('bluff-zoom');
    close();
    showLieBadge();
    haptic('heavy');
  });
}

/** Opponent-pick penalty UI — synced from server state */
let penaltySheetEl = null;

function syncPenaltySheet(view) {
  const p = view.penalty;
  if (!p || view.finished) {
    if (penaltySheetEl) {
      penaltySheetEl.remove();
      penaltySheetEl = null;
      S.penaltySheetOpen = false;
    }
    return;
  }

  S.penaltySheetOpen = true;
  const cardLabel = `Take ${p.cardCount} cards 🂠`;
  const stripLabel = 'Strip 👙';
  const drinkLabel = 'Drink 🍺';

  let body = '';

  if (p.role === 'chooser' && p.phase === 'pick') {
    body = `
      <div class="grab"></div>
      <h3>Pick their punishment</h3>
      <p class="penalty-sub">${escapeHtml(p.victimName)} owes <strong>+${p.cardCount}</strong></p>
      <div class="penalty-options btn-set">
        ${p.options.includes('draw') ? `<button type="button" class="btn-primary penalty-opt" data-choice="draw">${cardLabel}</button>` : ''}
        ${p.options.includes('strip') ? `<button type="button" class="btn-destructive penalty-opt" data-choice="strip">${stripLabel}</button>` : ''}
        ${p.options.includes('drink') ? `<button type="button" class="btn-secondary penalty-opt" data-choice="drink">${drinkLabel}</button>` : ''}
      </div>`;
  } else if (p.role === 'victim' && p.phase === 'pick') {
    body = `
      <div class="grab"></div>
      <h3>Hang tight…</h3>
      <p class="penalty-sub">${escapeHtml(p.chooserName)} is choosing your punishment.</p>
      <div class="penalty-options penalty-options-ghost">
        ${p.options.includes('draw') ? `<div class="penalty-ghost-btn">${cardLabel}</div>` : ''}
        ${p.options.includes('strip') ? `<div class="penalty-ghost-btn">${stripLabel}</div>` : ''}
        ${p.options.includes('drink') ? `<div class="penalty-ghost-btn">${drinkLabel}</div>` : ''}
      </div>`;
  } else if (p.role === 'chooser' && p.phase === 'detail') {
    const isStrip = p.choice === 'strip';
    body = `
      <div class="grab"></div>
      <h3>${isStrip ? 'What do they strip?' : 'What do they drink?'}</h3>
      <p class="penalty-sub">${escapeHtml(p.victimName)} · ${isStrip ? 'Strip 👙' : 'Drink 🍺'}</p>
      <div class="penalty-detail-grid">
        ${(isStrip ? (p.stripPresets || []) : (p.drinkPresets || [])).map((label) =>
          `<button type="button" class="penalty-detail-btn" data-detail="${String(label).replace(/"/g, '&quot;')}">${escapeHtml(label)}</button>`
        ).join('')}
      </div>`;
  } else if (p.role === 'victim' && p.phase === 'detail') {
    body = `
      <div class="grab"></div>
      <h3>Almost…</h3>
      <p class="penalty-sub">${escapeHtml(p.chooserName)} is deciding ${p.choice === 'strip' ? 'what you strip' : 'what you drink'}.</p>`;
  } else if (p.phase === 'confirm') {
    const title = p.role === 'victim' ? 'Your punishment' : `Waiting on ${escapeHtml(p.victimName)}`;
    body = `
      <div class="grab"></div>
      <h3>${title}</h3>
      <div class="penalty-verdict">${escapeHtml(p.detail || p.choice || '')}</div>
      ${p.role === 'victim'
        ? '<div class="sheet-actions"><button type="button" class="btn-primary" id="penalty-done">Done ✓</button></div>'
        : `<p class="penalty-sub muted">Waiting for them to complete it…</p>`}
    `;
  }

  if (!penaltySheetEl) {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay penalty-overlay show';
    overlay.innerHTML = `<div class="sheet penalty-sheet">${body}</div>`;
    overlay.addEventListener('click', (e) => {
      const opt = e.target.closest('.penalty-opt');
      if (opt) {
        S.socket.send({ t: 'penaltyPick', choice: opt.dataset.choice });
        haptic('light');
        return;
      }
      const det = e.target.closest('.penalty-detail-btn');
      if (det) {
        S.socket.send({ t: 'penaltyDetail', detail: det.dataset.detail });
        haptic('light');
        return;
      }
      if (e.target.closest('#penalty-done')) {
        S.socket.send({ t: 'penaltyConfirm' });
        haptic('success');
      }
    });
    $('#modal-root').appendChild(overlay);
    penaltySheetEl = overlay;
  } else {
    penaltySheetEl.querySelector('.penalty-sheet').innerHTML = body;
  }
}

function requestPenalty(opts) {
  return new Promise((resolve, reject) => {
    if (!S.socket?.connected) {
      reject(new Error('offline'));
      return;
    }
    const timeout = setTimeout(() => {
      if (S.penaltyResolver) {
        S.penaltyResolver = null;
        reject(new Error('penalty timeout'));
      }
    }, 120000);
    S.penaltyResolver = (ev) => {
      clearTimeout(timeout);
      S.penaltyResolver = null;
      resolve(ev);
    };
    S.socket.send({ t: 'penaltyStart', ...opts });
  });
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3000);
}

init();
