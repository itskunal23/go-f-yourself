// Premium party-game motion — iOS-style springs, card theatre, impact moments.
import gsap from '/vendor/gsap/index.js';
import { renderCardBack, buildActiveCardElement, CardAudio } from './cards.js?v=75';
import { GameAudio, speakAnnouncer } from './game-audio.js?v=63';
import { haptic } from './mobile.js';
import {
  createTransformGhost,
  ghostTargetRect,
  timelineCardTravel,
  pulseCardLand,
  prefersReducedMotion,
  motionEase,
  motionScale,
  EASE_SETTLE,
  EASE_FLIP,
  DUR,
} from './motion.js?v=1';

const SPRING = EASE_SETTLE;
const SPRING_SNAP = EASE_SETTLE;

function fxLayer() {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.className = 'fx-layer';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

export function spawnParticles(x, y, { count = 12, color = '#ffd60a', spread = 48 } = {}) {
  const layer = fxLayer();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-particle';
    p.style.background = color;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    layer.appendChild(p);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = spread * (0.4 + Math.random() * 0.6);
    gsap.to(p, {
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist - 20,
      opacity: 0,
      scale: 0,
      duration: 0.55 + Math.random() * 0.25,
      ease: 'power2.out',
      onComplete: () => p.remove(),
    });
  }
  // Add haptic feedback for particle effects (significant events)
  if (count > 8) haptic('medium');
}

export function screenShake(el = '#screen-game .game-table', intensity = 6) {
  if (prefersReducedMotion()) return;
  const target = typeof el === 'string' ? document.querySelector(el) : el;
  if (!target) return;
  gsap.fromTo(target, { x: 0 }, {
    x: `+=${intensity}`,
    duration: 0.04,
    repeat: 5,
    yoyo: true,
    ease: 'none',
    onComplete: () => gsap.set(target, { x: 0 }),
  });
}

/** Y-axis flip reveal — back → face (500–700ms) */
export function buildFlipRevealShell(rank) {
  const scene = document.createElement('div');
  scene.className = 'card-flip-scene';
  scene.innerHTML = `
    <div class="card-flip-inner">
      <div class="card-flip-face card-flip-back"></div>
      <div class="card-flip-face card-flip-front"></div>
    </div>`;
  scene.querySelector('.card-flip-back').appendChild(
    (() => { const w = document.createElement('div'); w.innerHTML = renderCardBack({ large: true }); return w.firstElementChild; })()
  );
  scene.querySelector('.card-flip-front').appendChild(buildActiveCardElement(rank));
  return scene;
}

export function animateFlipReveal(mountEl, rank) {
  if (!mountEl || !rank) return Promise.resolve();
  mountEl.classList.remove('empty', 'landing');
  mountEl.dataset.rank = rank;
  mountEl.innerHTML = '';
  const scene = buildFlipRevealShell(rank);
  mountEl.appendChild(scene);
  const inner = scene.querySelector('.card-flip-inner');
  CardAudio.cardFwip?.() || CardAudio.flip();
  haptic('selection');
  const dur = motionScale(DUR.flip);
  if (prefersReducedMotion()) {
    inner.style.transform = 'rotateY(180deg)';
    haptic('light');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: () => { haptic('light'); resolve(); } });
    gsap.set(inner, { rotateY: 0, scale: 1, force3D: true });
    tl.to(inner, { rotateY: 90, scale: 0.97, duration: dur * 0.42, ease: 'power2.in' }, 0);
    tl.add(() => haptic('selection'), dur * 0.42);
    tl.to(inner, { rotateY: 180, scale: 1, duration: dur * 0.58, ease: motionEase(EASE_FLIP) }, dur * 0.42);
  });
}

