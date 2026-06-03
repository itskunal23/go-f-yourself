import { TAU } from './physics.js';

const PLAYER_COUNTS = [2, 4, 6, 8, 10, 12];
const GRADIENTS = [
  ['#ff6b9d', '#c44dff'],
  ['#19e6ff', '#0066ff'],
  ['#ffd23f', '#ff6b35'],
  ['#56ffa8', '#00c896'],
  ['#ff2d95', '#9b59ff'],
  ['#ff4757', '#ffa502'],
  ['#70a1ff', '#5352ed'],
  ['#ff9ff3', '#f368e0'],
  ['#7bed9f', '#2ed573'],
  ['#ffa502', '#ff6348'],
  ['#1e90ff', '#00d2d3'],
  ['#a29bfe', '#6c5ce7'],
];

/** Canvas 2D renderer — table, players, bottle, effects. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.width = 0;
    this.height = 0;
    this.cx = 0;
    this.cy = 0;
    this.tableRadius = 0;
    this.bottleLength = 0;
    this.time = 0;
    this.spotlight = 0;
    this.selectedIndex = -1;
    this.motionBlur = 0;
    this.tableScale = 1;
    this.bgOrbs = [];
    this.initBgOrbs();
  }

  initBgOrbs() {
    for (let i = 0; i < 5; i++) {
      this.bgOrbs.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.15 + Math.random() * 0.25,
        hue: Math.random() * 360,
        speed: 0.0002 + Math.random() * 0.0004,
        phase: Math.random() * TAU,
      });
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = w / 2;
    this.cy = h * 0.46;
    this.tableRadius = Math.min(w, h) * 0.36;
    this.bottleLength = this.tableRadius * 0.55;
  }

  setSpotlight(v) {
    this.spotlight = v;
  }

  setSelectedIndex(i) {
    this.selectedIndex = i;
  }

  setMotionBlur(v) {
    this.motionBlur = Math.min(1, v);
  }

  setTableScale(s) {
    this.tableScale = s;
  }

  /** Full frame render */
  render(state) {
    const { players, physics, spinnerIndex, phase, drunkMap } = state;
    this.time = performance.now() * 0.001;
    const ctx = this.ctx;
    const speed = Math.abs(physics.angularVelocity || 0);

    this.setMotionBlur(Math.min(1, speed * 6));

    this.drawBackground(ctx);
    this.drawTable(ctx);

    if (players?.length) {
      this.drawPlayers(ctx, players, spinnerIndex, drunkMap);
    }

    const wobble = physics.getWobble?.(speed) ?? 0;
    this.drawBottle(ctx, physics.angle + wobble, speed);

    if (phase === 'reveal' && this.selectedIndex >= 0) {
      this.drawWinnerSpotlight(ctx, players, this.selectedIndex);
    }
  }

  drawBackground(ctx) {
    const w = this.width;
    const h = this.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0a14');
    g.addColorStop(0.5, '#0d0d1a');
    g.addColorStop(1, '#080810');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (const orb of this.bgOrbs) {
      orb.phase += orb.speed * 60;
      const ox = (orb.x + Math.sin(orb.phase) * 0.08) * w;
      const oy = (orb.y + Math.cos(orb.phase * 0.7) * 0.06) * h;
      const r = orb.r * Math.min(w, h);
      const rad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      rad.addColorStop(0, `hsla(${orb.hue}, 80%, 55%, 0.12)`);
      rad.addColorStop(1, 'transparent');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawTable(ctx) {
    const { cx, cy, tableRadius, tableScale, time } = this;
    const r = tableRadius * tableScale;
    const pulse = 1 + Math.sin(time * 1.2) * 0.008;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    const shadow = ctx.createRadialGradient(0, r * 0.3, r * 0.2, 0, 0, r * 1.3);
    shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
    shadow.addColorStop(1, 'transparent');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 1.1, r * 0.35, 0, 0, TAU);
    ctx.fill();

    const outer = ctx.createRadialGradient(0, -r * 0.1, r * 0.1, 0, 0, r);
    outer.addColorStop(0, 'rgba(80, 60, 120, 0.45)');
    outer.addColorStop(0.6, 'rgba(30, 25, 50, 0.85)');
    outer.addColorStop(1, 'rgba(15, 12, 28, 0.95)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.35 + i * 0.22), 0, TAU);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
    glow.addColorStop(0, `rgba(255, 100, 180, ${0.06 + Math.sin(time * 2) * 0.02})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawPlayers(ctx, players, spinnerIndex, drunkMap = {}) {
    const n = players.length;
    const seatR = this.tableRadius * 1.08;
    const avatarR = Math.max(22, Math.min(34, 280 / n));

    for (let i = 0; i < n; i++) {
      const angle = (TAU / n) * i - Math.PI / 2;
      const px = this.cx + Math.cos(angle) * seatR;
      const py = this.cy + Math.sin(angle) * seatR;
      const p = players[i];
      const isSpinner = i === spinnerIndex;
      const isSelected = i === this.selectedIndex;
      const scale = isSelected ? 1 + this.spotlight * 0.45 : isSpinner ? 1.08 : 1;
      const glowAlpha = isSelected ? 0.6 + this.spotlight * 0.4 : isSpinner ? 0.35 : 0.15;
      const drunk = drunkMap[p.id];

      this.drawAvatar(ctx, px, py, avatarR * scale, p, i, glowAlpha, isSelected, drunk);
    }
  }

  drawAvatar(ctx, x, y, r, player, idx, glowAlpha, selected, drunk) {
    const [c1, c2] = GRADIENTS[idx % GRADIENTS.length];
    const pulse = selected ? 1 + Math.sin(this.time * 6) * 0.06 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);

    const glowR = r * 2.2;
    const glow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, glowR);
    glow.addColorStop(0, this.hexAlpha(c1, glowAlpha));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, TAU);
    ctx.fill();

    const border = ctx.createLinearGradient(-r, -r, r, r);
    border.addColorStop(0, c1);
    border.addColorStop(1, c2);
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();

    if (player.avatar) {
      ctx.drawImage(player.avatar, -r, -r, r * 2, r * 2);
    } else {
      const bg = ctx.createLinearGradient(-r, -r, r, r);
      bg.addColorStop(0, c1);
      bg.addColorStop(1, c2);
      ctx.fillStyle = bg;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${r}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((player.name || '?')[0].toUpperCase(), 0, 2);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `600 ${Math.max(10, r * 0.38)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const name = player.name?.length > 10 ? player.name.slice(0, 9) + '…' : player.name;
    ctx.fillText(name || 'Player', 0, r + 6);

    if (drunk) {
      const meterY = r + 22;
      const meterW = r * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(-meterW / 2, meterY, meterW, 5, 3);
      ctx.fill();
      ctx.fillStyle = drunk.color || '#ffd23f';
      ctx.beginPath();
      ctx.roundRect(-meterW / 2, meterY, meterW * Math.min(1, drunk.level / 10), 5, 3);
      ctx.fill();
      ctx.font = `${Math.max(9, r * 0.32)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(`${drunk.emoji} ${drunk.level}/10`, 0, meterY + 8);
    }

    ctx.restore();
  }

  drawBottle(ctx, angle, speed) {
    const { cx, cy, bottleLength, motionBlur } = this;
    const len = bottleLength;

    ctx.save();
    ctx.translate(cx, cy);

    // Shadow slides on table as bottle spins
    const shadowDist = 6 + speed * 22;
    const shadowStretch = 1 + speed * 0.6;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(0,0,0,${0.22 + Math.min(0.35, speed * 1.2)})`;
    ctx.beginPath();
    ctx.ellipse(0, shadowDist, len * 0.28 * shadowStretch, len * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Motion blur trails — faster spin = longer streak
    if (motionBlur > 0.04 && speed > 0.01) {
      const steps = Math.floor(4 + motionBlur * 8);
      const trailStep = speed * 0.055 * motionBlur;
      for (let i = steps; i >= 1; i--) {
        const a = angle - Math.sign(speed) * i * trailStep;
        ctx.globalAlpha = 0.06 * (1 - i / (steps + 2));
        this.drawBottleShape(ctx, a, len, 0.9);
      }
      ctx.globalAlpha = 1;
    }

    this.drawBottleShape(ctx, angle, len, 1);
    ctx.restore();
  }

  drawBottleShape(ctx, angle, len, alpha) {
    ctx.save();
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    const h = len * 0.92;
    const bodyW = len * 0.19;

    // --- Glass body path (classic wine/beer bottle silhouette) ---
    const outline = () => {
      ctx.beginPath();
      // base
      ctx.moveTo(-bodyW * 0.55, h * 0.42);
      ctx.bezierCurveTo(-bodyW * 0.72, h * 0.28, -bodyW * 0.78, h * 0.08, -bodyW * 0.62, -h * 0.02);
      ctx.bezierCurveTo(-bodyW * 0.52, -h * 0.12, -bodyW * 0.38, -h * 0.22, -bodyW * 0.22, -h * 0.32);
      // shoulder → neck
      ctx.bezierCurveTo(-bodyW * 0.12, -h * 0.38, -bodyW * 0.08, -h * 0.48, -bodyW * 0.07, -h * 0.58);
      ctx.lineTo(-bodyW * 0.07, -h * 0.72);
      // cork lip
      ctx.lineTo(-bodyW * 0.14, -h * 0.76);
      ctx.lineTo(-bodyW * 0.14, -h * 0.82);
      ctx.lineTo(bodyW * 0.14, -h * 0.82);
      ctx.lineTo(bodyW * 0.14, -h * 0.76);
      ctx.lineTo(bodyW * 0.07, -h * 0.72);
      ctx.lineTo(bodyW * 0.07, -h * 0.58);
      ctx.bezierCurveTo(bodyW * 0.08, -h * 0.48, bodyW * 0.12, -h * 0.38, bodyW * 0.22, -h * 0.32);
      ctx.bezierCurveTo(bodyW * 0.38, -h * 0.22, bodyW * 0.52, -h * 0.12, bodyW * 0.62, -h * 0.02);
      ctx.bezierCurveTo(bodyW * 0.78, h * 0.08, bodyW * 0.72, h * 0.28, bodyW * 0.55, h * 0.42);
      ctx.closePath();
    };

    // Glass fill — dark green liquor bottle
    const glassGrad = ctx.createLinearGradient(-bodyW, -h * 0.5, bodyW, h * 0.5);
    glassGrad.addColorStop(0, '#1a5c32');
    glassGrad.addColorStop(0.25, '#247a42');
    glassGrad.addColorStop(0.5, '#1e6b38');
    glassGrad.addColorStop(0.75, '#134428');
    glassGrad.addColorStop(1, '#0a2818');
    outline();
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Liquid level inside (sloshes visually via highlight angle)
    ctx.save();
    outline();
    ctx.clip();
    const liquidGrad = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.42);
    liquidGrad.addColorStop(0, 'rgba(180, 140, 60, 0.55)');
    liquidGrad.addColorStop(1, 'rgba(120, 80, 30, 0.75)');
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(-bodyW, h * 0.02, bodyW * 2, h * 0.4);
    ctx.restore();

    // Main glass highlight (specular)
    ctx.save();
    outline();
    ctx.clip();
    const spec = ctx.createLinearGradient(-bodyW * 0.5, -h * 0.4, bodyW * 0.1, h * 0.3);
    spec.addColorStop(0, 'rgba(255,255,255,0.38)');
    spec.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    spec.addColorStop(1, 'transparent');
    ctx.fillStyle = spec;
    ctx.fillRect(-bodyW, -h * 0.85, bodyW * 0.55, h * 1.7);
    // Secondary thin highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bodyW * 0.15, -h * 0.25, bodyW * 0.08, h * 0.55);
    ctx.restore();

    // Foil collar on neck
    ctx.fillStyle = '#8b1a1a';
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.18, -h * 0.58);
    ctx.lineTo(-bodyW * 0.2, -h * 0.72);
    ctx.lineTo(bodyW * 0.2, -h * 0.72);
    ctx.lineTo(bodyW * 0.18, -h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,100,0.25)';
    ctx.fillRect(-bodyW * 0.2, -h * 0.66, bodyW * 0.4, h * 0.04);

    // Cork
    const corkGrad = ctx.createLinearGradient(-bodyW * 0.12, -h * 0.82, bodyW * 0.12, -h * 0.95);
    corkGrad.addColorStop(0, '#c4a574');
    corkGrad.addColorStop(1, '#8b6914');
    ctx.fillStyle = corkGrad;
    ctx.beginPath();
    ctx.roundRect(-bodyW * 0.13, -h * 0.88, bodyW * 0.26, h * 0.08, 2);
    ctx.fill();

    // Paper label
    ctx.fillStyle = 'rgba(245, 235, 210, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-bodyW * 0.42, -h * 0.08, bodyW * 0.84, h * 0.28, 3);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${Math.max(7, bodyW * 0.38)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', 0, h * 0.02);
    ctx.font = `${Math.max(5, bodyW * 0.22)}px Georgia, serif`;
    ctx.fillStyle = '#555';
    ctx.fillText('Est. 2024', 0, h * 0.12);

    // Glass edge stroke
    outline();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Punt (base indentation hint)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.4, bodyW * 0.25, h * 0.04, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  drawWinnerSpotlight(ctx, players, idx) {
    const n = players.length;
    const angle = (TAU / n) * idx - Math.PI / 2;
    const seatR = this.tableRadius * 1.08;
    const px = this.cx + Math.cos(angle) * seatR;
    const py = this.cy + Math.sin(angle) * seatR;

    const beam = ctx.createRadialGradient(px, py, 0, this.cx, this.cy, this.tableRadius * 1.5);
    beam.addColorStop(0, `rgba(255, 220, 100, ${0.15 * this.spotlight})`);
    beam.addColorStop(0.5, `rgba(255, 100, 180, ${0.06 * this.spotlight})`);
    beam.addColorStop(1, 'transparent');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.arc(this.cx, this.cy, this.tableRadius * 1.5, angle - 0.4, angle + 0.4);
    ctx.closePath();
    ctx.fill();
  }

  hexAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  /** Hit test — is point on bottle? */
  hitTestBottle(px, py, angle) {
    const dx = px - this.cx;
    const dy = py - this.cy;
    const local = Math.atan2(dy, dx) - angle;
    const dist = Math.hypot(dx, dy);
    const along = Math.cos(local) * dist;
    const perp = Math.abs(Math.sin(local) * dist);
    return along > -this.bottleLength * 0.15 && along < this.bottleLength * 0.48 && perp < this.bottleLength * 0.14;
  }
}

export { PLAYER_COUNTS, GRADIENTS };
