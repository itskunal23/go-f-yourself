// Bluff theatre — slower, darker, poker-tension motion (contrasts with card collection).
import gsap from '/vendor/gsap/index.js';
import { createTransformGhost } from './motion.js';
import { springGhostToRect } from './physics/card-motion.js';
import { buildActiveCardElement, renderCardBack } from './cards.js?v=75';
import { GameAudio, speakAnnouncer } from './game-audio.js?v=63';
import { haptic } from './mobile.js';
import { screenShake, spawnParticles, animateDrawFlick, animateFlipReveal } from './animations.js?v=64';

const SPRING = 'back.out(1.4)';

function fxLayer() {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.className = 'fx-layer';
    document.body.appendChild(el);
  }
  return el;
}

function opponentBar() {
  return document.querySelector('#opponent-bar');
}

function handMount() {
  return document.querySelector('#hand-groups');
}

/** Scenario 1 — they have it: portrait flinch → glowing card → golden trail → THWACK */
export async function animateCardGive({ rank, targetName, cardCount = 1, destEl = null } = {}) {
  const mount = destEl || document.getElementById('active-card');
  const oppHand = document.querySelector('#opponent-avatar-hand') || document.querySelector('#opponent-hand-visual');
  const avStage = document.getElementById('opponent-avatar-stage');
  const fromSlot = oppHand?.querySelector('.opp-mini-slot:last-child');

  const fromGroup = document.querySelector(`.hand-topic-group[data-rank="${rank}"] .hand-stack-face, .hand-topic-group[data-rank="${rank}"] .gfy-card-slot:last-child`);

  if (oppHand) {
    oppHand.classList.add('opp-hand-glow', 'opponent-avatar-hand--dealing');
    gsap.fromTo(oppHand, { boxShadow: '0 0 0 rgba(255,214,10,0)' }, {
      boxShadow: '0 0 28px rgba(255,214,10,0.55)',
      duration: 0.25,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
      onComplete: () => {
        oppHand.classList.remove('opp-hand-glow', 'opponent-avatar-hand--dealing');
      },
    });
  }

  if (avStage) {
    avStage.classList.add('opponent-avatar-stage--react-got');
    gsap.fromTo(avStage, { scale: 1 }, { scale: 1.05, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
    setTimeout(() => avStage.classList.remove('opponent-avatar-stage--react-got'), 700);
  }

  await new Promise((r) => setTimeout(r, 280));

  const source = fromSlot || fromGroup;
  let ghost;
  let fromRect;
  if (source) {
    ({ ghost, from: fromRect } = createTransformGhost(source, { className: 'bluff-card-ghost golden-trail' }));
  } else {
    ghost = document.createElement('div');
    ghost.className = 'bluff-card-ghost golden-trail';
    ghost.innerHTML = renderCardBack();
    ghost.style.cssText = 'position:fixed;left:0;top:0;width:68px;height:95px;pointer-events:none;will-change:transform';
    document.body.appendChild(ghost);
    const cx = window.innerWidth / 2 - 34;
    const cy = window.innerHeight * 0.22 - 48;
    gsap.set(ghost, { x: cx, y: cy, force3D: true });
    fromRect = { width: 68, height: 95, left: cx, top: cy };
  }
  ghost.classList.add('card-glow');

  const to = mount?.getBoundingClientRect() || { left: window.innerWidth / 2 - 60, top: window.innerHeight * 0.45, width: 120, height: 168 };
  GameAudio.cardFwip();

  const targetRect = {
    left: to.left + (to.width - (fromRect?.width || 68)) / 2,
    top: to.top + (to.height - (fromRect?.height || 95)) / 2,
    width: to.width,
    height: to.height,
  };
  await springGhostToRect(ghost, targetRect, { rotate: 8, scale: to.width / (fromRect?.width || 68) });
  ghost.remove();
  const stamp = document.createElement('div');
  stamp.className = 'bluff-stamp thwack';
  stamp.textContent = 'THWACK';
  fxLayer().appendChild(stamp);
  gsap.fromTo(stamp, { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.18, ease: SPRING });
  gsap.to(stamp, { opacity: 0, duration: 0.25, delay: 0.35, onComplete: () => stamp.remove() });
  screenShake();
  haptic('heavy');
  GameAudio.cardTransferSlap?.();
  GameAudio.cardTok();

  if (mount && rank) await animateFlipReveal(mount, rank);

  const handGroup = document.querySelector(`.hand-topic-group[data-rank="${rank}"]`);
  if (handGroup) {
    handGroup.classList.add('hand-topic-group--received');
    gsap.fromTo(handGroup, { scale: 1.06 }, { scale: 1, duration: 0.4, ease: 'back.out(1.4)' });
    setTimeout(() => handGroup.classList.remove('hand-topic-group--received'), 600);
  }

  if (targetName) {
    const n = cardCount > 1 ? `all ${cardCount}` : 'it';
    showSaysBanner(targetName, `Yes… fine. Take ${n}.`, { typewriter: null });
  }
  return { rank };
}

/** Scenario 2 — honest denial: fast NOPE → GO FISH stamp (<700ms) */
export async function animateHonestDenial({ deckEl = null } = {}) {
  const hand = document.querySelector('#opponent-avatar-hand')
    || handMount()
    || document.querySelector('#opponent-hand-visual');
  const deck = deckEl || document.querySelector('#deck-pile-wrap');

  GameAudio.honestDenial();

  if (hand) {
    hand.classList.add('denial-hand-close');
    gsap.to(hand, { scale: 0.92, duration: 0.18, ease: 'power2.in' });
    gsap.to(hand, { x: '+=6', duration: 0.05, repeat: 5, yoyo: true, ease: 'none', onComplete: () => {
      gsap.set(hand, { x: 0, scale: 1 });
      hand.classList.remove('denial-hand-close');
    } });
  }

  const nope = document.createElement('div');
  nope.className = 'bluff-nope-flash';
  nope.innerHTML = '<span class="bluff-nope-x">✕</span><span>NOPE</span>';
  fxLayer().appendChild(nope);
  gsap.fromTo(nope, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.12, ease: SPRING });

  await new Promise((r) => setTimeout(r, 220));

  const stamp = document.createElement('div');
  stamp.className = 'bluff-stamp gofish-stamp gfy-toast-stamp';
  stamp.textContent = 'GO FUCK YOURSELF';
  fxLayer().appendChild(stamp);
  gsap.fromTo(stamp, { scale: 1.5, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.22, ease: SPRING });

  if (deck) {
    deck.classList.add('deck-invite');
    gsap.to(deck, { y: -4, duration: 0.15, yoyo: true, repeat: 3, ease: 'power1.inOut', onComplete: () => deck.classList.remove('deck-invite') });
  }

  haptic('light');
  await new Promise((r) => setTimeout(r, 280));
  gsap.to([nope, stamp], { opacity: 0, duration: 0.15, onComplete: () => { nope.remove(); stamp.remove(); } });
}

/** Scenario 3 — lie denial: typewriter "Nope." + subconscious tick + glance away */
export async function animateLieDenial({ targetName = 'They' } = {}) {
  document.body.classList.add('bluff-dim');
  GameAudio.honestDenial();
  GameAudio.lieDenialTick();
  const opp = opponentBar();
  const emoji = opp?.querySelector('.opp-emoji');
  if (emoji) {
    gsap.to(emoji, { x: 4, duration: 0.15, ease: 'power1.inOut', yoyo: true, repeat: 1 });
  }
  if (opp) opp.classList.add('lie-glance');
  await showSaysBanner(targetName, '', { typewriter: 'Nope.', slow: true });
  document.body.classList.remove('bluff-dim');
  opp?.classList.remove('lie-glance');
  if (opp) gsap.to(opp, { scale: 0.98, duration: 0.15 });
}

function showSaysBanner(name, text, { typewriter = null, slow = false } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'bluff-says-banner';
    el.innerHTML = `<div class="bluff-says-who">${name.split(' ')[0].toUpperCase()} SAYS...</div><div class="bluff-says-text"></div>`;
    fxLayer().appendChild(el);
    gsap.fromTo(el, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: SPRING });

    const textEl = el.querySelector('.bluff-says-text');
    const line = typewriter || text;
    if (typewriter) {
      let i = 0;
      const speed = slow ? 90 : 45;
      const id = setInterval(() => {
        i += 1;
        textEl.textContent = line.slice(0, i);
        if (i >= line.length) {
          clearInterval(id);
          setTimeout(() => {
            gsap.to(el, { opacity: 0, y: -12, duration: 0.3, delay: 0.5, onComplete: () => { el.remove(); resolve(); } });
          }, 400);
        }
      }, speed);
    } else {
      textEl.textContent = text;
      setTimeout(() => {
        gsap.to(el, { opacity: 0, duration: 0.25, onComplete: () => { el.remove(); resolve(); } });
      }, 900);
    }
  });
}

