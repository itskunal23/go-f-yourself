/**
 * Single card motion pipeline — transform-only, velocity-aware springs.
 * Used by hand-drag, hand-focus reflow, bluff travel, set sequences.
 */
import gsap from '/vendor/gsap/index.js';
import {
  createTransformGhost,
  motionDuration,
  motionEase,
  motionScale,
  EASE_SETTLE,
  DUR,
  prefersReducedMotion,
} from '../motion.js';

/** Track pointer velocity for release inertia (Tinder-style). */
export class VelocityTracker {
  constructor() {
    this.samples = [];
    this.maxSamples = 5;
  }

  reset() {
    this.samples = [];
  }

  sample(x, y, t = performance.now()) {
    this.samples.push({ x, y, t });
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  velocity() {
    if (this.samples.length < 2) return { vx: 0, vy: 0 };
    const a = this.samples[0];
    const b = this.samples[this.samples.length - 1];
    const dt = Math.max(1, b.t - a.t);
    return {
      vx: ((b.x - a.x) / dt) * 16,
      vy: ((b.y - a.y) / dt) * 16,
    };
  }
}

/** Weighted tilt from horizontal drag (subtle, not cartoon). */
export function dragTilt(dx, mass = 1) {
  const cap = 12 / mass;
  return Math.max(-cap, Math.min(cap, dx * 0.04));
}

/**
 * Spring ghost to fixed rect using transform + optional velocity overshoot.
 */
export function springGhostToRect(ghost, targetRect, {
  velocity = { vx: 0, vy: 0 },
  rotate = 0,
  scale = 1,
  onComplete,
} = {}) {
  const overshootX = prefersReducedMotion() ? 0 : velocity.vx * 0.08;
  const overshootY = prefersReducedMotion() ? 0 : velocity.vy * 0.08;
  return new Promise((resolve) => {
    gsap.to(ghost, {
      x: targetRect.left + overshootX,
      y: targetRect.top + overshootY,
      rotate,
      scale,
      duration: motionDuration(DUR.snapTravel),
      ease: motionEase(EASE_SETTLE, 'power2.out'),
      onComplete: () => {
        gsap.to(ghost, {
          x: targetRect.left,
          y: targetRect.top,
          duration: motionDuration(0.1),
          ease: motionEase('power2.out'),
          onComplete: () => {
            onComplete?.();
            resolve();
          },
        });
      },
    });
  });
}

/** Travel ghost from element A → element B (transform-only). */
export function travelGhostBetween(fromEl, toEl, {
  className = 'gfy-card-ghost',
  liftY = -10,
  onLand,
} = {}) {
  if (!fromEl || !toEl) return Promise.resolve();
  const { ghost, from } = createTransformGhost(fromEl, { className });
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        ghost.remove();
        resolve();
      },
    });
    const to = toEl.getBoundingClientRect();
    const fw = from.width;
    const fh = from.height;
    const target = {
      left: to.left + (to.width - fw) / 2,
      top: to.top + (to.height - fh) / 2,
      width: to.width,
      height: to.height,
    };
    const rm = prefersReducedMotion();
    if (rm) {
      tl.to(ghost, {
        x: target.left,
        y: target.top,
        scale: target.width / fw,
        rotate: 0,
        duration: motionDuration(0.2),
        ease: 'power1.out',
        onComplete: () => onLand?.(toEl),
      });
      return;
    }
    tl.to(ghost, { y: `+=${liftY}`, duration: DUR.snapLift, ease: 'power2.out' }, 0);
    tl.to(ghost, {
      x: target.left,
      y: target.top,
      scale: target.width / fw,
      rotate: -4,
      duration: motionDuration(DUR.snapTravel),
      ease: 'power4.in',
      onComplete: () => onLand?.(toEl),
    }, DUR.snapLift);
    tl.to(ghost, { opacity: 0, duration: 0.06 }, '-=0.04');
  });
}

/** Reflow arc fan stacks after focus change (compress siblings). */
export function reflowArcHand(shelf, { focusedRank = null, duration = 0.28 } = {}) {
  if (!shelf || prefersReducedMotion()) return;
  const stacks = [...shelf.querySelectorAll('.card-stack[data-rank]')];
  const total = stacks.length;
  stacks.forEach((el, index) => {
    const rank = el.dataset.rank;
    const mid = (total - 1) / 2;
    const t = total > 9 ? 9 / total : 1;
    const maxRot = total <= 4 ? 14 : total <= 6 ? 20 : 26;
    const rot = mid ? ((index - mid) / mid) * maxRot * t : 0;
    const arc = Math.abs(index - mid) * (total > 6 ? 2.8 : 3.5);
    const overlap = total > 10 ? -50 : total > 8 ? -46 : total > 5 ? -42 : -38;
    const lift = rank === focusedRank ? -22 : el.dataset.suggested === '1' ? -10 : 0;
    const z = rank === focusedRank ? 200 : index + 1;
    gsap.to(el, {
      '--fan-rot': `${rot}deg`,
      '--fan-arc': `${arc}px`,
      '--fan-lift': `${lift}px`,
      marginLeft: index === 0 ? 0 : overlap,
      zIndex: z,
      duration: motionScale(duration),
      ease: motionEase(EASE_SETTLE, 'power2.out'),
      overwrite: 'auto',
    });
  });
}
