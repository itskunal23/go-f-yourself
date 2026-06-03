import { CFG } from '../config.js';
import { clamp } from '../utils.js';

/**
 * Canvas renderer — environment, characters, VFX, HUD.
 */
export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 800;
    this.H = 520;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = w;
    this.H = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** @param {object} o */
  frame(o) {
    const {
      atmosphere, particles, camX, camY, ox, oy, zoom, flash, W, H, t,
      player, enemies, props, score, combo,
    } = o;
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2 + ox, -H / 2 + oy);

    atmosphere.drawBackdrop(ctx, W, H, camX, t);

    // ground line
    ctx.strokeStyle = '#2a3038';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, CFG.groundY - camY);
    ctx.lineTo(W + 200, CFG.groundY - camY);
    ctx.stroke();

    // props
    for (const p of props) {
      if (!p.health) continue;
      const x = p.position.x - camX;
      const y = p.position.y - camY - 30;
      ctx.fillStyle = p.health > 1 ? '#3a3530' : '#2a2520';
      ctx.fillRect(x - 25, y, 50, 60);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 25, y + 50, 50, 10);
    }

    for (const e of enemies) this._drawFighter(ctx, e, camX, camY, false);
    if (player) this._drawFighter(ctx, player, camX, camY, true);

    particles.draw(ctx, camX);

    atmosphere.drawFog(ctx, W, H);

    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,240,220,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    atmosphere.drawGrain(ctx, W, H);
    this._hud(ctx, W, score, combo, player?.hp ?? 0);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  _drawFighter(ctx, f, camX, camY, isPlayer) {
    if (f.dead) return;
    const x = f.x - camX;
    const y = f.y - camY;
    const facing = f.facing || 1;
    const lean = clamp(f.vx * 0.015, -0.12, 0.12);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean * facing);
    ctx.scale(facing, 1);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 38, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const stagger = f.hitStagger || 0;
    ctx.translate(stagger * 8, 0);

    // legs
    const walk = Math.sin(f.animT * 12) * 6 * Math.abs(f.vx);
    ctx.fillStyle = isPlayer ? '#1a2030' : '#252018';
    ctx.fillRect(-8 + walk * 0.3, 8, 7, 32);
    ctx.fillRect(2 - walk * 0.3, 8, 7, 32);

    // torso
    ctx.fillStyle = isPlayer ? '#2a3848' : '#3a2828';
    ctx.fillRect(-14, -18, 28, 30);

    // head
    ctx.fillStyle = '#c8a888';
    ctx.beginPath();
    ctx.arc(0, -28, 11, 0, Math.PI * 2);
    ctx.fill();

    // arms / attack pose
    const atk = f.attackT || 0;
    ctx.fillStyle = '#c8a888';
    if (atk > 0) {
      ctx.save();
      ctx.translate(10, -8);
      ctx.rotate(-0.8 - atk * 2);
      ctx.fillRect(0, -3, 22, 6);
      ctx.restore();
    } else {
      ctx.fillRect(8, -6, 18, 5);
    }

    // speed lines when dashing
    if (Math.abs(f.vx) > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-30 - i * 10, -10 + i * 8);
        ctx.lineTo(-50 - i * 10, -10 + i * 8);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  _hud(ctx, W, score, combo, hp) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10, 10, 160, 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(`Score ${score}`, 18, 30);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(combo > 1 ? `x${combo} combo` : '', 18, 46);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(W - 170, 10, 160, 16);
    ctx.fillStyle = hp > 30 ? '#37d67a' : '#ff4444';
    ctx.fillRect(W - 168, 12, (hp / 100) * 156, 12);
  }
}
