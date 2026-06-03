// ===========================================================================
//  FUCKING UNO — UNO Show 'Em No Mercy rules + filthy strip/drink/LLM twists.
//  Ref: https://miexto.com/cardgames/uno-no-mercy-cards-explained/
// ===========================================================================
import { gameShell, esc, couplePlayers, burst, pick, endCard } from './ui.js';
import { renderUnoCard, renderUnoCardBack, renderUnoPhysicalDeck, renderUnoOpponentHand, cardHintText } from './uno-cards.js';
import { animateUnoPlay, animateUnoDraw, animateUnoDrawBurst, landHeroCard, shakeTable, flashStack, pulseUno, spinDirection, playSkip, playVictory } from './uno-physics.js';
import { openUnoSheet, pickColorSheet, openRulesSheet } from './uno-sheets.js';
import { createUnoBartender } from './uno-bartender.js';

const SCENARIO_TOAST = {
  SKIP: '🚫 SKIP',
  REVERSE: '⇄ REVERSE',
  'SKIP EVERYONE': '⏭ SKIP ALL',
  '7 — SWAP': '🔄 SWAP',
  '0 — PASS': '📦 PASS HANDS',
  'DISCARD ALL': '📤 DISCARD ALL',
  'Color Roulette': '🎲 ROULETTE',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const COLORS = ['red', 'yellow', 'green', 'blue'];
const COLOR_LABEL = { red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue', wild: 'Wild' };
const COLOR_HEX = { red: '#E40521', yellow: '#FFCD00', green: '#009246', blue: '#0081CD', wild: '#000000' };
const MERCY_LIMIT = 25;

/** Draw types that can stack (not plain wild). */
const STACK_TYPES = new Set(['draw2', 'draw4', 'wildDraw6', 'wildDraw10', 'wildColorRoulette', 'wildReverseDraw4']);

const CARD_META = {
  skip: { display: 'SKIP', sub: 'Skip turn' },
  reverse: { display: 'REVERSE', sub: 'Flip order' },
  draw2: { display: '+2', sub: 'Draw two' },
  draw4: { display: '+4', sub: 'Draw four' },
  skipEveryone: { display: 'SKIP ALL', sub: 'Go again' },
  discardAll: { display: 'DROP ALL', sub: 'Same color' },
  wild: { display: 'WILD', sub: 'Pick color' },
  wildColorRoulette: { display: 'ROULETTE', sub: 'Draw til color' },
  wildReverseDraw4: { display: 'REV +4', sub: 'Reverse draw' },
  wildDraw6: { display: '+6', sub: 'Draw six' },
  wildDraw10: { display: '+10', sub: 'Draw ten' },
};

const STATS_KEY = 'gfy_uno_stats';
const BOT_TAUNTS = [
  '{name} is plotting something filthy…',
  '{name} stole your color.',
  '{name} stacked another draw — absolute violence.',
  '{name} wants you stripped and suffering.',
  '{name} is grinning. Bad sign.',
];

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

function botPersona(seats, seat) {
  const n = (seats[seat]?.name || '').toLowerCase();
  if (n.includes('nandini')) {
    return { name: 'Nandini', title: 'The Chaos Goblin', mood: 'Aggressive', emoji: '😈' };
  }
  return { name: 'Kunal', title: 'The Dominator', mood: 'Savage', emoji: '👑' };
}

const FALLBACK_SCENARIOS = {
  draw2: ['{name}, lap-grind {target} fifteen seconds or take those cards, fucker.'],
  draw4: ['{name}, strip for {target} or eat every fucking card.'],
  wildDraw6: ['{name}, six cards or strip naked to the waist — {target} watches.'],
  wildDraw10: ['{name}, ten cards or lose two clothing items. No mercy.'],
  wildColorRoulette: ['{name}, roulette fucked you — {target} picks a filthy dare while you keep drawing.'],
  wildReverseDraw4: ['{name}, reversed and wrecked — strip or take the stack.'],
  skip: ['{name} got skipped — {target} assigns a bite, choke, or make-out.'],
  skipEveryone: ['{name} skipped everyone — victory lap: dry-hump {target} ten seconds.'],
  reverse: ['{name}, reverse the vibe — {target} picks your pose for thirty seconds.'],
  wild: ['{name}, wild night — {target} picks a body part to worship.'],
  swap7: ['{name} swapped hands on a 7 — {target} makes you describe every card you just stole.'],
  pass0: ['{name}, zero mercy pass — hands rotated, {target} gets a free grope.'],
  discardAll: ['{name} dumped a color — {target} picks what you do with the empty hand energy.'],
  uno: ['{name} forgot UNO — spank from {target} or chug.'],
  mercy: ['{name} hit 25 cards — mercy killed you. {target} wins the round. Drink up.'],
  win: ['{name} wins No Mercy UNO — {target} drinks and submits to the victory dare.'],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const deck = [];
  let id = 0;
  const add = (card) => deck.push({ ...card, id: id++ });

  for (const color of COLORS) {
    add({ color, type: 'number', value: 0 });
    for (let v = 1; v <= 9; v++) {
      add({ color, type: 'number', value: v });
      add({ color, type: 'number', value: v });
    }
    for (let i = 0; i < 3; i++) add({ color, type: 'skip', value: null });
    for (let i = 0; i < 3; i++) add({ color, type: 'reverse', value: null });
    for (let i = 0; i < 2; i++) add({ color, type: 'draw2', value: null });
    for (let i = 0; i < 2; i++) add({ color, type: 'draw4', value: null });
    for (let i = 0; i < 2; i++) add({ color, type: 'skipEveryone', value: null });
    for (let i = 0; i < 3; i++) add({ color, type: 'discardAll', value: null });
  }

  for (let i = 0; i < 4; i++) add({ color: 'wild', type: 'wild', value: null });
  for (let i = 0; i < 8; i++) add({ color: 'wild', type: 'wildColorRoulette', value: null });
  for (let i = 0; i < 8; i++) add({ color: 'wild', type: 'wildReverseDraw4', value: null });
  for (let i = 0; i < 4; i++) add({ color: 'wild', type: 'wildDraw6', value: null });
  for (let i = 0; i < 4; i++) add({ color: 'wild', type: 'wildDraw10', value: null });

  return shuffle(deck);
}

function isWildCard(c) {
  return c?.color === 'wild' || c?.type?.startsWith('wild');
}


function topCard(state) {
  return state.discard[state.discard.length - 1];
}

function effectiveColor(state) {
  const t = topCard(state);
  if (!t || isWildCard(t)) return state.currentColor;
  return t.color;
}

function canPlay(card, state) {
  if (!card || state.eliminated[state.turn]) return false;

  if (state.drawStack && STACK_TYPES.has(state.drawStack.type)) {
    return card.type === state.drawStack.type;
  }

  if (isWildCard(card)) return true;
  if (card.type === 'discardAll') return true;

  const top = topCard(state);
  if (!top) return true;
  const col = effectiveColor(state);

  if (card.color === col) return true;
  if (card.type === top.type) {
    if (card.type === 'number') return card.value === top.value;
    return true;
  }
  return false;
}

function drawCards(state, seat, n) {
  for (let i = 0; i < n; i++) {
    if (!state.deck.length) {
      const keep = state.discard.pop();
      const rest = state.discard.filter((c) => !isWildCard(c) || c.type === 'wild');
      state.deck = shuffle(rest.length ? rest : state.discard);
      state.discard = keep ? [keep] : [];
    }
    if (state.deck.length) state.hands[seat].push(state.deck.pop());
  }
}

function launch(ctx) {
  const [pa, pb] = couplePlayers(ctx);
  if (!pa || !pb) {
    const s = gameShell({ title: 'Fucking UNO', emoji: '🃏', onHome: ctx.goHome });
    s.body.innerHTML = `<div class="sg-empty">Need players for Fucking UNO.</div>`;
    return s;
  }

  const seats = [pa, pb];
  const mockMode = seats.some((p) => p.isBot);
  let humanSeat = seats.findIndex((p) => p.id === ctx.me);
  if (humanSeat < 0) humanSeat = seats.findIndex((p) => !p.isBot);
  if (humanSeat < 0) humanSeat = 0;
  const passAndPlay = !mockMode;

  const shell = gameShell({
    title: 'Fucking UNO',
    emoji: '🃏',
    theme: 'fuckinguno',
    subtitle: '',
    onHome: ctx.goHome,
  });

  let state = null;
  let blocking = false;
  let botRunning = false;
  let feed = [];
  let feedHistory = [];
  let stats = { wins: 0, streak: 0, bestStack: 0, cardsForced: 0, ...loadStats() };
  let flashTimer = null;
  let lastHeroKey = '';
  let layoutReady = false;
  let bartender = null;
  let mercyWarned = [false, false];
  let lastTurnAnnounced = -1;

  const toastRoot = () => shell.panel;
  const $uno = (sel) => toastRoot()?.querySelector(sel);

  function showUnoToast(text, ms = 2200) {
    const el = $uno('#uno-toast');
    if (!el || !text) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(showUnoToast._t);
    showUnoToast._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  function pushFeed(text) {
    feed.push({ text, at: Date.now() });
    if (feed.length > 3) feed.shift();
    feedHistory.push({ text, at: Date.now() });
    if (feedHistory.length > 40) feedHistory.shift();
    showUnoToast(text);
  }

  function flash(msg, kind = 'neutral') {
    const el = $uno('#uno-flash');
    if (!el) return;
    el.className = `uno-reaction-flash show ${kind}`;
    el.textContent = kind === 'uno' ? '⚠️ UNO!' : msg;
    clearTimeout(flashTimer);
    if (kind === 'uno' && navigator.vibrate) navigator.vibrate([40, 60, 40]);
    flashTimer = setTimeout(() => el.classList.remove('show'), kind === 'uno' ? 1400 : 1200);
  }

  function autoCallUno(seat) {
    if (state.unoCalled[seat]) return;
    state.unoCalled[seat] = true;
    pushFeed('UNO!');
    pulseUno();
    bartender?.reactEvent('uno', { seat });
    burst(shell.body.querySelector('#uno-hero') || shell.panel, { emojis: ['🎉', '⚠️', '🃏'], count: 14 });
  }

  const firstName = (p) => (p?.name || 'Player').split(/\s+/)[0];
  const isBotSeat = (seat) => !!seats[seat]?.isBot;
  const partner = (seat) => seats[1 - seat];
  const nextSeat = (seat) => (seat + state.direction + 2) % 2;

  async function scenarioFor(seat, kind, extra = '') {
    const player = seats[seat];
    let line = '';
    try {
      line = await ctx.host?.('uno', player, {
        targetPlayer: partner(seat).name,
        extra: `UNO No Mercy — ${kind}. ${extra}`,
      });
    } catch { /* offline */ }
    if (!line) {
      const bank = FALLBACK_SCENARIOS[kind] || FALLBACK_SCENARIOS.wild;
      line = pick(bank).replaceAll('{name}', firstName(player)).replaceAll('{target}', firstName(partner(seat)));
    }
    return line;
  }

  async function showScenario(seat, title, line) {
    const toast = SCENARIO_TOAST[title] || title;
    feedHistory.push({ title, text: line, at: Date.now() });
    if (feedHistory.length > 40) feedHistory.shift();
    showUnoToast(toast);
    if (title.includes('REVERSE')) {
      spinDirection($uno('#uno-direction'), state.direction);
    }
    await delay(isBotSeat(seat) ? 320 : 480);
  }

  function showChoiceModal(title, body, buttons) {
    blocking = true;
    return new Promise((resolve) => {
      openUnoSheet({
        title,
        body: body.replace(/<[^>]+>/g, ' ').trim(),
        primaryLabel: buttons.find((b) => !b.ghost && !b.danger)?.label || buttons[0]?.label,
        secondaryLabel: buttons.find((b) => b.ghost || b.danger)?.label,
        onPrimary: () => {
          blocking = false;
          resolve(buttons.find((b) => !b.ghost && !b.danger)?.key || buttons[0]?.key);
        },
        onSecondary: () => {
          blocking = false;
          resolve(buttons.find((b) => b.ghost || b.danger)?.key);
        },
      });
    });
  }

  async function pickColor(playedBy, title = 'Pick a color') {
    if (isBotSeat(playedBy)) {
      const counts = {};
      for (const c of state.hands[playedBy]) {
        if (!isWildCard(c)) counts[c.color] = (counts[c.color] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || pick(COLORS);
    }
    blocking = true;
    const col = await pickColorSheet(title);
    blocking = false;
    return col;
  }

  async function resolveDrawPenalty(victim, drawType, count) {
    const kind = drawType === 'draw2' ? 'draw2' : drawType;
    const victimPlayer = seats[victim];
    const canMultiplayer = ctx.requestPenalty && !isBotSeat(victim);

    if (canMultiplayer) {
      try {
        const result = await ctx.requestPenalty({
          victimId: victimPlayer.id,
          cardCount: count,
          drawType: kind,
          source: 'uno',
        });
        return { viaServer: true, ...result };
      } catch {
        /* fall through to local modal */
      }
    }

    if (isBotSeat(victim)) {
      if (kind === 'draw2') return { choice: Math.random() < 0.3 ? 'drink' : 'draw' };
      return { choice: state.strips[victim] < 4 && Math.random() < 0.35 ? 'strip' : 'draw' };
    }
    if (kind === 'draw2') {
      return {
        choice: await showChoiceModal(
          `${firstName(seats[victim])} — +${count}!`,
          `<p class="uno-modal-sub">Stacked penalty. Take <b>${count} cards</b> or <b>drink</b>.</p>`,
          [{ key: 'draw', label: `Take ${count} cards` }, { key: 'drink', label: 'Drink', ghost: true }]
        ),
      };
    }
    return {
      choice: await showChoiceModal(
        `${firstName(seats[victim])} — +${count}!`,
        `<p class="uno-modal-sub">No Mercy. Take <b>${count} cards</b> or <b>strip</b>.</p>`,
        [{ key: 'draw', label: `Take ${count} cards` }, { key: 'strip', label: 'Strip', danger: true }]
      ),
    };
  }

  async function applyDrawPenalty(victim, drawType, count) {
    const resolved = await resolveDrawPenalty(victim, drawType, count);
    const choice = resolved.viaServer ? resolved.choice : resolved.choice || resolved;

    if (choice === 'strip') {
      state.strips[victim]++;
      const detail = resolved.detail || `Strip instead of ${count} cards.`;
      const line = await scenarioFor(victim, drawType, detail);
      await showScenario(victim, resolved.detail || `+${count} or strip`, line);
    } else if (choice === 'drink') {
      ctx.drink?.(seats[victim], resolved.detail || `Drank instead of +${count} in Fucking UNO.`);
    } else {
      const deckEl = shell.body?.querySelector('#uno-draw');
      const handEl = shell.body?.querySelector('#uno-hand');
      drawCards(state, victim, count);
      pushFeed(`😭 ${firstName(seats[victim]).toUpperCase()} DREW ${count}`);
      stats.cardsForced = (stats.cardsForced || 0) + count;
      if (count >= 4) {
        await animateUnoDrawBurst(deckEl, handEl, count);
        bartender?.reactDraw(victim, count);
      } else {
        await animateUnoDraw(deckEl, handEl);
        if (count >= 2) bartender?.reactDraw(victim, count);
      }
    }
    state.drawStack = null;
    await checkMercy(victim);
  }

  async function colorRoulette(victim, color) {
    const drawn = [];
    let match = null;
    while (state.deck.length) {
      const c = state.deck.pop();
      drawn.push(c);
      if (!isWildCard(c) && c.color === color) { match = c; break; }
    }
    state.hands[victim].push(...drawn);
    const line = await scenarioFor(victim, 'wildColorRoulette', `Drew ${drawn.length} cards hunting ${color}.`);
    await showScenario(victim, 'Color Roulette', line);
    await checkMercy(victim);
  }

  async function checkMercy(seat) {
    const n = state.hands[seat].length;
    if (n >= 22 && n < MERCY_LIMIT && !mercyWarned[seat]) {
      mercyWarned[seat] = true;
      bartender?.reactEvent('mercyWarn', { seat });
    }
    if (n >= MERCY_LIMIT) {
      bartender?.showMercyWarning(seat, n);
      await delay(1400);
      state.eliminated[seat] = true;
      const line = await scenarioFor(seat, 'mercy', `${firstName(seats[seat])} eliminated at ${n} cards.`);
      bartender?.reactEvent('mercyOut', { seat });
      await showScenario(seat, 'MERCY RULE — OUT', line);
      if (state.eliminated[0] && state.eliminated[1]) return;
      const winner = state.eliminated[0] ? 1 : 0;
      await finishGame(winner, 'mercy');
      return true;
    }
    return false;
  }

  async function checkWin(seat) {
    if (state.hands[seat].length === 0) {
      await finishGame(seat, 'empty');
      return true;
    }
    return false;
  }

  function reset() {
    botRunning = false;
    blocking = false;
    const deck = buildDeck();
    const hands = [[], []];
    for (let i = 0; i < 14; i++) hands[i % 2].push(deck.pop());
    let discard = [];
    while (deck.length) {
      const c = deck.pop();
      if (isWildCard(c)) deck.unshift(c);
      else { discard.push(c); break; }
    }
    state = {
      hands,
      deck,
      discard,
      turn: 0,
      direction: 1,
      currentColor: discard[0] && !isWildCard(discard[0]) ? discard[0].color : pick(COLORS),
      strips: [0, 0],
      eliminated: [false, false],
      over: false,
      unoCalled: [false, false],
      drawStack: null,
    };
    mercyWarned = [false, false];
    lastTurnAnnounced = -1;
    feed = [{ text: 'Game on — go fuck yourself', at: Date.now() }];
    bartender?.startAmbient(() => state);
    render();
  }

  function unoFanLayout(i, total) {
    if (total <= 1) return { rot: 0, arc: 0, overlap: 0 };
    const mid = (total - 1) / 2;
    const t = total > 10 ? 10 / total : 1;
    const maxRot = total <= 5 ? 18 : total <= 8 ? 24 : 28;
    const rot = mid ? ((i - mid) / mid) * maxRot * t : 0;
    const arc = Math.pow(Math.abs(i - mid) / Math.max(mid, 1), 1.4) * (total > 6 ? 10 : 14);
    const overlap = total > 12 ? -48 : total > 9 ? -44 : total > 6 ? -40 : -36;
    return { rot, arc, overlap };
  }

  function ensureLayout() {
    if (layoutReady) return;
    layoutReady = true;

    const float = document.createElement('div');
    float.className = 'uno-float-layer';
    float.innerHTML = `
      <div class="uno-reaction-flash" id="uno-flash"></div>
      <div class="uno-stack-toast" id="uno-stack-toast"></div>
      <div class="uno-toast" id="uno-toast"></div>
      <div class="uno-card-hint hidden" id="uno-card-hint" role="tooltip"></div>`;
    shell.panel.appendChild(float);

    bartender = createUnoBartender(float, {
      nameOf: (seat) => firstName(seats[seat]),
    });
    bartender.startAmbient(() => state);

    shell.body.innerHTML = `
      <div class="uno-app">
        <div class="uno-chrome">
          <button type="button" class="uno-icon-btn" id="uno-rules-btn" aria-label="Rules">ⓘ</button>
          <span class="uno-turn-dot hidden" id="uno-turn-dot" aria-hidden="true"></span>
        </div>
        <div class="uno-table">
          <div class="uno-opponent-zone" id="uno-opponent-zone"></div>
          <div class="uno-direction" id="uno-direction" data-dir="cw" aria-hidden="true">⇄</div>
          <div class="uno-hero-card" id="uno-hero"></div>
          <button type="button" class="uno-deck-big" id="uno-draw" aria-label="Draw">
            <div class="uno-deck-cards" id="uno-deck-stack"></div>
            <span class="uno-deck-count" id="uno-deck-count"></span>
          </button>
        </div>
        <div class="uno-hand-dock">
          <div class="uno-hand" id="uno-hand"></div>
        </div>
      </div>`;

    shell.body.addEventListener('click', (e) => {
      if (e.target.closest('#uno-draw')) takeDrawOrDrawOne();
      if (e.target.closest('#uno-rules-btn')) openRulesSheet({ stats, history: feedHistory });
    });
  }

  function hideCardHint() {
    $uno('#uno-card-hint')?.classList.add('hidden');
  }

  function showCardHint(text, x, y) {
    const el = $uno('#uno-card-hint');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.left = `${Math.min(Math.max(x, 60), window.innerWidth - 60)}px`;
    el.style.top = `${Math.max(y - 48, 12)}px`;
  }

  function wireHandCard(btn, card, idx) {
    let holdTimer = null;
    btn.addEventListener('pointerdown', (e) => {
      holdTimer = setTimeout(() => {
        showCardHint(cardHintText(card), e.clientX, e.clientY);
        if (navigator.vibrate) navigator.vibrate(4);
      }, 420);
    });
    const clear = () => {
      clearTimeout(holdTimer);
      hideCardHint();
    };
    btn.addEventListener('pointerup', clear);
    btn.addEventListener('pointerleave', clear);
    btn.addEventListener('pointercancel', clear);
    btn.onclick = () => playCard(idx);
  }

  function render() {
    if (!state) return;
    ensureLayout();

    const cur = state.turn;
    const top = topCard(state);
    const showHandSeat = mockMode ? humanSeat : cur;
    const hand = state.hands[showHandSeat];
    const botThinking = mockMode && isBotSeat(cur) && !blocking;
    const isYourTurn = !mockMode ? cur === showHandSeat : cur === humanSeat;
    const canAct = !blocking && !botThinking && isYourTurn;

    const opponentSeat = mockMode ? (1 - humanSeat) : (1 - showHandSeat);
    const oppName = firstName(seats[opponentSeat]);
    const oppEmoji = isBotSeat(opponentSeat) ? '😈' : '🎭';
    const heroKey = top ? `${top.color}-${top.type}-${top.value}` : '';

    const app = shell.body.querySelector('.uno-app');
    app.className = `uno-app ${isYourTurn ? 'your-turn' : 'their-turn'}`;

    $uno('#uno-turn-dot')?.classList.toggle('hidden', !isYourTurn);

    const dirEl = shell.body.querySelector('#uno-direction');
    if (dirEl) dirEl.dataset.dir = state.direction >= 0 ? 'cw' : 'ccw';

    if (state.turn !== lastTurnAnnounced && !state.over) {
      lastTurnAnnounced = state.turn;
      bartender?.announceTurn(state.turn, effectiveColor(state));
      const oppHand = state.hands[1 - (mockMode ? humanSeat : state.turn)];
      bartender?.checkClutch(1 - state.turn, oppHand.length);
    }

    const oppZone = shell.body.querySelector('#uno-opponent-zone');
    if (botThinking) {
      oppZone.innerHTML = `<div class="uno-thinking">${oppEmoji} Thinking…</div>`;
    } else {
      oppZone.innerHTML = `
        <div class="uno-opponent-bar">
          <span class="opp-emoji">${oppEmoji}</span>
          <span class="opp-name">${esc(oppName)}</span>
        </div>
        <div class="uno-opponent-hand">${renderUnoOpponentHand(state.hands[opponentSeat].length)}</div>`;
    }

    const heroEl = shell.body.querySelector('#uno-hero');
    if (heroKey !== lastHeroKey) {
      heroEl.innerHTML = top ? renderUnoCard(top, { large: true }) : '';
      lastHeroKey = heroKey;
      requestAnimationFrame(() => landHeroCard(heroEl));
    }

    const drawBtn = shell.body.querySelector('#uno-draw');
    drawBtn.disabled = !canAct;
    shell.body.querySelector('#uno-deck-stack').innerHTML = renderUnoPhysicalDeck(state.deck.length);
    shell.body.querySelector('#uno-deck-count').textContent = state.deck.length || '';

    const handEl = shell.body.querySelector('#uno-hand');
    handEl.innerHTML = '';
    if (!botThinking) {
      hand.forEach((card, idx) => {
        const playable = canAct && canPlay(card, state);
        const { rot, arc, overlap } = unoFanLayout(idx, hand.length);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `uno-hand-card${playable ? ' playable' : ''}`;
        btn.style.setProperty('--uno-rot', `${rot}deg`);
        btn.style.setProperty('--uno-arc', `${-arc}px`);
        btn.style.setProperty('--uno-overlap', `${overlap}px`);
        btn.style.setProperty('--uno-z', idx + 1);
        btn.innerHTML = renderUnoCard(card);
        btn.disabled = !playable;
        btn.setAttribute('aria-label', cardHintText(card));
        wireHandCard(btn, card, idx);
        handEl.appendChild(btn);
      });
      if (hand.length > 5) {
        const mid = Math.floor(hand.length / 2);
        requestAnimationFrame(() => {
          const midCard = handEl.children[mid];
          midCard?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        });
      }
    }

    if (botThinking && !botRunning) queueBotTurn();
  }

  function botTauntLine(seat) {
    const p = botPersona(seats, seat);
    return pick(BOT_TAUNTS).replaceAll('{name}', p.name);
  }

  async function takeDrawOrDrawOne() {
    if (blocking || state.over) return;
    if (mockMode && state.turn !== humanSeat) return;
    const seat = state.turn;
    if (state.drawStack) {
      await applyDrawPenalty(seat, state.drawStack.type, state.drawStack.count);
      state.turn = nextSeat(seat);
      render();
      return;
    }
    drawCards(state, seat, 1);
    pushFeed(`🂠 drew`);
    const deckEl = shell.body?.querySelector('#uno-draw');
    const handEl = shell.body?.querySelector('#uno-hand');
    await animateUnoDraw(deckEl, handEl);
    await checkMercy(seat);
    state.turn = nextSeat(seat);
    render();
  }

  async function queueBotTurn() {
    if (botRunning || blocking || state.over || !isBotSeat(state.turn)) return;
    botRunning = true;
    await delay(600 + Math.random() * 700);
    try { await botPlayTurn(); } finally { botRunning = false; }
  }

  async function botPlayTurn() {
    const seat = state.turn;
    const hand = state.hands[seat];

    if (state.drawStack) {
      const stackIdx = hand.findIndex((c) => c.type === state.drawStack.type);
      if (stackIdx >= 0 && Math.random() < 0.55) {
        await playCard(stackIdx);
        return;
      }
      await applyDrawPenalty(seat, state.drawStack.type, state.drawStack.count);
      state.turn = nextSeat(seat);
      render();
      return;
    }

    const options = hand.map((c, i) => ({ c, i })).filter(({ c }) => canPlay(c, state));
    if (options.length) {
      const nasty = options.filter(({ c }) => c.type !== 'number');
      const chosen = nasty.length && Math.random() < 0.5 ? pick(nasty) : pick(options);
      await playCard(chosen.i);
    } else {
      drawCards(state, seat, 1);
      pushFeed(`🂠 ${firstName(seats[seat])} drew`);
      await checkMercy(seat);
      state.turn = nextSeat(seat);
      render();
    }
  }

  async function playCard(handIdx) {
    if (blocking || state.over || state.eliminated[state.turn]) return;
    const seat = state.turn;
    if (mockMode && seat !== humanSeat && !isBotSeat(seat)) return;

    const card = state.hands[seat][handIdx];
    if (!canPlay(card, state)) return;

    const handEl = shell.body?.querySelector(`#uno-hand .uno-hand-card:nth-child(${handIdx + 1})`);
    const heroEl = shell.body?.querySelector('#uno-hero');
    const humanPlay = !isBotSeat(seat) && (mockMode ? seat === humanSeat : true);

    if (humanPlay && handEl && heroEl) {
      await animateUnoPlay(handEl, heroEl);
    }

    if (state.drawStack && card.type === state.drawStack.type) {
      state.hands[seat].splice(handIdx, 1);
      state.discard.push(card);
      const add = card.type === 'draw2' ? 2 : card.type === 'draw4' ? 4 : card.type === 'wildDraw6' ? 6 : card.type === 'wildDraw10' ? 10 : card.type === 'wildReverseDraw4' ? 4 : 0;
      state.drawStack.count += add;
      if (state.drawStack.count > (stats.bestStack || 0)) stats.bestStack = state.drawStack.count;
      if (!isWildCard(card)) state.currentColor = card.color;
      pushFeed(`🔥 +${state.drawStack.count} stacked`);
      flashStack(state.drawStack.count);
      bartender?.recordStack(state.drawStack.count);
      shakeTable(shell.body?.querySelector('.uno-table'), { strength: 4 });
      state.turn = nextSeat(seat);
      render();
      return;
    }

    state.hands[seat].splice(handIdx, 1);
    state.discard.push(card);
    state.unoCalled[seat] = false;
    state.drawStack = null;
    bartender?.recordPlay(seat);

    if (!isWildCard(card)) state.currentColor = card.color;

    if (await checkWin(seat)) return;

    if (state.hands[seat].length === 1) {
      autoCallUno(seat);
    }

    await resolveCard(card, seat);
  }

  async function resolveCard(card, seat) {
    const victim = nextSeat(seat);

    if (card.type === 'number' && card.value === 7) {
      const other = partner(seat);
      const tmp = state.hands[seat];
      state.hands[seat] = state.hands[1 - seat];
      state.hands[1 - seat] = tmp;
      const line = await scenarioFor(seat, 'swap7', `Swapped with ${firstName(other)}.`);
      await showScenario(seat, '7 — SWAP', line);
      state.turn = nextSeat(seat);
      render();
      return;
    }

    if (card.type === 'number' && card.value === 0) {
      const p0 = [...state.hands[0]];
      const p1 = [...state.hands[1]];
      if (state.direction === 1) {
        state.hands[0] = p1;
        state.hands[1] = p0;
      } else {
        state.hands[0] = p1;
        state.hands[1] = p0;
      }
      const line = await scenarioFor(seat, 'pass0', 'All hands passed.');
      await showScenario(seat, '0 — PASS', line);
      state.turn = nextSeat(seat);
      render();
      return;
    }

    if (card.type === 'skip') {
      playSkip();
      const line = await scenarioFor(victim, 'skip', 'Skipped.');
      bartender?.recordSkip(victim);
      await showScenario(victim, 'SKIP', line);
      state.turn = nextSeat(victim);
      render();
      return;
    }

    if (card.type === 'reverse') {
      state.direction *= -1;
      const line = await scenarioFor(victim, 'reverse', 'Direction reversed.');
      bartender?.reactEvent('reverse', { seat: victim });
      await showScenario(victim, 'REVERSE', line);
      state.turn = nextSeat(victim);
      render();
      return;
    }

    if (card.type === 'skipEveryone') {
      const line = await scenarioFor(seat, 'skipEveryone', 'Another turn.');
      await showScenario(seat, 'SKIP EVERYONE', line);
      state.turn = seat;
      render();
      return;
    }

    if (card.type === 'discardAll') {
      const col = card.color;
      const kept = state.hands[seat].filter((c) => c.color !== col);
      state.hands[seat] = kept;
      const line = await scenarioFor(seat, 'discardAll', `Discarded all ${col}.`);
      await showScenario(seat, 'DISCARD ALL', line);
      if (await checkWin(seat)) return;
      state.turn = nextSeat(seat);
      render();
      return;
    }

    if (card.type === 'draw2') {
      state.drawStack = { type: 'draw2', count: 2 };
      pushFeed(`+2 → ${firstName(seats[victim])}`);
      state.turn = victim;
      render();
      return;
    }

    if (card.type === 'draw4') {
      state.drawStack = { type: 'draw4', count: 4 };
      pushFeed(`🔥 +4 → ${firstName(seats[victim])}`);
      shakeTable(shell.body?.querySelector('.uno-table'), { strength: 8 });
      state.turn = victim;
      render();
      return;
    }

    if (card.type === 'wild') {
      state.currentColor = await pickColor(seat);
      pushFeed(`${COLOR_LABEL[state.currentColor]}`);
      bartender?.reactEvent('colorChange', { seat });
      const line = await scenarioFor(victim, 'wild', `Color: ${state.currentColor}`);
      await showScenario(victim, 'WILD', line);
      state.turn = victim;
      render();
      return;
    }

    if (card.type === 'wildDraw6') {
      state.currentColor = await pickColor(seat, 'Wild +6 — pick color');
      state.drawStack = { type: 'wildDraw6', count: 6 };
      pushFeed(`+6 WILD`);
      flashStack(6);
      shakeTable(shell.body?.querySelector('.uno-table'), { strength: 10 });
      state.turn = victim;
      render();
      return;
    }

    if (card.type === 'wildDraw10') {
      state.currentColor = await pickColor(seat, 'Wild +10 — pick color');
      state.drawStack = { type: 'wildDraw10', count: 10 };
      pushFeed(`+10 WILD`);
      flashStack(10);
      shakeTable(shell.body?.querySelector('.uno-table'), { strength: 12 });
      state.turn = victim;
      render();
      return;
    }

    if (card.type === 'wildColorRoulette') {
      const col = await pickColor(seat, 'Color Roulette — pick color');
      state.currentColor = col;
      await colorRoulette(victim, col);
      state.turn = nextSeat(victim);
      render();
      return;
    }

    if (card.type === 'wildReverseDraw4') {
      state.direction *= -1;
      // 2-player No Mercy: YOU draw 4 (not the opponent)
      state.drawStack = { type: 'wildReverseDraw4', count: 4 };
      state.turn = seat;
      const line = await scenarioFor(seat, 'wildReverseDraw4', 'Wild reverse +4 — you eat it in 2-player.');
      await showScenario(seat, 'WILD REVERSE +4', line);
      render();
      return;
    }

    state.turn = nextSeat(seat);
    render();
  }

  async function finishGame(winnerSeat, how) {
    state.over = true;
    bartender?.stopAmbient();
    const winner = seats[winnerSeat];
    const loser = seats[1 - winnerSeat];
    if (winnerSeat === humanSeat || !mockMode) {
      stats.wins = (stats.wins || 0) + 1;
      stats.streak = (stats.streak || 0) + 1;
    } else {
      stats.streak = 0;
    }
    saveStats(stats);
    playVictory();
    burst(shell.body);
    flash('YOU WIN!', 'nice');
    pushFeed(`🏆 ${firstName(winner)}`);
    const line = await scenarioFor(winnerSeat, 'win', how === 'mercy' ? 'Mercy elimination win.' : 'Emptied hand.');
    const vStats = bartender?.getVictoryCopy(winnerSeat) || {};
    endCard(shell.body, {
      title: `🏆 ${firstName(winner).toUpperCase()} WINS`,
      html: `
        <div class="uno-victory-stats">
          <div class="uno-victory-stat"><span>Cards Played</span><strong>${vStats.cardsPlayed ?? '—'}</strong></div>
          <div class="uno-victory-stat"><span>Biggest Combo</span><strong>+${vStats.biggestCombo ?? stats.bestStack ?? 0}</strong></div>
          <div class="uno-victory-stat"><span>Cards Forced on Loser</span><strong>${vStats.timesDrawn ?? stats.cardsForced ?? 0}</strong></div>
        </div>
        <div class="uno-victory-bartender">
          <p class="uno-victory-bartender-label">🍸 Bartender says</p>
          <p class="uno-victory-bartender-line">"${esc(vStats.bartenderLine || line)}"</p>
        </div>
        <p class="uno-victory-sub">${how === 'mercy' ? 'Mercy rule.' : 'No Mercy.'} ${esc(firstName(loser))} drinks.</p>`,
      btnLabel: 'Deal again',
      onAgain: reset,
      extraBtn: { label: 'Close', onClick: () => { bartender?.destroy(); shell.close(); } },
    });
    if (!loser.isBot || !mockMode) ctx.drink?.(loser, `${firstName(loser)} lost Fucking UNO.`);
  }

  reset();
  const origClose = shell.close;
  shell.close = () => {
    bartender?.destroy();
    origClose();
  };
  return shell;
}

export default {
  id: 'fuckinguno',
  name: 'Fucking UNO',
  emoji: '🃏',
  accent: '#e8182a',
  tagline: 'No Mercy · stack · strip or draw',
  minPlayers: 1,
  launch,
};
