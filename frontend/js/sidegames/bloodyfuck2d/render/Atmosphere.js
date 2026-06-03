import { rand } from '../utils.js';
import { CFG } from '../config.js';

/**
 * Rain, fog, film grain, parallax city backdrop.
 */
export class Atmosphere {
  /** @param {import('../vfx/ParticlePool.js').ParticlePool} particles */
  constructor(particles) {
    this.particles = particles;
    this.rainTimer = 0;
    this.fogOffset = 0;
    this.grainCanvas = document.createElement('canvas');
    this.grainCanvas.width = 128;
    this.grainCanvas.height = 128;
    this._buildGrain();
  }

  _buildGrain() {
    const c = this.grainCanvas.getContext('2d');
    const img = c.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand(0, 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 28;
    }
    c.putImageData(img, 0, 0);
  }

  /** @param {number} dt @param {number} camX */
  update(dt, camX) {
    this.fogOffset += dt * 12;
    this.rainTimer += dt;
    if (this.rainTimer > 0.025) {
      this.rainTimer = 0;
      for (let i = 0; i < 3; i++) {
        this.particles.emit({
          x: camX + rand(0, 900),
          y: rand(-20, 400),
          vx: -2,
          vy: 14,
          life: rand(0.4, 0.9),
          kind: 'rain',
          r: 1,
        });
      }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} W @param {number} H @param {number} camX @param {number} t */
  drawBackdrop(ctx, W, H, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0c12');
    g.addColorStop(0.55, '#141820');
    g.addColorStop(1, '#1a1410');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // parallax silhouettes
    ctx.fillStyle = '#0d1018';
    for (let layer = 0; layer < 3; layer++) {
      const par = 0.15 + layer * 0.12;
      const bx = -((camX * par) % 400);
      ctx.globalAlpha = 0.35 + layer * 0.15;
      for (let i = -1; i < 4; i++) {
        const x = bx + i * 400;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.55);
        ctx.lineTo(x + 80, H * 0.35);
        ctx.lineTo(x + 160, H * 0.5);
        ctx.lineTo(x + 240, H * 0.3);
        ctx.lineTo(x + 320, H * 0.55);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // wet ground reflection band
    const rg = ctx.createLinearGradient(0, CFG.groundY - 80, 0, H);
    rg.addColorStop(0, 'rgba(20,24,32,0)');
    rg.addColorStop(1, 'rgba(30,35,45,0.85)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, CFG.groundY - 80, W, H);
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} W @param {number} H */
  drawFog(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#8899aa';
    for (let i = 0; i < 3; i++) {
      const y = H * 0.35 + i * 40 + Math.sin(this.fogOffset * 0.02 + i) * 10;
      ctx.fillRect(-20, y, W + 40, 60);
    }
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} W @param {number} H */
  drawGrain(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(this.grainCanvas, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
