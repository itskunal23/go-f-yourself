// Minimal table SFX — set-complete ding and card-on-deck only.

const noop = () => {};

const GameAudio = (() => {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function out() {
    ensure();
    return master || ctx?.destination;
  }

  function tone(freq, dur, {
    type = 'sine',
    vol = 0.12,
    attack = 0.008,
    decay = 0.06,
    when = 0,
  } = {}) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(out());
    o.start(t);
    o.stop(t + attack + decay + 0.02);
  }

  function noise(dur, { vol = 0.08, when = 0, filterFreq = 2000 } = {}) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + when;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filterFreq) {
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = filterFreq;
      f.Q.value = 1;
      src.connect(f).connect(g).connect(out());
    } else {
      src.connect(g).connect(out());
    }
    src.start(t);
  }

  /** Short bell when a 4-card set is banked. */
  function setDing() {
    tone(523.25, 0.45, { type: 'triangle', vol: 0.2, attack: 0.002, decay: 0.42 });
    tone(659.25, 0.32, { type: 'sine', vol: 0.1, attack: 0.002, decay: 0.28, when: 0.1 });
  }

  /** Card placed on / into the draw pile (pond). */
  function cardToDeck() {
    noise(0.06, { vol: 0.22, filterFreq: 2000 });
    tone(220, 0.05, { type: 'sine', vol: 0.12, attack: 0.001, decay: 0.04 });
  }

  const api = {
    resume: () => ensure()?.resume(),
    setDing,
    cardToDeck,
    // Legacy names → only the two sounds above (or silent)
    collectionComplete: setDing,
    collectionJackpot: setDing,
    cardDeal: cardToDeck,
    cardTok: cardToDeck,
    cardDraw: noop,
    cardsShuffle: noop,
    shuffleTick: noop,
    cardFwip: noop,
    cardSlide: noop,
    flip: noop,
    slam: noop,
    askTick: noop,
    honestDenial: noop,
    lieDenialTick: noop,
    bluffMaster: noop,
    lieDetectedSequence: async () => {},
    punishmentDrink: noop,
    heartbeatStart: noop,
    heartbeatStop: noop,
    endgameFanfare: noop,
    bartenderSting: noop,
    bartenderChirp: noop,
    duck: noop,
    unduck: noop,
    bass: noop,
    bottleThunk: noop,
    bottleTick: noop,
    bottleClack: noop,
    legendaryReveal: noop,
    victory: noop,
    glassClink: noop,
    cardTransferSlap: noop,
    collectionProgress: noop,
  };

  return api;
})();

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const BartenderVoice = { small: noop, medium: noop };

export function bartenderHuge(line, { display = 'FILTHY<br>COMPLETE' } = {}) {
  return { line, display };
}

export function speakAnnouncer() {}

export { GameAudio, wait };