/** Deck compress → lift → snap travel → settle */
export function animateDrawFlick(deckEl, destEl, { rank = null } = {}) {
  if (!deckEl || !destEl) return Promise.resolve();
  const deckStack = deckEl.querySelector('.deck-stack') || deckEl;
  const from = deckStack.getBoundingClientRect();
  const cardW = 68;
  const cardH = 95;

  const ghost = document.createElement('div');
  ghost.className = 'gfy-card-ghost draw-ghost motion-blur';
  ghost.innerHTML = renderCardBack();
  ghost.style.cssText = `position:fixed;left:0;top:0;width:${cardW}px;height:${cardH}px;pointer-events:none`;
  document.body.appendChild(ghost);
  gsap.set(ghost, {
    x: from.left + from.width / 2 - cardW / 2,
    y: from.top,
    force3D: true,
  });

  deckEl.classList.add('deck-drawing');
  deckStack.classList.add('deck-compressed');

  const target = ghostTargetRect({ width: cardW, height: cardH }, destEl);
  const tl = gsap.timeline();
  const t0 = 0;
  const tLift = motionScale(0.09);
  const tTravel = motionScale(0.17);
  const tSettle = motionScale(0.13);

  tl.to(deckStack, { y: 3, scale: 0.96, duration: tLift, ease: 'power2.in' }, t0);
  tl.to(ghost, { y: `-=${12}`, rotate: -4, duration: tLift, ease: 'power2.out' }, t0);
  tl.to(ghost, {
    x: target.x,
    y: target.y,
    scale: target.scale,
    rotate: 6,
    duration: tTravel,
    ease: 'power4.in',
    onStart: () => ghost.classList.add('motion-blur-active'),
  }, t0 + tLift);
  tl.to(ghost, {
    rotate: 0,
    scale: target.scale * 1.02,
    duration: tSettle,
    ease: SPRING_SNAP,
    onStart: () => haptic('light'),
  }, t0 + tLift + tTravel);
  tl.to(ghost, { opacity: 0, duration: 0.07 }, t0 + tLift + tTravel + tSettle - 0.02);
  tl.to(deckStack, { y: 0, scale: 1, duration: tSettle, ease: SPRING }, t0 + tLift + tTravel);

  return new Promise((resolve) => {
    tl.eventCallback('onComplete', async () => {
      ghost.remove();
      deckEl.classList.remove('deck-drawing');
      deckStack.classList.remove('deck-compressed');
      CardAudio.cardTok?.() || CardAudio.slam();
      pulseCardLand(destEl);
      if (rank) await animateFlipReveal(destEl, rank);
      resolve();
    });
  });
}

/** Fast snap from hand/opponent to center with spring settle */
export function animateCardSnap(fromEl, destEl) {
  if (!fromEl || !destEl) return Promise.resolve();
  const { ghost, from } = createTransformGhost(fromEl, { className: 'gfy-card-ghost motion-blur' });
  CardAudio.cardFwip?.() || CardAudio.flip();

  return new Promise((resolve) => {
    const tl = timelineCardTravel(ghost, from, destEl, {
      onLand: () => {
        pulseCardLand(destEl);
        haptic('light');
      },
    });
    tl.eventCallback('onComplete', () => { ghost.remove(); resolve(); });
  });
}

/** Full play: travel → flip reveal */
export async function animateCardPlay(fromEl, destEl, rank, { isDraw = false, deckEl = null } = {}) {
  if (isDraw && deckEl) {
    await animateDrawFlick(deckEl, destEl, { rank });
    return;
  }
  if (fromEl) await animateCardSnap(fromEl, destEl);
  await animateFlipReveal(destEl, rank);
}

/** Set completion — four cards merge → shelf tile → bartender roasts (server pop-in) */
export function animateComboComplete({ rank, line, groupEl } = {}) {
  const group = groupEl || document.querySelector(`.hand-topic-group[data-rank="${rank}"], .card-stack[data-rank="${rank}"]`);
  const setsRow = document.getElementById('books-row');
  const meta = line || rank || '';

  const tl = gsap.timeline();

  if (group) {
    group.classList.add('combo-glow');
    const layers = group.querySelectorAll('.card-stack__layer');
    const face = group.querySelector('.card-stack__face');
    const mergeHost = document.createElement('div');
    mergeHost.className = 'set-merge-stage';
    const rect = group.getBoundingClientRect();
    mergeHost.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    document.body.appendChild(mergeHost);

    const pieces = [];
    for (let i = 0; i < 4; i++) {
      const chip = document.createElement('div');
      chip.className = 'set-merge-card';
      chip.textContent = String(i + 1);
      chip.style.setProperty('--merge-i', String(i));
      if (face) chip.appendChild(face.cloneNode(true));
      mergeHost.appendChild(chip);
      pieces.push(chip);
    }

    tl.fromTo(pieces, { scale: 0.6, opacity: 0, y: 20 }, {
      scale: 1,
      opacity: 1,
      y: 0,
      duration: 0.22,
      stagger: 0.08,
      ease: SPRING_SNAP,
    });
    tl.to(pieces, {
      x: 0,
      y: 0,
      scale: 0.85,
      duration: 0.35,
      ease: 'power2.inOut',
      stagger: 0.04,
    });
    tl.to(pieces, { scale: 0, opacity: 0, duration: 0.2, ease: 'power2.in' });
    tl.add(() => {
      mergeHost.remove();
      group.style.visibility = 'hidden';
    });

    if (layers.length) {
      tl.to(layers, { opacity: 0, duration: 0.15 }, 0);
    }
  }

  tl.add(() => {
    if (!prefersReducedMotion()) {
      document.getElementById('screen-game')?.classList.add('combo-pulse');
    }
    GameAudio.setDing?.();
    haptic('success');
  });

  const badge = document.createElement('div');
  badge.className = 'set-complete-badge';
  badge.innerHTML = '<span class="set-complete-badge__emoji">🍹</span><span class="set-complete-badge__title"></span>';
  badge.querySelector('.set-complete-badge__title').textContent = String(meta).replace(/\s+/g, ' ').trim();
  document.body.appendChild(badge);

  tl.fromTo(badge, { scale: 0.5, opacity: 0, y: 24 }, { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: SPRING_SNAP });
  tl.add(() => {
    const r = badge.getBoundingClientRect();
    spawnParticles(r.left + r.width / 2, r.top + r.height / 2, { count: 18, color: '#ff6b2c' });
    screenShake('#screen-game .game-table', 5);
  });

  if (setsRow) {
    tl.to(badge, {
      x: () => {
        const sr = setsRow.getBoundingClientRect();
        const br = badge.getBoundingClientRect();
        return sr.left + sr.width / 2 - br.left - br.width / 2;
      },
      y: () => {
        const sr = setsRow.getBoundingClientRect();
        const br = badge.getBoundingClientRect();
        return sr.top - br.top;
      },
      scale: 0.35,
      opacity: 0,
      duration: 0.45,
      ease: 'power3.in',
      delay: 0.65,
    });
  } else {
    tl.to(badge, { opacity: 0, y: -16, duration: 0.3, delay: 1.2 });
  }

  tl.add(() => {
    badge.remove();
    group?.remove();
    document.getElementById('screen-game')?.classList.remove('combo-pulse');
  });

  return tl;
}

