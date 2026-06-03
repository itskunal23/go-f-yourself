// iOS-native motion tokens — UIKit-style springs, GPU-friendly card ghosts.
import gsap from '/vendor/gsap/index.js';

/** Standard iOS deceleration (approx. UIView ease-out) */
export const EASE_OUT = 'power3.out';
/** Travel / flick — quick acceleration */
export const EASE_TRAVEL = 'power4.in';
/** Lift before throw */
export const EASE_LIFT = 'power2.out';
/** Subtle settle overshoot (~5% — not cartoon back.out) */
export const EASE_SETTLE = 'back.out(1.05)';
/** Flip midpoint */
export const EASE_FLIP = 'power2.inOut';

export const DUR = {
  press: 0.12,
  select: 0.22,
  snapLift: 0.1,
  snapTravel: 0.2,
  snapSettle: 0.16,
  flip: 0.5,
  drawTotal: 0.42,
  land: 0.42,
};

let reducedMotion = null;

export function prefersReducedMotion() {
  if (reducedMotion === null) {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return reducedMotion;
}

/** GSAP ease + duration scaled for reduced motion */
export function motionScale(base = 1) {
  return prefersReducedMotion() ? base * 0.35 : base;
}

export function motionEase(ease, reduced = 'power1.out') {
  return prefersReducedMotion() ? reduced : ease;
}

/** Duration in seconds — never pass ease strings here. */
export function motionDuration(sec, reducedFactor = 0.35) {
  return prefersReducedMotion() ? sec * reducedFactor : sec;
}

/** Listen once for reduced-motion changes (a11y). */
export function watchReducedMotion(onChange) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fn = () => {
    reducedMotion = mq.matches;
    onChange?.(mq.matches);
  };
  mq.addEventListener?.('change', fn);
  return () => mq.removeEventListener?.('change', fn);
}

/** Fixed ghost positioned with transform (smoother on iOS Safari) */
export function createTransformGhost(sourceEl, {
  className = 'gfy-card-ghost',
  html = null,
  clone = true,
} = {}) {
  const from = sourceEl.getBoundingClientRect();
  const ghost = clone ? sourceEl.cloneNode(true) : document.createElement('div');
  ghost.className = className;
  if (html) ghost.innerHTML = html;
  ghost.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${from.width}px`,
    `height:${from.height}px`,
    'margin:0',
    'pointer-events:none',
    'transform-origin:center center',
    'will-change:transform',
  ].join(';');
  document.body.appendChild(ghost);
  gsap.set(ghost, { x: from.left, y: from.top, rotate: 0, scale: 1, force3D: true });
  return { ghost, from };
}

export function ghostTargetRect(from, toEl) {
  const to = toEl.getBoundingClientRect();
  const scale = to.width / from.width;
  return {
    x: to.left + (to.width - from.width) / 2,
    y: to.top + (to.height - from.height) / 2,
    scale,
    width: to.width,
    height: to.height,
  };
}

/** Re-trigger CSS land pulse on a mount element */
export function pulseCardLand(el) {
  if (!el) return;
  el.classList.remove('landing');
  void el.offsetWidth;
  el.classList.add('landing');
}

/** Standard hand → table travel with lift, arc, and settle */
export function timelineCardTravel(ghost, from, toEl, {
  liftY = -10,
  travelRotate = 2,
  liftRotate = -3,
  onLand = null,
} = {}) {
  const target = ghostTargetRect(from, toEl);
  const rm = prefersReducedMotion();
  const tl = gsap.timeline();
  if (rm) {
    tl.to(ghost, {
      x: target.x,
      y: target.y,
      scale: target.scale,
      rotate: 0,
      duration: motionScale(0.2),
      ease: 'power1.out',
      onComplete: () => {
        onLand?.(toEl);
        gsap.to(ghost, { opacity: 0, duration: 0.06 });
      },
    });
    return tl;
  }

  tl.to(ghost, { y: `+=${liftY}`, rotate: liftRotate, duration: DUR.snapLift, ease: EASE_LIFT }, 0);
  tl.to(ghost, {
    x: target.x,
    y: target.y,
    scale: target.scale,
    rotate: travelRotate,
    duration: DUR.snapTravel,
    ease: EASE_TRAVEL,
    onStart: () => ghost.classList.add('motion-blur-active'),
  }, DUR.snapLift);
  tl.to(ghost, {
    rotate: 0,
    scale: target.scale * 1.02,
    duration: DUR.snapSettle,
    ease: EASE_SETTLE,
    onComplete: () => onLand?.(toEl),
  }, DUR.snapLift + DUR.snapTravel);
  tl.to(ghost, { opacity: 0, scale: target.scale, duration: 0.07 }, '-=0.04');
  return tl;
}