/** Bartender suspicion seed (10% on denials) */
export function animateSuspicion(text) {
  const whisper = document.getElementById('host-whisper');
  if (!whisper) return;
  whisper.classList.add('bartender-suspicious');
  const bubble = document.createElement('div');
  bubble.className = 'bluff-suspicion-bubble';
  bubble.innerHTML = `<span class="bluff-suspicion-icon">🍸</span><span>${text}</span>`;
  whisper.appendChild(bubble);
  gsap.fromTo(bubble, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: SPRING });
  gsap.fromTo(whisper.querySelector('.bartender-avatar'), { rotate: -3 }, { rotate: 3, duration: 0.2, yoyo: true, repeat: 1 });
  setTimeout(() => {
    gsap.to(bubble, { opacity: 0, duration: 0.3, onComplete: () => { bubble.remove(); whisper.classList.remove('bartender-suspicious'); } });
  }, 3200);
}

/** Scenario 4 — lie caught: freeze → silence → scratch → alarm → BOOM → LIAR */
export async function animateLieCaught({ defenderName, turnNumber, denialPhrase, punishment, lieMultiplier = 1 } = {}) {
  document.body.classList.add('bluff-freeze');

  const scratch = document.createElement('div');
  scratch.className = 'bluff-freeze-overlay bluff-freeze-flash';
  scratch.innerHTML = '<div class="bluff-pause-icon">⏸</div>';
  fxLayer().appendChild(scratch);
  gsap.fromTo(scratch, { opacity: 0 }, { opacity: 1, duration: 0.08 });

  await GameAudio.lieDetectedSequence();
  speakAnnouncer('BULLSHIT');

  const bust = document.createElement('div');
  bust.className = 'bluff-bullshit-banner';
  bust.innerHTML = `
    <div class="bluff-bullshit-title">🚨 BULLSHIT DETECTED 🚨</div>
    <div class="bluff-bullshit-denial">TURN ${turnNumber || '?'}</div>
    <div class="bluff-bullshit-quote">"${denialPhrase || 'Nah, don\'t have it.'}"</div>`;
  fxLayer().appendChild(bust);
  gsap.fromTo(bust, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: SPRING });
  screenShake('#screen-game', 10);
  haptic('heavy');

  await new Promise((r) => setTimeout(r, 900));

  const liar = document.createElement('div');
  liar.className = 'bluff-stamp liar-liar-stamp';
  liar.textContent = lieMultiplier > 1 ? `LIAR LIAR ×${lieMultiplier}` : 'LIAR LIAR';
  fxLayer().appendChild(liar);
  gsap.fromTo(liar, { scale: 2.5, rotate: -12, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.28, ease: SPRING });

  await new Promise((r) => setTimeout(r, 500));
  await animatePunishmentReveal(punishment, defenderName);

  gsap.to([scratch, bust, liar], {
    opacity: 0,
    duration: 0.4,
    delay: 0.6,
    onComplete: () => {
      scratch.remove();
      bust.remove();
      liar.remove();
      document.body.classList.remove('bluff-freeze');
    },
  });
}

