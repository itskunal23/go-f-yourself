import gsap from 'gsap';

/** GSAP animation helpers with spring-like motion. */

const SPRING = 'back.out(1.4)';
const SPRING_SOFT = 'power3.out';
const SPRING_BOUNCE = 'elastic.out(1, 0.6)';

export class AnimationController {
  constructor() {
    this.shakeTween = null;
    this.spotlightTween = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setReducedMotion(on) {
    this.reducedMotion = on;
  }

  /** Camera shake on the canvas container */
  shake(container, intensity = 1) {
    if (this.reducedMotion || !container) return;
    if (this.shakeTween) this.shakeTween.kill();
    const amount = 6 * intensity;
    this.shakeTween = gsap.fromTo(
      container,
      { x: 0, y: 0 },
      {
        x: () => (Math.random() - 0.5) * amount,
        y: () => (Math.random() - 0.5) * amount,
        duration: 0.06,
        repeat: 8,
        yoyo: true,
        ease: 'power1.inOut',
        onComplete: () => gsap.set(container, { x: 0, y: 0 }),
      }
    );
  }

  /** Scale pulse on an element */
  pulse(el, scale = 1.12) {
    if (!el) return;
    if (this.reducedMotion) {
      gsap.set(el, { scale: 1 });
      return;
    }
    gsap.fromTo(
      el,
      { scale: 1 },
      { scale, duration: 0.35, ease: SPRING_BOUNCE, yoyo: true, repeat: 1 }
    );
  }

  /** Fade + slide menu transition */
  showPanel(el, direction = 'up') {
    if (!el) return gsap.timeline();
    const y = direction === 'up' ? 40 : -40;
    if (this.reducedMotion) {
      gsap.set(el, { opacity: 1, y: 0 });
      return gsap.timeline();
    }
    return gsap.fromTo(
      el,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration: 0.55, ease: SPRING_SOFT }
    );
  }

  hidePanel(el, direction = 'down') {
    if (!el) return gsap.timeline();
    const y = direction === 'down' ? 30 : -30;
    if (this.reducedMotion) {
      gsap.set(el, { opacity: 0 });
      return gsap.timeline();
    }
    return gsap.to(el, { opacity: 0, y, duration: 0.35, ease: 'power2.in' });
  }

  /** Button press feedback */
  buttonPress(el) {
    if (!el || this.reducedMotion) return;
    gsap.fromTo(el, { scale: 1 }, { scale: 0.94, duration: 0.08, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  /** Anticipation delay before reveal */
  anticipation(callback, delay = 0.6) {
    if (this.reducedMotion) {
      callback?.();
      return gsap.timeline();
    }
    return gsap.delayedCall(delay, callback);
  }

  /** Spotlight glow on selected player */
  spotlight(intensity, onUpdate) {
    if (this.spotlightTween) this.spotlightTween.kill();
    const obj = { v: 0 };
    this.spotlightTween = gsap.to(obj, {
      v: intensity,
      duration: 0.8,
      ease: SPRING,
      onUpdate: () => onUpdate?.(obj.v),
    });
    return this.spotlightTween;
  }

  /** Table breathing scale */
  breatheTable(el) {
    if (!el || this.reducedMotion) return;
    gsap.to(el, {
      scale: 1.02,
      duration: 2.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Stagger children in */
  staggerIn(container, selector = '.stb-stagger') {
    if (!container) return;
    const items = container.querySelectorAll(selector);
    if (this.reducedMotion) {
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      items,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: SPRING_SOFT }
    );
  }

  killAll() {
    this.shakeTween?.kill();
    this.spotlightTween?.kill();
  }
}

export { gsap, SPRING, SPRING_SOFT, SPRING_BOUNCE };
