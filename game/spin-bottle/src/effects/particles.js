/** Ambient floating particles for premium atmosphere. */

export class ParticleField {
  constructor(count = 40) {
    this.particles = [];
    this.count = count;
  }

  init(w, h) {
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      this.particles.push(this.spawn(w, h, true));
    }
  }

  spawn(w, h, randomY = false) {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 10,
      r: 1 + Math.random() * 2.5,
      vy: -0.2 - Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      alpha: 0.1 + Math.random() * 0.35,
      hue: 200 + Math.random() * 120,
    };
  }

  update(w, h) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.0008;
      if (p.y < -10 || p.alpha <= 0) {
        this.particles[i] = this.spawn(w, h);
      }
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
      ctx.fill();
    }
  }
}

export const ambientParticles = new ParticleField(35);
