/**
 * Dramatic ask-for-card theatre — speech bubble + card slide to table center.
 */
import gsap from '/vendor/gsap/index.js';
import { rankName } from './game.js?v=63';
import { GameAudio } from './game-audio.js?v=64';
import { prefersReducedMotion } from './motion.js?v=1';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function ensureBubbleLayer() {
  let layer = document.getElementById('ask-speech-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'ask-speech-layer';
    layer.className = 'ask-speech-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.getElementById('screen-game')?.appendChild(layer);
  }
  return layer;
}

/** Show "Do you have a …?" then resolve when card reaches center. */
export async function animateAskIntent({ rank, targetName, fromEl, destEl }) {
  const line = rankName(rank) || rank;
  const shortTarget = (targetName || 'them').split(' ')[0];
  const layer = ensureBubbleLayer();

  const bubble = document.createElement('div');
  bubble.className = 'ask-speech-bubble';
  bubble.innerHTML = `
    <span class="ask-speech-bubble__to">${esc(shortTarget)}</span>
    <p class="ask-speech-bubble__line">Hey, do you have a<br><strong>${esc(line)}</strong>?</p>`;
  layer.appendChild(bubble);
  layer.setAttribute('aria-hidden', 'false');

  GameAudio.askTick?.();
  GameAudio.cardSlide?.();

  if (!prefersReducedMotion()) {
    gsap.fromTo(bubble, { scale: 0.7, opacity: 0, y: 12 }, { scale: 1, opacity: 1, y: 0, duration: 0.32, ease: 'back.out(1.6)' });
  }

  const oppHand = document.getElementById('opponent-avatar-hand');
  if (oppHand && !prefersReducedMotion()) {
    oppHand.classList.add('opponent-avatar-hand--watching');
    setTimeout(() => oppHand.classList.remove('opponent-avatar-hand--watching'), 900);
  }

  const travel = fromEl && destEl
    ? import('./animations.js?v=65').then((m) => m.animateCardSnap(fromEl, destEl))
    : Promise.resolve();

  await Promise.all([
    travel,
    prefersReducedMotion() ? wait(280) : wait(520),
  ]);

  if (!prefersReducedMotion()) {
    await gsap.to(bubble, { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in' });
  }
  bubble.remove();
  if (!layer.children.length) layer.setAttribute('aria-hidden', 'true');
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** YES — card launches across table with whoosh + slap. */
export function animateCardTransferYes(fromEl, destEl) {
  GameAudio.cardSlide?.();
  return import('./bluff-animations.js?v=64').then((m) =>
    m.animateCardGive({ rank: destEl?.dataset?.rank, destEl, cardCount: 1 }),
  );
}

/** GFY denial stamp — no full-screen moment. */
export function showGoFishDenial() {
  GameAudio.honestDenial?.();
  return import('./bluff-animations.js?v=64').then((m) => m.animateHonestDenial({}));
}
