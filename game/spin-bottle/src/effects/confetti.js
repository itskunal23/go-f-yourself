/** Canvas confetti burst. */

const COLORS = ['#ff6b9d', '#19e6ff', '#ffd23f', '#56ffa8', '#c44dff', '#ff2d95', '#fff'];

export class ConfettiSystem {
  constructor() {
    this.particles = [];
  }

  burst(x, y, count = 80) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        w: 4 + Math.random() * 8,
        h: 6 + Math.random() * 10,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        gravity: 0.12 + Math.random() * 0.08,
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vx *= 0.99;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotV;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  render(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles = [];
  }
}

export const confetti = new ConfettiSystem();
