/**
 * iPhone drag-to-ask — lift centered hand stack, drag to opponent, release to ask.
 * Horizontal pans stay on the carousel (pointer threshold + capture only while dragging).
 */
import gsap from '/vendor/gsap/index.js';
import { haptic } from './mobile.js';
import { nearestSnapChild } from './touch-ui.js?v=2';
import { createTransformGhost, motionEase, DUR, EASE_SETTLE } from './motion.js?v=1';
import { GameAudio } from './game-audio.js?v=64';

const DRAG_START_PX = 10;
const DRAG_VERTICAL_BIAS = 1.25;
const TAP_MAX_MOVE = 14;
const TAP_MAX_MS = 320;

let getContext = () => ({});

function dropTargets() {
  return [
    document.getElementById('opponent-avatar-stage'),
    document.getElementById('active-card'),
    document.querySelector('.play-zone-stage'),
  ].filter(Boolean);
}

function hitDropZone(clientX, clientY) {
  for (const el of dropTargets()) {
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return el;
    }
  }
  return null;
}

function clearDropHighlights() {
  dropTargets().forEach((el) => el.classList.remove('gfy-drop-zone--hot'));
}

function updateDropHighlight(clientX, clientY) {
  clearDropHighlights();
  const hit = hitDropZone(clientX, clientY);
  hit?.classList.add('gfy-drop-zone--hot');
}

function centeredAskStack(scroller, stack) {
  if (!scroller || !stack) return false;
  const hit = nearestSnapChild(scroller, '.card-stack[data-drag-ask]');
  return hit === stack;
}

function positionGhost(ghost, clientX, clientY, offsetX, offsetY) {
  const w = ghost.offsetWidth;
  const h = ghost.offsetHeight;
  gsap.set(ghost, {
    x: clientX - w / 2 + offsetX,
    y: clientY - h / 2 + offsetY,
    force3D: true,
  });
}

function springGhostHome(drag) {
  const { ghost, stack } = drag;
  if (!ghost) return Promise.resolve();
  const rect = stack.getBoundingClientRect();
  return new Promise((resolve) => {
    gsap.to(ghost, {
      x: rect.left,
      y: rect.top,
      rotate: 0,
      scale: 1,
      duration: motionEase(DUR.snapTravel),
      ease: motionEase('back.out(1.2)'),
      onComplete: () => {
        ghost.remove();
        resolve();
      },
    });
    gsap.to(stack, {
      scale: 1,
      opacity: 1,
      duration: motionEase(DUR.snapSettle),
      ease: motionEase(EASE_SETTLE),
    });
  });
}

function springGhostToTarget(drag, targetEl) {
  const { ghost, stack, fromRect } = drag;
  const to = targetEl.getBoundingClientRect();
  const fw = fromRect?.width || ghost.offsetWidth;
  const fh = fromRect?.height || ghost.offsetHeight;
  return new Promise((resolve) => {
    gsap.to(ghost, {
      x: to.left + (to.width - fw) / 2,
      y: to.top + (to.height - fh) / 2,
      scale: to.width / fw,
      rotate: -6,
      duration: motionEase(0.28),
      ease: motionEase('power2.in'),
      onComplete: () => {
        ghost.remove();
        resolve();
      },
    });
    gsap.to(stack, { scale: 1, opacity: 1, duration: 0.2 });
  });
}

/** @param {() => object} contextFn */
export function initHandDragAsk(contextFn) {
  getContext = contextFn;
  const wrap = document.getElementById('hand-wrap');
  if (!wrap || wrap.dataset.dragAskInit) return;
  wrap.dataset.dragAskInit = '1';

  /** @type {null | object} */
  let drag = null;

  function cleanup() {
    if (!drag) return;
    drag.stack?.classList.remove('card-stack--drag-source');
    drag.scroller?.classList.remove('hand-shelf-scroller--locked');
    document.body.classList.remove('hand-drag-active');
    clearDropHighlights();
    try {
      drag.stack?.releasePointerCapture?.(drag.pointerId);
    } catch { /* noop */ }
    drag = null;
  }

  function startDrag(e) {
    if (!drag || drag.mode !== 'pending') return;
    drag.mode = 'drag';
    const { ghost, from: fromRect } = createTransformGhost(drag.stack, { className: 'hand-drag-ghost' });
    drag.ghost = ghost;
    drag.fromRect = fromRect;
    drag.offsetX = 0;
    drag.offsetY = -18;
    drag.stack.classList.add('card-stack--drag-source');
    drag.scroller.classList.add('hand-shelf-scroller--locked');
    document.body.classList.add('hand-drag-active');
    try {
      drag.stack.setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    positionGhost(ghost, e.clientX, e.clientY, drag.offsetX, drag.offsetY);
    gsap.fromTo(ghost, { scale: 0.88 }, { scale: 1.06, duration: 0.16, ease: 'power2.out' });
    gsap.to(drag.stack, { scale: 0.9, opacity: 0.28, duration: DUR.press });
    haptic('medium');
    GameAudio.cardSlide?.();
  }

  function onPointerDown(e) {
    if (e.button > 0) return;
    const stack = e.target.closest('.card-stack[data-drag-ask]');
    if (!stack) return;

    const ctx = getContext();
    if (!ctx.playable || ctx.blocked || ctx.askInFlight) return;

    const scroller = stack.closest('.hand-shelf-scroller--carousel');
    if (!scroller) return;

    if (!centeredAskStack(scroller, stack)) return;

    drag = {
      stack,
      rank: stack.dataset.rank,
      scroller,
      sx: e.clientX,
      sy: e.clientY,
      pointerId: e.pointerId,
      mode: 'pending',
      t0: performance.now(),
      ghost: null,
      from: null,
    };
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (drag.mode === 'pending') {
      if (absY > DRAG_START_PX && absY > absX * DRAG_VERTICAL_BIAS) {
        startDrag(e);
      } else if (absX > DRAG_START_PX && absX > absY * DRAG_VERTICAL_BIAS) {
        drag = null;
        return;
      }
      return;
    }

    if (drag.mode === 'drag' && drag.ghost) {
      e.preventDefault();
      positionGhost(drag.ghost, e.clientX, e.clientY, drag.offsetX, drag.offsetY);
      gsap.set(drag.ghost, { rotate: dx * 0.05, force3D: true });
      updateDropHighlight(e.clientX, e.clientY);
    }
  }

  async function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    const ctx = getContext();
    const elapsed = performance.now() - drag.t0;
    const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    const snap = { ...drag };

    if (snap.mode === 'pending' && moved < TAP_MAX_MOVE && elapsed < TAP_MAX_MS) {
      cleanup();
      if (ctx.onAsk) ctx.onAsk(snap.rank, snap.stack);
      return;
    }

    if (snap.mode === 'drag') {
      const zone = hitDropZone(e.clientX, e.clientY);
      clearDropHighlights();
      if (zone && ctx.onAsk) {
        haptic('success');
        await springGhostToTarget(snap, zone);
        cleanup();
        ctx.onAsk(snap.rank, snap.stack, { skipTheatre: true });
        return;
      }
      haptic('light');
      await springGhostHome(snap);
      cleanup();
      return;
    }

    cleanup();
  }

  wrap.addEventListener('pointerdown', onPointerDown, { passive: true });
  wrap.addEventListener('pointermove', onPointerMove, { passive: false });
  wrap.addEventListener('pointerup', onPointerUp);
  wrap.addEventListener('pointercancel', onPointerUp);
}
