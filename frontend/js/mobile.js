// ===========================================================================
//  iOS / iPhone mobile UX — safe areas, haptics, PWA hints, wake lock.
//  Aligns with Apple HIG: 44pt touch targets, feedback, thumb reach, a11y.
// ===========================================================================
import { GameAudio } from './game-audio.js?v=63';
import { initSheetGestures } from './sheet-gestures.js?v=1';

export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

/** Optional backend origin when static is on Vercel and API/WS lives elsewhere. */
export function serverOrigin() {
  const meta = document.querySelector('meta[name="gfy-server"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/, '');
  return '';
}

export function wsBaseUrl() {
  const origin = serverOrigin();
  if (origin) {
    const u = new URL(origin);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${u.protocol}//${u.host}`;
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}`;
}

export function apiBaseUrl() {
  const origin = serverOrigin();
  return origin || '';
}

/** Resolve fetch path — prepends server origin when split-deployed. */
export function apiUrl(path) {
  const base = apiBaseUrl();
  return base ? `${base}${path}` : path;
}

const HAPTIC = {
  light: 10,
  selection: 8,
  medium: [12, 24, 12],
  heavy: [24, 40, 24],
  success: [10, 36, 18],
  error: [40, 60, 40],
  turn: [16, 32, 16],
};

export function haptic(kind = 'light') {
  if (!navigator.vibrate) return;
  const p = HAPTIC[kind] ?? HAPTIC.light;
  try { navigator.vibrate(p); } catch {}
}

/** iOS-friendly clipboard — falls back to execCommand when async API fails. */
export async function copyText(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let wakeLock = null;

/** Keep screen awake during active game (Safari 16.4+ / Chrome). */
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {}
}

export async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch {}
  wakeLock = null;
}

function unlockAudioOnGesture() {
  GameAudio.resume();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  ctx.close?.();
}

function bindInstallHint() {
  const el = document.getElementById('install-hint');
  if (!el) return;
  const isSafari = isIOS && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);
  if (isIOS && isSafari && !isStandalone) {
    el.classList.remove('hidden');
    el.querySelector('[data-dismiss-install]')?.addEventListener('click', () => {
      el.classList.add('hidden');
      try { localStorage.setItem('gfy_install_dismissed', '1'); } catch {}
    });
    try {
      if (localStorage.getItem('gfy_install_dismissed')) el.classList.add('hidden');
    } catch {}
  }
}

function bindViewportKeyboard() {
  if (!window.visualViewport) return;
  const root = document.documentElement;
  const onResize = () => {
    const vv = window.visualViewport;
    const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty('--keyboard-gap', `${Math.round(gap)}px`);
  };
  visualViewport.addEventListener('resize', onResize);
  visualViewport.addEventListener('scroll', onResize);
  onResize();
}

/** Hide install hint + conn banner chrome during active play. */
export function setGameplayChrome(inGame) {
  document.body.classList.toggle('gameplay-active', !!inGame);
  const install = document.getElementById('install-hint');
  const conn = document.getElementById('conn-banner');
  if (inGame) {
    install?.classList.add('hidden');
    if (conn?.dataset.mode === 'online') conn?.classList.add('hidden');
  }
}

export function initMobileUX() {
  document.documentElement.classList.toggle('ios', isIOS);
  document.documentElement.classList.toggle('touch', isIOS || navigator.maxTouchPoints > 0);
  document.documentElement.classList.toggle('standalone', isStandalone);

  bindInstallHint();
  bindViewportKeyboard();
  initSheetGestures();

  const once = { passive: true };
  document.addEventListener('touchstart', unlockAudioOnGesture, once);
  document.addEventListener('click', unlockAudioOnGesture, once);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
}