/** Punishment KO slam */
export async function animatePunishmentReveal(label, victimName) {
  const card = document.createElement('div');
  card.className = 'bluff-punishment-ko';
  card.innerHTML = `<div class="bluff-punishment-victim">${victimName?.split(' ')[0] || 'LIAR'}</div><div class="bluff-punishment-label">${label || '+2 drinks'}</div>`;
  fxLayer().appendChild(card);
  gsap.fromTo(card, { y: -120, scale: 1.4, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.32, ease: SPRING });
  spawnParticles(window.innerWidth / 2, window.innerHeight * 0.42, { count: 14, color: '#ff453a' });
  GameAudio.punishmentDrink(label);
  haptic('success');
  await new Promise((r) => setTimeout(r, 1400));
  gsap.to(card, { opacity: 0, y: 20, duration: 0.3, onComplete: () => card.remove() });
}

/** Scenario 5 — ASK AGAIN token earned */
export function animateAskAgainToken({ multiplier = 2 } = {}) {
  const token = document.createElement('div');
  token.className = 'bluff-ask-again-token';
  token.innerHTML = `<span>🎣</span><span>ASK AGAIN</span>${multiplier > 2 ? `<span class="bluff-mult">×${multiplier - 1}</span>` : ''}`;
  fxLayer().appendChild(token);
  gsap.fromTo(token, { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.45, ease: SPRING });
  gsap.to(token, { opacity: 0, y: -30, duration: 0.35, delay: 2.2, onComplete: () => token.remove() });
  haptic('medium');
}