/** Bartender pops in — one line, sports commentator, not a chat log */
export function animateBartenderRoast(text, { busy = false, mode = 'roast' } = {}) {
  const whisper = document.getElementById('host-whisper');
  const hostText = document.getElementById('host-text');
  const teaser = document.getElementById('host-teaser');
  const loading = document.getElementById('host-loading');
  if (!whisper) return;

  whisper.dataset.bartenderMode = mode;
  whisper.classList.remove('hidden', 'bartender-exit');

  if (busy) {
    whisper.classList.add('bartender-busy', 'bartender-enter');
    if (teaser) teaser.textContent = '…';
    loading?.classList.remove('hidden');
    gsap.fromTo(whisper, { y: -16, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.32, ease: SPRING });
    return;
  }

  loading?.classList.add('hidden');
  whisper.classList.remove('bartender-busy');
  whisper.classList.add('bartender-enter', 'host-whisper--collapsed');

  const toggle = document.getElementById('btn-bartender-toggle');
  toggle?.setAttribute('aria-expanded', 'false');

  const line = String(text || '').trim();
  const short = line.length > 96 ? `${line.slice(0, 94)}…` : line;
  if (teaser) teaser.textContent = short ? `"${short}"` : '';
  if (hostText) {
    hostText.textContent = line;
    hostText.className = 'host-text';
  }

  gsap.fromTo(whisper, { y: -20, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.36, ease: SPRING });
  gsap.fromTo(whisper.querySelector('.bartender-avatar'), { rotate: -12, scale: 0.7 }, { rotate: 0, scale: 1, duration: 0.4, ease: SPRING });

  GameAudio.bartenderSting?.(mode);
  haptic(mode === 'hype' ? 'success' : mode === 'drunk' ? 'medium' : 'light');
}

export function dismissBartenderPop(delayMs = 9000) {
  const whisper = document.getElementById('host-whisper');
  if (!whisper || whisper.classList.contains('hidden')) return;
  if (whisper.classList.contains('host-whisper--expanded')) return;

  clearTimeout(dismissBartenderPop._t);
  dismissBartenderPop._t = setTimeout(() => {
    if (!whisper || whisper.classList.contains('host-whisper--expanded')) return;
    whisper.classList.add('bartender-exit');
    gsap.to(whisper, {
      y: -12,
      opacity: 0,
      scale: 0.96,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => {
        whisper.classList.add('hidden');
        whisper.classList.remove('bartender-exit', 'bartender-enter');
      },
    });
  }, delayMs);
}

export function hideBartenderRoast() {
  document.getElementById('host-whisper')?.classList.add('hidden');
}

