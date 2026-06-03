// UNO No Mercy — bartender commentator (Hearthstone-style bubbles + session memory).
import { pick } from './ui.js';

const DRAW_LINES = {
  small: [
    'That ain\'t so bad. Drink and move on.',
    'Light tap. Keep playing.',
    'Could be worse. Way worse.',
  ],
  medium: [
    'Jesus Christ. That\'s a whole new hand.',
    'Oof. That stings.',
    'The deck just punched you in the mouth.',
  ],
  heavy: [
    'Holy fuck. You gonna need a drink after that.',
    'That\'s not a penalty — that\'s a lifestyle.',
    'Call an ambulance.',
  ],
  freight: [
    'Bro got hit by a freight train.',
    'That hand is a fucking novel now.',
    'At this point the deck lives in your hand.',
  ],
};

const EVENT_LINES = {
  stack: [
    'Stacked again — absolute violence.',
    'Oh we\'re doing this? Fine.',
    'That stack is getting obscene.',
  ],
  reverse: [
    'Direction flipped. Chaos engaged.',
    'Reverse! Table just turned.',
    'Plot twist — enjoy the whiplash.',
  ],
  skip: [
    'Skipped. Sit down.',
    'Not your turn. Not your problem.',
    'Benched. Watch and suffer.',
  ],
  skipStreak: [
    '{name} hasn\'t played in 4 business days.',
    '{name} is legally unemployed at this table.',
    'Does {name} even have cards anymore?',
  ],
  colorChange: [
    'That\'s some evil genius shit.',
    'Color change — psychological warfare.',
    'Cold-blooded color pick.',
  ],
  uno: [
    'ONE CARD. Everybody panic.',
    'UNO! The room just got tense.',
    'OOOOOOOH — UNO!',
  ],
  unoMiss: [
    'How do you forget the only rule?',
    'Missed UNO? Drink. Obviously.',
  ],
  clutch: [
    'Dangerously close.',
    'One card away from humiliation.',
  ],
  mercyWarn: [
    'This hand is becoming a fucking novel.',
    'Mercy rule is breathing down your neck.',
    '25 cards? That\'s not UNO — that\'s hoarding.',
  ],
  mercyOut: [
    'Mercy killed you. Drink and reflect.',
    'Eliminated. The deck won.',
  ],
  win: [
    'Get absolutely fucked.',
    'Somehow that actually worked.',
    'Winner winner — loser drinks.',
  ],
  ambient: [
    'Nobody wants yellow apparently.',
    'This game has been going on forever.',
    '{name}\'s hand is looking suspicious.',
    '{name}\'s one good turn away from becoming unbearable.',
    'The tension in this room is filthy.',
    'Somebody\'s about to get wrecked.',
  ],
};

function tierForDraw(n) {
  if (n >= 15) return 'freight';
  if (n >= 10) return 'heavy';
  if (n >= 6) return 'medium';
  return 'small';
}

function seatStats(session, seat) {
  if (!session.perSeat[seat]) {
    session.perSeat[seat] = {
      totalDrawn: 0,
      lastDraw: 0,
      cardsPlayed: 0,
      skipsReceived: 0,
      skipStreak: 0,
      largestDraw: 0,
      drawEvents: 0,
    };
  }
  return session.perSeat[seat];
}

