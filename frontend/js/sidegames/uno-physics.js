import gsap from '/vendor/gsap/index.js';
import { createTransformGhost, timelineCardTravel, pulseCardLand } from '../motion.js?v=1';

let audioCtx;

function playTone(freq, dur, type = 'sine', vol = 0.07) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch { /* muted */ }
}

export function playCardLand() { playTone(196, 0.09, 'triangle'); }
export function playCardDraw() { playTone(340, 0.07, 'sine'); }
export function playImpact() { playTone(82, 0.14, 'square', 0.1); }
export function playWham() {
  playTone(55, 0.22, 'square', 0.14);
  setTimeout(() => playTone(110, 0.08, 'sawtooth', 0.06), 40);
}
export function playSkip() { playTone(280, 0.05, 'square', 0.09); setTimeout(() => playTone(180, 0.06, 'square', 0.07), 50); }
export function playReverse() { playTone(420, 0.12, 'sine', 0.08); playTone(320, 0.1, 'sine', 0.05); }
export function playUnoCrowd() {
  [330, 392, 440, 523].forEach((f, i) => setTimeout(() => playTone(f, 0.14, 'triangle', 0.06), i * 70));
}
export function playVictory() {
  [262, 330, 392, 523, 659].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'triangle', 0.07), i * 90));
}

function randomTilt() {
  return (Math.random() - 0.5) * 8;
}

/** Card lifts from hand → lands on hero pile */
export function animateUnoPlay(fromEl, toEl) {
  if (!fromEl || !toEl) return Promise.resolve();
  const { ghost, from } = createTransformGhost(fromEl, { className: 'uno-card-ghost' });
  fromEl.style.opacity = '0';

  return new Promise((resolve) => {
    const tl = timelineCardTravel(ghost, from, toEl, {
      liftY: -8,
      travelRotate: randomTilt(),
      onLand: () => {
        landHeroCard(toEl);
        playCardLand();
      },
    });
    tl.eventCallback('onComplete', () => {
      ghost.remove();
      fromEl.style.opacity = '';
      if (navigator.vibrate) navigator.vibrate(8);
      resolve();
    });
  });
}

/** Deck compress → card flies to hand */
export function animateUnoDraw(deckEl, handEl) {
  if (!deckEl || !handEl) return Promise.resolve();
  deckEl.classList.remove('wiggle');
  void deckEl.offsetWidth;
  deckEl.classList.add('wiggle');

  const from = deckEl.getBoundingClientRect();
  const to = handEl.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'uno-card-ghost uno-card-ghost--back';
  ghost.innerHTML = '<div class="uno-deck-ghost-face"></div>';
  ghost.style.cssText = `left:${from.left + from.width / 2 - 28}px;top:${from.top}px;width:56px;height:78px`;
  document.body.appendChild(ghost);

  return new Promise((resolve) => {
    gsap.to(ghost, {
      left: to.left + to.width / 2 - 28,
      top: to.bottom - 90,
      rotate: 14,
      duration: 0.32,
      ease: 'power2.out',
      onComplete: () => {
        ghost.remove();
        playCardDraw();
        if (navigator.vibrate) navigator.vibrate(6);
        resolve();
      },
    });
  });
}

export function landHeroCard(heroEl) {
  if (heroEl) {
    heroEl.style.setProperty('--uno-hero-tilt', `${randomTilt()}deg`);
  }
  pulseCardLand(heroEl);
}

/** Rapid multi-card draw — WHAM + counting */
export function animateUnoDrawBurst(deckEl, handEl, count = 1) {
  if (count <= 1) return animateUnoDraw(deckEl, handEl);

  const root = deckEl?.closest('.uno-float-layer')?.parentElement || document.body;
  let counter = document.getElementById('uno-draw-burst');
  if (!counter) {
    counter = document.createElement('div');
    counter.id = 'uno-draw-burst';
    counter.className = 'uno-draw-burst';
    (deckEl?.closest('.sg-body') || document.body).appendChild(counter);
  }

  playWham();
  if (navigator.vibrate) navigator.vibrate([30, 50, 80, 40]);

  counter.innerHTML = `<span class="uno-draw-burst__wham">WHAM!</span><span class="uno-draw-burst__count">+${count}</span>`;
  counter.classList.remove('show');
  void counter.offsetWidth;
  counter.classList.add('show');

  shakeTable(deckEl?.closest('.uno-table'), { strength: Math.min(6 + count, 16), ms: 420 });

  const tickEl = document.createElement('div');
  tickEl.className = 'uno-draw-tick';
  (deckEl?.closest('.sg-body') || document.body).appendChild(tickEl);

  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      i += 1;
      tickEl.textContent = `+${i}`;
      tickEl.classList.remove('pop');
      void tickEl.offsetWidth;
      tickEl.classList.add('pop');
      playCardDraw();
      if (i < count) {
        setTimeout(step, 80 + Math.random() * 40);
      } else {
        setTimeout(() => {
          tickEl.remove();
          counter.classList.remove('show');
          animateUnoDraw(deckEl, handEl).then(resolve);
        }, 280);
      }
    };
    setTimeout(step, 180);
  });
}

export function shakeTable(rootEl, { ms = 320, strength = 6 } = {}) {
  const el = rootEl || document.querySelector('.uno-table');
  if (!el) return;
  el.classList.remove('uno-shake');
  void el.offsetWidth;
  el.classList.add('uno-shake');
  el.style.setProperty('--shake-mag', `${strength}px`);
  playImpact();
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  setTimeout(() => el.classList.remove('uno-shake'), ms);
}

export function spinDirection(el, direction) {
  if (!el) return;
  el.dataset.dir = direction >= 0 ? 'cw' : 'ccw';
  el.classList.remove('spin');
  void el.offsetWidth;
  el.classList.add('spin');
  playReverse();
}

export function flashStack(count) {
  const el = document.getElementById('uno-stack-toast');
  if (!el) return;
  el.textContent = `🔥 +${count} STACKED`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  playImpact();
  if (navigator.vibrate) navigator.vibrate([12, 24, 12]);
  setTimeout(() => el.classList.remove('show'), 1800);
}

export function pulseUno() {
  const el = document.getElementById('uno-flash');
  if (!el) return;
  el.textContent = 'UNO!';
  el.className = 'uno-reaction-flash show uno';
  playUnoCrowd();
  if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  setTimeout(() => el.classList.remove('show'), 1400);
}
