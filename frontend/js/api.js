// Thin client for the backend.
import { apiUrl, wsBaseUrl } from './mobile.js';

// ---------------------------------------------------------------------------
// Real-time game socket (two-phone multiplayer).
// Auto-reconnects and re-joins the room using the saved token.
// ---------------------------------------------------------------------------
export class GameSocket {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.queue = [];
    this.session = null; // { code, token }
    this.shouldReconnect = true;
    this._retry = 0;
    this.connected = false;
  }

  on(type, fn) { this.handlers[type] = fn; return this; }
  _emit(type, payload) { this.handlers[type]?.(payload); }

  _setConnected(on) {
    this.connected = on;
    this._emit(on ? 'connected' : 'disconnected');
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return this;
    }
    // Load persisted session before open — otherwise a fast WS handshake misses rejoin.
    this.loadSession();
    this._setConnected(false);
    if (this._retry > 0) this._emit('reconnecting', { attempt: this._retry });

    this.ws = new WebSocket(`${wsBaseUrl()}/ws`);

    this.ws.addEventListener('open', () => {
      this._retry = 0;
      this._setConnected(true);
      this._emit('open');
      if (this.session?.code && this.session?.token) {
        this._raw({ t: 'rejoin', code: this.session.code, token: this.session.token });
      }
      const q = this.queue;
      this.queue = [];
      if (q.length) this._emit('flush', { count: q.length });
      for (const m of q) this._raw(m);
    });

    this.ws.addEventListener('message', (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'joined') {
        this.session = { code: msg.code, token: msg.you.token };
        try { localStorage.setItem('gfy_session', JSON.stringify(this.session)); } catch {}
        this._emit('joined', msg);
      } else if (msg.t === 'state') {
        this._emit('state', msg.state);
      } else if (msg.t === 'error') {
        this._emit('error', msg);
      }
    });

    this.ws.addEventListener('close', () => {
      this._setConnected(false);
      this._emit('close');
      if (this.shouldReconnect) {
        this._retry = Math.min(this._retry + 1, 8);
        setTimeout(() => this.connect(), Math.min(400 * this._retry, 4000));
      }
    });
    this.ws.addEventListener('error', () => { try { this.ws.close(); } catch {} });
    return this;
  }

  loadSession() {
    try { this.session = JSON.parse(localStorage.getItem('gfy_session') || 'null'); } catch { this.session = null; }
    return this.session;
  }
  clearSession() {
    this.session = null;
    try { localStorage.removeItem('gfy_session'); } catch {}
  }

  _raw(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
    else this.queue.push(obj);
  }
  send(obj) { this._raw(obj); }
}

export async function getHealth() {
  try {
    const r = await fetch(apiUrl('/api/health'));
    return await r.json();
  } catch {
    return { ok: false, aiEnabled: false };
  }
}

export async function askHost(ctx) {
  try {
    const r = await fetch(apiUrl('/api/host'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    });
    const data = await r.json();
    return data.text || '';
  } catch {
    return '';
  }
}

export async function detectDrink(dataUrl, { timeoutMs = 90000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(apiUrl('/api/detect-drink'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
      signal: ctrl.signal,
    });
    const data = await r.json();
    if (!r.ok || data?.needsRetake || data?.source === 'offline') {
      if (data?.needsRetake || data?.source === 'offline' || /could not read/i.test(data?.name || '')) {
        throw new Error(
          data.roast || data.error || 'Could not read the label — retake with the brand facing the camera, or pick Old Monk manually.',
        );
      }
      if (!data?.name) throw new Error(data.error || `Scan failed (${r.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Scan timed out — try a closer, well-lit photo of the label.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Read a File -> resized JPEG dataURL (higher res helps read bottle labels).
export function fileToResizedDataUrl(file, maxDim = 1600, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
      else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}
