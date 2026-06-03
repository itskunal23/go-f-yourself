/**
 * GFY table opening — five-phase physical deal (logo → deck → shuffle → deal → fan).
 * Cards are objects first; state renders after the ceremony.
 */
import gsap from '/vendor/gsap/index.js';
import { renderCardBack } from './cards.js?v=78';
import { GameAudio } from './game-audio.js?v=65';

const noop = () => {};
import { prefersReducedMotion } from './motion.js?v=1';

const PHASE_MS = {
  logo: 1400,
  deck: 700,
  shuffle: 2600,
  dealPerCard: 140,
  fan: 900,
};

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait until deal targets exist in the game screen (post-renderGame). */
async function waitForGameTableDom(maxFrames = 48) {
  for (let i = 0; i < maxFrames; i++) {
    if (document.getElementById('hand-wrap') && document.getElementById('deck-pile-wrap')) return;
    await new Promise((r) => requestAnimationFrame(r));
  }
}

function setOpeningCaption(overlay, text) {
  const cap = overlay.querySelector('#table-opening-caption');
  if (cap) cap.textContent = text || '';
}

function ensureOverlay() {
  let el = document.getElementById('table-opening');
  if (!el) {
    el = document.createElement('div');
    el.id = 'table-opening';
    el.className = 'table-opening hidden';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="table-opening__rain" aria-hidden="true"></div>
      <div class="table-opening__logo" aria-hidden="true">
        <span class="table-opening__logo-line">GO</span>
        <span class="table-opening__logo-line table-opening__logo-line--accent">FUCK</span>
        <span class="table-opening__logo-line">YOURSELF</span>
      </div>
      <div class="table-opening__deck-zone" aria-hidden="true">
        <div class="table-opening__deck-pile" id="table-opening-deck"></div>
      </div>
      <div class="table-opening__shuffle-field" id="table-opening-shuffle" aria-hidden="true"></div>
      <p class="table-opening__caption" id="table-opening-caption" aria-live="polite"></p>
      <p class="table-opening__deal-label" id="table-opening-deal-label" aria-live="polite"></p>`;
    document.getElementById('screen-game')?.appendChild(el);
  }
  return el;
}

function buildRain(container, count = 18) {
  container.replaceChildren();
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'table-opening__rain-card';
    card.innerHTML = renderCardBack({ mini: true });
    card.style.setProperty('--rain-i', String(i));
    card.style.setProperty('--rain-x', `${(i / count) * 100}%`);
    card.style.setProperty('--rain-delay', `${(i % 7) * 0.12}s`);
    card.style.setProperty('--rain-dur', `${2.2 + (i % 5) * 0.28}s`);
    container.appendChild(card);
  }
}

function buildShuffleCards(field, count = 52) {
  field.replaceChildren();
  const cards = [];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'table-opening__shuffle-card';
    c.innerHTML = renderCardBack({ mini: true });
    c.dataset.i = String(i);
    field.appendChild(c);
    cards.push(c);
  }
  return cards;
}

async function phaseLogo(overlay) {
  const rain = overlay.querySelector('.table-opening__rain');
  const logo = overlay.querySelector('.table-opening__logo');
  setOpeningCaption(overlay, 'Official rules — shuffle, deal, fish for shame');
  buildRain(rain, 20);
  overlay.classList.add('table-opening--logo');
  if (prefersReducedMotion()) {
    logo?.classList.add('visible');
    await wait(400);
    return;
  }
  gsap.fromTo(logo, { scale: 0.82, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' });
  await wait(PHASE_MS.logo);
}

async function phaseDeckAppear(overlay) {
  const deckZone = overlay.querySelector('.table-opening__deck-zone');
  const deckPile = overlay.querySelector('#table-opening-deck');
  setOpeningCaption(overlay, 'Stack the deck');
  overlay.classList.remove('table-opening--logo');
  overlay.classList.add('table-opening--deck');
  if (deckPile) {
    deckPile.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const layer = document.createElement('div');
      layer.className = 'table-opening__deck-layer';
      layer.style.setProperty('--layer-i', String(i));
      layer.innerHTML = renderCardBack({ deck: true });
      deckPile.appendChild(layer);
    }
  }
  if (prefersReducedMotion()) {
    deckZone?.classList.add('visible');
    await wait(300);
    return;
  }
  gsap.fromTo(deckZone, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.5)' });
  await wait(PHASE_MS.deck);
}

async function phaseShuffle(overlay) {
  const field = overlay.querySelector('#table-opening-shuffle');
  const deckZone = overlay.querySelector('.table-opening__deck-zone');
  setOpeningCaption(overlay, 'Shuffle…');
  overlay.classList.add('table-opening--shuffle');
  deckZone?.classList.add('fading');

  const cards = buildShuffleCards(field, 54);
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight * 0.42;

  if (prefersReducedMotion()) {
    await wait(400);
    field.replaceChildren();
    return;
  }

  const spread = Math.min(window.innerWidth * 0.38, 160);
  cards.forEach((c, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    gsap.set(c, {
      x: midX + side * spread * (0.3 + (row % 6) * 0.12),
      y: midY + (row % 8) * 4 - 40,
      rotate: side * (8 + (i % 5)),
      opacity: 0.92,
    });
  });

  const riffle = gsap.timeline();
  for (let pass = 0; pass < 4; pass++) {
    riffle.to(cards, {
      x: (i, el) => {
        const side = pass % 2 === 0 ? (i % 2 === 0 ? -1 : 1) : (i % 2 === 0 ? 1 : -1);
        return midX + side * spread * (0.15 + (i % 7) * 0.08);
      },
      y: (i) => midY + Math.sin(i * 0.4 + pass) * 12,
      rotate: (i) => (i % 2 === 0 ? -1 : 1) * (12 + pass * 3),
      duration: 0.32,
      ease: 'power2.inOut',
      stagger: { each: 0.008, from: 'random' },
      onStart: noop,
    });
  }
  riffle.to(cards, {
    x: midX,
    y: midY,
    rotate: 0,
    scale: 0.35,
    opacity: 0,
    duration: 0.35,
    ease: 'power2.in',
    stagger: 0.004,
  });

  await riffle;
  field.replaceChildren();
  deckZone?.classList.remove('fading');
  overlay.classList.remove('table-opening--shuffle');
}

async function phaseDeal(overlay, { players = [], cardsPerPlayer = 5 } = {}) {
  setOpeningCaption(overlay, `Deal ${cardsPerPlayer} cards each`);
  const label = overlay.querySelector('#table-opening-deal-label');
  const deckRect = overlay.querySelector('.table-opening__deck-zone')?.getBoundingClientRect()
    || { left: window.innerWidth / 2 - 34, top: window.innerHeight * 0.38, width: 68, height: 95 };

  const targets = players.map((p) => {
    if (p.isMe) {
      const hand = document.getElementById('hand-wrap');
      const r = hand?.getBoundingClientRect();
      return {
        name: p.name,
        x: r ? r.left + r.width / 2 : window.innerWidth / 2,
        y: r ? r.top + 40 : window.innerHeight * 0.78,
      };
    }
    const av = document.getElementById('opponent-avatar-stage');
    const r = av?.getBoundingClientRect();
    return {
      name: p.name,
      x: r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: r ? r.bottom + 8 : window.innerHeight * 0.22,
    };
  });

  overlay.classList.add('table-opening--deal');
  const total = cardsPerPlayer * Math.max(1, targets.length);
  let dealt = 0;

  for (let round = 0; round < cardsPerPlayer; round++) {
    for (const t of targets) {
      const ghost = document.createElement('div');
      ghost.className = 'table-opening__deal-card';
      ghost.innerHTML = renderCardBack({ mini: true });
      document.body.appendChild(ghost);
      gsap.set(ghost, {
        x: deckRect.left + deckRect.width / 2 - 30,
        y: deckRect.top,
        opacity: 1,
      });
      if (label) label.textContent = `${t.name.split(' ')[0]}`;
      await gsap.to(ghost, {
        x: t.x - 30,
        y: t.y,
        rotate: (Math.random() > 0.5 ? 1 : -1) * 8,
        duration: 0.22,
        ease: 'power2.out',
      });
      ghost.remove();
      dealt += 1;
      if (dealt < total) await wait(PHASE_MS.dealPerCard * 0.35);
    }
  }
  if (label) label.textContent = '';
  overlay.classList.remove('table-opening--deal');
}

async function phasePond(overlay) {
  const pond = document.getElementById('deck-pile-wrap');
  const stack = document.getElementById('deck-stack');
  if (!pond || !stack) return;

  setOpeningCaption(overlay, 'The rest stays in the pond — draw from here');
  pond.classList.add('deck-pile-wrap--pond-reveal');

  const from = overlay.querySelector('.table-opening__deck-zone')?.getBoundingClientRect();
  const to = pond.getBoundingClientRect();
  if (!from || prefersReducedMotion()) {
    await wait(600);
    return;
  }

  const ghost = document.createElement('div');
  ghost.className = 'table-opening__pond-ghost';
  ghost.innerHTML = renderCardBack({ deck: true });
  document.body.appendChild(ghost);
  gsap.set(ghost, {
    left: from.left + from.width / 2 - 34,
    top: from.top,
    width: 68,
    height: 95,
  });
  GameAudio.cardToDeck?.();
  await gsap.to(ghost, {
    left: to.left + to.width / 2 - 34,
    top: to.top,
    rotate: -8,
    scale: 0.85,
    duration: 0.55,
    ease: 'power2.inOut',
  });
  ghost.remove();
  gsap.fromTo(stack, { scale: 0.6, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.4)' });
  await wait(700);
}

async function phaseHandFan() {
  const hand = document.getElementById('hand');
  const wrap = document.getElementById('hand-wrap');
  if (!hand || !wrap) return;

  wrap.classList.remove('hand-wrap--concealed');
  hand.classList.add('hand--fanning');

  const stacks = [...hand.querySelectorAll('.card-stack')];
  if (!stacks.length) {
    hand.classList.remove('hand--fanning');
    return;
  }

  if (prefersReducedMotion()) {
    hand.classList.remove('hand--fanning');
    return;
  }

  gsap.set(stacks, { rotateY: 88, opacity: 0, y: 28, transformOrigin: 'center bottom' });
  await gsap.to(stacks, {
    rotateY: 0,
    opacity: 1,
    y: 0,
    duration: 0.55,
    ease: 'back.out(1.35)',
    stagger: 0.045,
  });
  hand.classList.remove('hand--fanning');
}

let openingBusy = false;

/** Run full opening ceremony when a fresh game starts. */
export async function runTableOpening({
  players = [],
  cardsPerPlayer = 5,
  playerBand = '2–4 players',
} = {}) {
  if (openingBusy) return;
  openingBusy = true;

  const screen = document.getElementById('screen-game');
  const handWrap = document.getElementById('hand-wrap');
  handWrap?.classList.add('hand-wrap--concealed');

  const overlay = ensureOverlay();
  overlay.classList.remove('hidden', 'table-opening--done');
  overlay.setAttribute('aria-hidden', 'false');
  screen?.classList.add('table-opening-active');

  try {
    if (prefersReducedMotion()) {
      setOpeningCaption(overlay, `Shuffled · ${cardsPerPlayer} cards each (${playerBand})`);
      await wait(500);
    } else {
      await phaseLogo(overlay);
      await phaseShuffle(overlay);
      await phaseDeckAppear(overlay);
      await waitForGameTableDom();
      setOpeningCaption(overlay, `Deal ${cardsPerPlayer} each (${playerBand})`);
      await phaseDeal(overlay, { players, cardsPerPlayer });
      await phasePond(overlay);
      setOpeningCaption(overlay, 'Play clockwise — fish for shameful secrets');
      await wait(500);
      await phaseHandFan();
    }
  } finally {
    overlay.classList.add('table-opening--done', 'hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('table-opening--logo', 'table-opening--deck', 'table-opening--shuffle', 'table-opening--deal');
    screen?.classList.remove('table-opening-active');
    handWrap?.classList.remove('hand-wrap--concealed');
    openingBusy = false;
    window.dispatchEvent(new CustomEvent('gfy-opening-done', {
      detail: { cardsPerPlayer, playerBand },
    }));
  }
}

export function isTableOpeningBusy() {
  return openingBusy;
}