/** Double down prompt when re-asking same card */
export function animateDoubleDownPrompt() {
  const el = document.createElement('div');
  el.className = 'bluff-double-down';
  el.textContent = 'DOUBLE DOWN?';
  fxLayer().appendChild(el);
  gsap.fromTo(el, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: SPRING });
  document.body.classList.add('bluff-heartbeat');
  gsap.to(el, { opacity: 0, duration: 0.3, delay: 1.8, onComplete: () => { el.remove(); document.body.classList.remove('bluff-heartbeat'); } });
}

/** Scenario 6 — bluff master badge */
export function animateMasterBluff(playerName) {
  GameAudio.bluffMaster();
  const badge = document.createElement('div');
  badge.className = 'bluff-master-badge bluff-master-spin';
  badge.innerHTML = `<span>🎭</span><span>BLUFF MASTER</span><span class="bluff-master-sub">${playerName?.split(' ')[0] || ''}</span>`;
  const smoke = document.createElement('div');
  smoke.className = 'bluff-master-smoke';
  const opp = opponentBar();
  if (opp) {
    opp.appendChild(smoke);
    opp.appendChild(badge);
  } else {
    fxLayer().appendChild(smoke);
    fxLayer().appendChild(badge);
  }
  gsap.fromTo(badge, { scale: 0, rotate: -180, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.65, ease: SPRING });
  gsap.fromTo(smoke, { opacity: 0, scale: 0.6 }, { opacity: 0.7, scale: 1.2, duration: 0.5, ease: 'power2.out' });
  spawnParticles(window.innerWidth / 2, 120, { count: 10, color: '#a78bfa', spread: 40 });
  gsap.to([badge, smoke], { opacity: 0, duration: 0.4, delay: 2.5, onComplete: () => { badge.remove(); smoke.remove(); } });
}

/** Show lie badge on own avatar (defender only) */
export function showLieBadge() {
  const opp = opponentBar();
  if (!opp) return;
  let badge = opp.querySelector('.bluff-lie-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'bluff-lie-badge';
    badge.textContent = '🎭';
    opp.appendChild(badge);
  }
  gsap.fromTo(badge, { scale: 0 }, { scale: 1, duration: 0.35, ease: SPRING });
}

/** Draw after denial — deck wiggle path */
export async function animateGoFishDraw(rank, { deckEl = null, destEl = null } = {}) {
  const deck = deckEl || document.querySelector('#deck-pile-wrap');
  const mount = destEl || document.getElementById('active-card');
  if (deck && mount) await animateDrawFlick(deck, mount, { rank });
}
