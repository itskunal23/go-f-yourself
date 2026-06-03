import { rand } from '../utils.js';

/**
 * Fixed-size particle pool — no per-frame allocations.
 */
export class ParticlePool {
  /** @param {number} size */
  constructor(size) {
    this.size = size;
    this.items = new Array(size);
    for (let i = 0; i < size; i++) {
      this.items[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 2, kind: 'dust', a: 1 };
    }
  }

  /** @param {Partial<{x:number,y:number,vx:number,vy:number,life:number,r:number,kind:string,a:number}>} o */
  emit(o) {
    const p = this.items.find((x) => !x.active);
    if (!p) return null;
    p.active = true;
    p.x = o.x ?? 0;
    p.y = o.y ?? 0;
    p.vx = o.vx ?? rand(-1, 1);
    p.vy = o.vy ?? rand(-2, 0);
    p.life = o.life ?? 0.5;
    p.max = p.life;
    p.r = o.r ?? 2;
    p.kind = o.kind ?? 'dust';
    p.a = o.a ?? 1;
    return p;
  }

  burst(x, y, kind, n = 12) {
    for (let i = 0; i < n; i++) {
      this.emit({
        x: x + rand(-4, 4),
        y: y + rand(-4, 4),
        vx: rand(-3, 3),
        vy: rand(-4, 1),
        life: rand(0.25, 0.7),
        r: rand(1, kind === 'spark' ? 2.5 : 4),
        kind,
      });
    }
  }

  /** @param {number} dt */
  update(dt) {
    for (const p of this.items) {
      if (!p.active) continue;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.kind === 'spark') p.vy += 0.15;
      else if (p.kind === 'debris') p.vy += 0.35;
      else p.vy += 0.08;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} camX */
  draw(ctx, camX) {
    for (const p of this.items) {
      if (!p.active) continue;
      const a = (p.life / p.max) * p.a;
      ctx.globalAlpha = a;
      if (p.kind === 'spark') {
        ctx.fillStyle = '#ffd080';
        ctx.fillRect(p.x - camX, p.y, p.r, 1);
      } else if (p.kind === 'debris') {
        ctx.fillStyle = '#4a4038';
        ctx.fillRect(p.x - camX, p.y, p.r, p.r * 0.6);
      } else if (p.kind === 'rain') {
        ctx.strokeStyle = 'rgba(180,200,220,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - camX, p.y);
        ctx.lineTo(p.x - camX - 2, p.y + 8);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.kind === 'smoke' ? '#888' : '#9a8a70';
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
