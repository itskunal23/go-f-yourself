// In-match chaos bottle overlay — interrupts the card game like a blue shell.
import gsap from '/vendor/gsap/index.js';
import { GameAudio } from './game-audio.js?v=70';

let playing = false;
let lastChaosId = null;

function seatAngle(index, count) {
  const n = Math.max(2, count);
  return (360 / n) * index - 90;
}

function ensureOverlay() {
  let el = document.getElementById('chaos-bottle-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'chaos-bottle-overlay';
  el.className = 'chaos-bottle-overlay cb-compact hidden';
  el.innerHTML = `
    <div class="cb-dim" aria-hidden="true"></div>
    <div class="cb-stage" role="dialog" aria-live="assertive" aria-label="Chaos bottle spin">
      <p class="cb-title"></p>
      <div class="cb-table">
        <div class="cb-seats"></div>
        <div class="cb-bottle-wrap">
          <div class="cb-bottle" aria-hidden="true">🍾</div>
        </div>
      </div>
      <p class="cb-status" role="status"></p>
      <div class="cb-stamp hidden"></div>
      <div class="cb-fate hidden">
        <p class="cb-fate-label">Choose your fate.</p>
        <div class="cb-fate-btns">
          <button type="button" class="btn-secondary" data-fate="drink">Drink</button>
          <button type="button" class="btn-secondary" data-fate="risk">Risk</button>
          <button type="button" class="btn-secondary" data-fate="chaos">Chaos</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function renderSeats(container, players, targetId) {
  const humans = players.filter((p) => !p.isBot);
  const n = Math.max(2, humans.length);
  container.innerHTML = humans.map((p, i) => {
    const ang = seatAngle(i, n);
    const short = p.name.split(' ')[0];
    const glow = p.id === targetId ? ' cb-seat-glow' : '';
    return `<div class="cb-seat${glow}" data-id="${p.id}" style="--cb-angle:${ang}deg">
      <span class="cb-seat-avatar">${short.slice(0, 1).toUpperCase()}</span>
      <span class="cb-seat-name">${short}</span>
    </div>`;
  }).join('');
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function spinBottle(bottleEl, targetIndex, playerCount) {
  const land = seatAngle(targetIndex, playerCount);
  const spins = 4 + Math.floor(Math.random() * 3);
  const total = spins * 360 + land + (Math.random() * 16 - 8);

  gsap.set(bottleEl, { rotation: 0, transformOrigin: '50% 85%' });

  GameAudio.bottleThunk?.();
  await gsap.fromTo(bottleEl.parentElement, { y: -120, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.35, ease: 'bounce.out',
  });

  document.body.classList.add('cb-spin-active');
  GameAudio.duck?.(4);

  await new Promise((resolve) => {
    let tickAt = 0;
    gsap.to(bottleEl, {
      rotation: total,
      duration: 4.2 + Math.random() * 1.2,
      ease: 'power3.out',
      onUpdate() {
        const prog = this.progress();
        if (prog > 0.55 && Date.now() - tickAt > 280 + prog * 420) {
          tickAt = Date.now();
          GameAudio.bottleTick?.();
        }
      },
      onComplete: resolve,
    });
  });

  GameAudio.bottleClack?.();
  GameAudio.unduck?.();
  document.body.classList.remove('cb-spin-active');

  await gsap.to(bottleEl, {
    rotation: `+=${(Math.random() - 0.5) * 6}`,
    duration: 0.45,
    ease: 'elastic.out(1, 0.35)',
  });
}

async function showStamp(overlay, label, good) {
  const stamp = overlay.querySelector('.cb-stamp');
  stamp.className = `cb-stamp show ${good ? 'cb-stamp-good' : 'cb-stamp-bad'}`;
  stamp.textContent = label;
  stamp.classList.remove('hidden');
  gsap.fromTo(stamp, { scale: 2.2, opacity: 0, rotate: -8 }, {
    scale: 1, opacity: 1, rotate: 0, duration: 0.45, ease: 'back.out(2.5)',
  });
  if (good) GameAudio.collectionJackpot?.();
  else GameAudio.bass?.(0.35, 0.22);
  await wait(1400);
}

function pickFate(overlay) {
  return new Promise((resolve) => {
    const fate = overlay.querySelector('.cb-fate');
    fate.classList.remove('hidden');
    gsap.fromTo(fate, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });
    const onPick = (e) => {
      const btn = e.target.closest('[data-fate]');
      if (!btn) return;
      fate.querySelectorAll('[data-fate]').forEach((b) => b.removeEventListener('click', onPick));
      fate.classList.add('hidden');
      resolve(btn.dataset.fate);
    };
    fate.querySelectorAll('[data-fate]').forEach((b) => b.addEventListener('click', onPick));
  });
}

export async function playBottleChaos(view, ev, socket) {
  if (!ev?.id || playing) return;
  if (lastChaosId === ev.id) return;
  lastChaosId = ev.id;
  playing = true;

  const overlay = ensureOverlay();
  const titleEl = overlay.querySelector('.cb-title');
  const statusEl = overlay.querySelector('.cb-status');
  const seatsEl = overlay.querySelector('.cb-seats');
  const bottleEl = overlay.querySelector('.cb-bottle');
  const stampEl = overlay.querySelector('.cb-stamp');
  const fateEl = overlay.querySelector('.cb-fate');

  titleEl.textContent = ev.title || '🍸 LAST CALL CHAOS';
  statusEl.textContent = 'The bottle slides onto the table…';
  stampEl.classList.add('hidden');
  fateEl.classList.add('hidden');
  overlay.classList.remove('hidden');
  gsap.set(overlay.querySelector('.cb-dim'), { opacity: 0 });
  gsap.to(overlay.querySelector('.cb-dim'), { opacity: 1, duration: 0.35 });

  renderSeats(seatsEl, view.players, ev.targetId);

  const targetIdx = ev.seatIndex ?? 0;
  const count = ev.playerCount || 2;

  try {
    await wait(400);
    statusEl.textContent = 'Spinning…';
    await spinBottle(bottleEl, targetIdx, count);

    const targetName = ev.targetName?.split(' ')[0] || 'Player';
    statusEl.textContent = `${targetName} — bottle landed.`;
    seatsEl.querySelector(`[data-id="${ev.targetId}"]`)?.classList.add('cb-seat-glow');

    let fateChoice = null;
    if (ev.fateChoice && ev.targetId === view.you) {
      statusEl.textContent = 'Choose your fate.';
      fateChoice = await pickFate(overlay);
    }

    const fateLabels = {
      drink: '🍺 Drink 2',
      risk: '🎭 Reveal one card',
      chaos: '🔥 Draw 2 · go again',
    };
    const effectLabel = fateChoice
      ? (fateLabels[fateChoice] || ev.effect?.label)
      : (ev.effect?.label || 'CHAOS');
    const effectGood = fateChoice ? fateChoice === 'chaos' : !!ev.effect?.good;
    await showStamp(overlay, effectLabel, effectGood);

    const me = view.players.find((p) => p.id === view.you);
    if (ev.fateChoice) {
      if (ev.targetId === view.you) {
        socket?.send?.({ t: 'resolveBottleChaos', fateChoice });
      }
    } else if (me?.isHost) {
      socket?.send?.({ t: 'resolveBottleChaos' });
    }
  } finally {
    await gsap.to(overlay.querySelector('.cb-dim'), { opacity: 0, duration: 0.35 });
    overlay.classList.add('hidden');
    playing = false;
  }
}

export function resetBottleChaosUi() {
  playing = false;
  lastChaosId = null;
  document.getElementById('chaos-bottle-overlay')?.classList.add('hidden');
}