/** Liquid fill + floating +N DRINK */
export function animateDrinkPenalty(meterEl, fromLevel, toLevel) {
  if (!meterEl) return;
  const fill = meterEl.querySelector('.status-fill, .drunk-fill');
  const track = meterEl.querySelector('.status-track, .drunk-track');
  if (!fill) return;

  GameAudio.punishmentDrink(`+${Math.max(1, toLevel - fromLevel)} DRINKS`);
  screenShake('#screen-game .game-table', 4);

  fill.classList.add('drunk-fill--animating');
  gsap.fromTo(fill, { width: `${fromLevel * 10}%` }, {
    width: `${toLevel * 10}%`,
    duration: 0.55,
    ease: 'power2.out',
    onComplete: () => fill.classList.remove('drunk-fill--animating'),
  });

  if (track) {
    const floater = document.createElement('span');
    floater.className = 'drink-float-num';
    floater.textContent = '+1 DRINK';
    track.appendChild(floater);
    const r = track.getBoundingClientRect();
    gsap.fromTo(floater, { y: 0, opacity: 1, scale: 0.8 }, {
      y: -36,
      opacity: 0,
      scale: 1.1,
      duration: 0.85,
      ease: 'power2.out',
      onComplete: () => floater.remove(),
    });
    spawnParticles(r.left + r.width / 2, r.bottom - 8, { count: 6, color: '#64d2ff', spread: 24 });
  }
}

/** Opponent turn theatre */
export function setOpponentTurnMode(active, name = '') {
  const screen = document.getElementById('screen-game');
  const zone = document.getElementById('opponent-zone');
  const hand = document.getElementById('hand-wrap');
  if (!screen) return;

  screen.classList.toggle('opponent-turn-dim', active);
  zone?.classList.toggle('opponent-highlight', active);
  hand?.classList.toggle('player-dimmed', active);

  let banner = document.getElementById('opponent-turn-banner');
  if (active) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'opponent-turn-banner';
      banner.className = 'opponent-turn-banner';
      document.querySelector('.table-center')?.appendChild(banner);
    }
    banner.textContent = `${name.toUpperCase()} THINKING…`;
    banner.classList.add('show');
    gsap.fromTo(banner, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3, ease: SPRING });
  } else {
    banner?.classList.remove('show');
  }
}

export async function animateOpponentPlay(opponentName, destEl, rank) {
  setOpponentTurnMode(true, opponentName);
  const avHand = document.getElementById('opponent-avatar-hand');
  const handVis = document.getElementById('opponent-hand-visual');
  const handRoot = avHand || handVis;
  handRoot?.classList.add('opponent-avatar-hand--dealing');
  const fakeCard = handRoot?.querySelector('.opp-mini-slot:last-child') || handRoot;
  await animateCardSnap(fakeCard, destEl);
  handRoot?.classList.remove('opponent-avatar-hand--dealing');
  await animateFlipReveal(destEl, rank);
  setOpponentTurnMode(false);
}

/** Endgame cinematic before win sheet */
export function animateEndgameCinematic(view) {
  return new Promise((resolve) => {
    const winner = view.players.find((p) => p.id === view.winnerId);
    const loser = view.players.find((p) => p.id !== view.winnerId);
    const iWon = view.winnerId === view.you;

    const overlay = document.createElement('div');
    overlay.className = 'endgame-cinematic';
    overlay.innerHTML = `
      <div class="endgame-vignette"></div>
      <div class="endgame-card-slam">
        <span class="endgame-trophy">🏆</span>
        <h2 class="endgame-winner">${winner?.name?.split(' ')[0] || 'WINNER'} WINS</h2>
      </div>
      <div class="endgame-loser">
        <span>💀</span>
        <p>${loser?.name?.split(' ')[0] || 'LOSER'} IS COOKED</p>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('screen-game')?.classList.add('endgame-freeze', 'endgame-slowmo');
    GameAudio.heartbeatStart();

    gsap.set(overlay.querySelector('.endgame-card-slam'), { scale: 1.6, opacity: 0 });
    gsap.set(overlay.querySelector('.endgame-loser'), { rotate: -8, opacity: 0, x: 30 });

    const tl = gsap.timeline({ onComplete: () => {
      GameAudio.heartbeatStop();
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
        document.getElementById('screen-game')?.classList.remove('endgame-freeze', 'endgame-slowmo');
        resolve();
      }, 400);
    } });

    tl.to(overlay, { opacity: 1, duration: 0.3 }, 0);
    tl.to(overlay.querySelector('.endgame-card-slam'), { scale: 1, opacity: 1, duration: 0.45, ease: SPRING_SNAP }, 0.2);
    tl.add(() => {
      GameAudio.endgameFanfare();
      speakAnnouncer('Somebody call an Uber.');
      screenShake(document.body, 8);
      haptic('heavy');
      spawnParticles(window.innerWidth / 2, window.innerHeight * 0.38, { count: 20, color: iWon ? '#ffd60a' : '#ff453a' });
    }, 0.45);
    tl.to(overlay.querySelector('.endgame-loser'), { rotate: -6, opacity: 1, x: 0, duration: 0.4, ease: SPRING }, 0.55);
    tl.to({}, { duration: 1.4 });
  });
}
