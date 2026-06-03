export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Load Matter.js UMD build once. @returns {Promise<typeof Matter>} */
export function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/matter-js/matter.min.js';
    s.onload = () => resolve(window.Matter);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