export function createUnoBartender(rootEl, { nameOf, onSpeak } = {}) {
  const session = { perSeat: [{}, {}], largestStack: 0, turns: 0, startedAt: Date.now() };
  let bubbleTimer = null;
  let ambientTimer = null;
  let lastTurn = -1;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'uno-bartender-bubble hidden';
  bubbleEl.innerHTML = `
    <header class="uno-bartender-bubble__head">
      <span class="uno-bartender-bubble__icon" aria-hidden="true">🍸</span>
      <span class="uno-bartender-bubble__label">Bartender</span>
    </header>
    <p class="uno-bartender-bubble__text"></p>`;
  rootEl?.appendChild(bubbleEl);
  const textEl = bubbleEl.querySelector('.uno-bartender-bubble__text');

  const turnBanner = document.createElement('div');
  turnBanner.className = 'uno-turn-banner hidden';
  turnBanner.setAttribute('aria-live', 'polite');
  rootEl?.appendChild(turnBanner);

  const mercyEl = document.createElement('div');
  mercyEl.className = 'uno-mercy-alert hidden';
  mercyEl.innerHTML = `
    <div class="uno-mercy-alert__inner">
      <p class="uno-mercy-alert__tag">🚨 MERCY WARNING 🚨</p>
      <p class="uno-mercy-alert__name"></p>
      <p class="uno-mercy-alert__count"></p>
    </div>`;
  rootEl?.appendChild(mercyEl);

  function showBubble(text, ms = 3600) {
    if (!text || !bubbleEl) return;
    clearTimeout(bubbleTimer);
    const lines = String(text).split(/\n/).filter(Boolean);
    textEl.innerHTML = lines.map((ln) => esc(ln)).join('<br>');
    bubbleEl.classList.remove('hidden');
    bubbleEl.classList.remove('show');
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('show');
    onSpeak?.(text);
    bubbleTimer = setTimeout(() => {
      bubbleEl.classList.remove('show');
      setTimeout(() => bubbleEl.classList.add('hidden'), 320);
    }, ms);
  }

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function lineForDraw(seat, count) {
    const st = seatStats(session, seat);
    st.totalDrawn += count;
    st.lastDraw = count;
    st.largestDraw = Math.max(st.largestDraw, count);
    st.drawEvents += 1;

    if (count >= 8 && st.drawEvents >= 2 && st.lastDraw >= 8) {
      return pick(['Again? At this point the deck lives in your hand.', ...DRAW_LINES.freight]);
    }
    return pick(DRAW_LINES[tierForDraw(count)]);
  }

  function reactDraw(seat, count) {
    showBubble(lineForDraw(seat, count), count >= 10 ? 4200 : 3400);
  }

  function reactEvent(kind, ctx = {}) {
    const name = ctx.name || nameOf?.(ctx.seat) || 'Player';
    let bank = EVENT_LINES[kind] || EVENT_LINES.ambient;
    if (kind === 'skipStreak') {
      bank = EVENT_LINES.skipStreak.map((l) => l.replaceAll('{name}', name));
    } else if (kind === 'ambient') {
      bank = EVENT_LINES.ambient.map((l) => l.replaceAll('{name}', name));
    }
    showBubble(pick(bank), 3400);
  }

  function recordSkip(victim) {
    const st = seatStats(session, victim);
    st.skipsReceived += 1;
    st.skipStreak += 1;
    if (st.skipStreak >= 3) {
      reactEvent('skipStreak', { seat: victim, name: nameOf?.(victim) });
      return true;
    }
    reactEvent('skip', { seat: victim });
    return false;
  }

  function recordPlay(seat) {
    seatStats(session, seat).cardsPlayed += 1;
    session.perSeat.forEach((_, i) => {
      if (i !== seat) seatStats(session, i).skipStreak = 0;
    });
  }

  function recordStack(count) {
    session.largestStack = Math.max(session.largestStack, count);
    reactEvent('stack');
  }

  function checkClutch(seat, handSize) {
    if (handSize === 1) reactEvent('uno', { seat });
    else if (handSize === 2) reactEvent('clutch', { seat });
  }

  function showMercyWarning(seat, count) {
    const name = (nameOf?.(seat) || 'PLAYER').toUpperCase();
    mercyEl.querySelector('.uno-mercy-alert__name').textContent = name;
    mercyEl.querySelector('.uno-mercy-alert__count').textContent = `HAS ${count} CARDS`;
    mercyEl.classList.remove('hidden');
    void mercyEl.offsetWidth;
    mercyEl.classList.add('show');
    reactEvent('mercyWarn', { seat });
    setTimeout(() => {
      mercyEl.classList.remove('show');
      setTimeout(() => mercyEl.classList.add('hidden'), 400);
    }, 2400);
  }

  function announceTurn(seat, color = 'wild') {
    if (seat === lastTurn) return;
    lastTurn = seat;
    session.turns += 1;
    const name = (nameOf?.(seat) || 'Player').toUpperCase();
    turnBanner.textContent = `${name}'S TURN`;
    turnBanner.dataset.color = color;
    turnBanner.classList.remove('hidden', 'show');
    void turnBanner.offsetWidth;
    turnBanner.classList.add('show');
    setTimeout(() => {
      turnBanner.classList.remove('show');
      setTimeout(() => turnBanner.classList.add('hidden'), 280);
    }, 1400);
  }

  function startAmbient(getState) {
    stopAmbient();
    const tick = () => {
      const delay = 20000 + Math.random() * 10000;
      ambientTimer = setTimeout(() => {
        if (!getState?.()?.over) {
          const st = getState?.();
          const seat = st?.turn ?? 0;
          reactEvent('ambient', { seat, name: nameOf?.(seat) });
        }
        tick();
      }, delay);
    };
    tick();
  }

  function stopAmbient() {
    clearTimeout(ambientTimer);
    ambientTimer = null;
  }

  function getVictoryCopy(winnerSeat) {
    const st = seatStats(session, winnerSeat);
    const loserSeat = 1 - winnerSeat;
    const lst = seatStats(session, loserSeat);
    return {
      cardsPlayed: st.cardsPlayed,
      biggestCombo: session.largestStack,
      timesDrawn: lst.totalDrawn,
      bartenderLine: pick(EVENT_LINES.win),
    };
  }

  function destroy() {
    stopAmbient();
    clearTimeout(bubbleTimer);
    bubbleEl?.remove();
    turnBanner?.remove();
    mercyEl?.remove();
  }

  return {
    showBubble,
    reactDraw,
    reactEvent,
    recordSkip,
    recordPlay,
    recordStack,
    checkClutch,
    showMercyWarning,
    announceTurn,
    startAmbient,
    stopAmbient,
    getVictoryCopy,
    destroy,
    session,
  };
}
