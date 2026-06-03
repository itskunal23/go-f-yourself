// Gyro tilt + idle float for the hero card (DeviceOrientation, iOS permission-aware).
import { isIOS } from './mobile.js';

let bound = false;

function applyTilt(mount, e) {
  if (mount.classList.contains('empty')) return;
  const tiltX = Math.max(-14, Math.min(14, (e.gamma || 0) * 0.38));
  const tiltY = Math.max(-10, Math.min(10, ((e.beta || 0) - 48) * 0.18));
  mount.style.setProperty('--hero-tilt-x', `${tiltX}deg`);
  mount.style.setProperty('--hero-tilt-y', `${tiltY}deg`);
}

export function initCardHero() {
  if (bound) return;
  const mount = document.getElementById('active-card');
  if (!mount) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const onOrient = (e) => applyTilt(mount, e);

  const start = () => {
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    bound = true;
  };

  if (isIOS && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.addEventListener('click', async function once() {
      document.removeEventListener('click', once);
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r === 'granted') start();
      } catch { /* denied */ }
    }, { once: true, passive: true });
  } else if ('DeviceOrientationEvent' in window) {
    start();
  }
}

export function resetCardHeroTilt() {
  const mount = document.getElementById('active-card');
  if (!mount) return;
  mount.style.setProperty('--hero-tilt-x', '-4deg');
  mount.style.setProperty('--hero-tilt-y', '3deg');
}
