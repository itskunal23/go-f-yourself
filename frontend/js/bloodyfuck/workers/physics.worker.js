/** Lightweight spring physics for severed limbs / blood blobs. */
/** @type {{ id: number, x: number, y: number, vx: number, vy: number, life: number }[]} */
let bodies = [];
let nextId = 1;

self.onmessage = (ev) => {
  const t0 = performance.now();
  const { type, payload } = ev.data || {};

  if (type === 'spawn') {
    bodies.push({
      id: nextId++,
      x: payload.x || 0,
      y: payload.y || 1,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2,
      life: 1,
    });
  } else if (type === 'step') {
    const dt = payload?.dt || 0.016;
    const g = -9.8;
    const out = [];
    for (const b of bodies) {
      b.vy += g * dt * 0.15;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt * 0.35;
      if (b.y < 0) { b.y = 0; b.vy *= -0.35; b.vx *= 0.8; }
      if (b.life > 0) out.push(b);
    }
    bodies = out;
  } else if (type === 'clear') {
    bodies = [];
  }

  self.postMessage({ type: 'bodies', bodies, latency: performance.now() - t0 });
};
