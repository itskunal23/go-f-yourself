/** Realistic bottle spin — constant angular deceleration on a rough table surface. */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** rad/s² equivalent (normalized to ~60fps dt units) */
const TABLE_DECEL = 0.0028;
const STOP_OMEGA = 0.00045;

export class BottlePhysics {
  constructor() {
    this.angle = 0;
    this.angularVelocity = 0;
    this.isSpinning = false;
    this.isDragging = false;
    this.lastPointerAngle = 0;
    this.lastPointerTime = 0;
    this.velocitySamples = [];
    this.wobblePhase = 0;
    this.wobbleAmplitude = 0;
    this.tickCallback = null;
    this.lastTickSpeed = 1;
    this.phase = 'idle';

    // Guided spin (predetermined landing)
    this.guideMode = false;
    this.startAngle = 0;
    this.spinTotalAngle = 0;
    this.spinDuration = 0;
    this.spinElapsed = 0;
    this.initialOmega = 0;
    this.deceleration = TABLE_DECEL;
    this.targetStopAngle = null;
    this.fakeOutCount = 0;
    this.maxFakeOuts = 0;
    this.fakeOutAt = 0;
  }

  normalize(a) {
    return ((a % TAU) + TAU) % TAU;
  }

  pointerAngle(cx, cy, px, py) {
    return Math.atan2(py - cy, px - cx);
  }

  startDrag(cx, cy, px, py) {
    this.isDragging = true;
    this.isSpinning = false;
    this.angularVelocity = 0;
    this.guideMode = false;
    this.lastPointerAngle = this.pointerAngle(cx, cy, px, py);
    this.lastPointerTime = performance.now();
    this.velocitySamples = [];
    this.wobbleAmplitude = 0;
    this.targetStopAngle = null;
    this.phase = 'idle';
  }

  updateDrag(cx, cy, px, py) {
    if (!this.isDragging) return;
    const now = performance.now();
    const ptr = this.pointerAngle(cx, cy, px, py);
    let delta = ptr - this.lastPointerAngle;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    this.angle = this.normalize(this.angle + delta);
    this.lastPointerAngle = ptr;
    const dtMs = Math.max(1, now - this.lastPointerTime);
    this.velocitySamples.push(delta / dtMs);
    if (this.velocitySamples.length > 10) this.velocitySamples.shift();
    this.lastPointerTime = now;
  }

  endDrag() {
    if (!this.isDragging) return 0;
    this.isDragging = false;

    const avg =
      this.velocitySamples.length > 0
        ? this.velocitySamples.reduce((a, b) => a + b, 0) / this.velocitySamples.length
        : 0;

    const flick = Math.min(Math.abs(avg) * 18, 0.42);
    const sign = avg >= 0 ? 1 : -1;
    this.angularVelocity = sign * (flick + 0.012 + Math.random() * 0.008);
    this.deceleration = TABLE_DECEL * (0.9 + Math.random() * 0.25);
    this.guideMode = false;
    this.targetStopAngle = null;

    if (Math.abs(this.angularVelocity) > STOP_OMEGA * 2) {
      this.isSpinning = true;
      this.phase = 'fast';
    }
    return this.angularVelocity;
  }

  /** Spin toward a seat with physics-based slowdown (ω₀, constant deceleration). */
  spinToTargetDramatic(seatAngleRad, playerCount, onTick) {
    const extraSpins = (5 + Math.floor(Math.random() * 4)) * TAU;
    const jitter = ((Math.random() - 0.5) * TAU) / Math.max(playerCount, 1) * 0.35;
    const targetFacing = this.normalize(seatAngleRad + jitter);
    const bottleAngle = this.normalize(-targetFacing + Math.PI / 2);
    const current = this.normalize(this.angle);
    let delta = bottleAngle - current;
    if (delta < 0) delta += TAU;

    this.startAngle = this.angle;
    this.spinTotalAngle = extraSpins + delta;
    this.targetStopAngle = this.startAngle + this.spinTotalAngle;

    // 4.5–7.5 s spin at 60fps — feels like a real table bottle
    this.spinDuration = (270 + Math.random() * 180);
    this.deceleration = (2 * this.spinTotalAngle) / (this.spinDuration * this.spinDuration);
    this.initialOmega = this.deceleration * this.spinDuration;
    this.angularVelocity = this.initialOmega;
    this.spinElapsed = 0;
    this.guideMode = true;
    this.isSpinning = true;
    this.phase = 'fast';
    this.tickCallback = onTick;
    this.lastTickSpeed = this.initialOmega;
    this.fakeOutCount = 0;
    this.maxFakeOuts = Math.random() > 0.55 ? 1 : 0;
    this.fakeOutAt = this.spinDuration * (0.72 + Math.random() * 0.12);
  }

  /** Speed → phase label for UI/audio. */
  classifyPhase(speed) {
    if (speed > 0.09) return 'fast';
    if (speed > 0.028) return 'slow';
    if (speed > 0.006) return 'tick';
    return 'final';
  }

  applyFriction(speed, dt) {
    // Slightly higher decel at crawl speed — bottle "grabs" the table
    const crawl = speed < 0.012 ? 1 + (0.012 - speed) * 40 : 1;
    return Math.max(0, speed - this.deceleration * crawl * dt);
  }

  update(dt) {
    if (this.isDragging) {
      return { spinning: false, angle: this.angle, speed: 0, phase: this.phase };
    }

    if (!this.isSpinning && this.wobbleAmplitude <= 0.001) {
      return { spinning: false, angle: this.angle, speed: 0, wobble: 0, phase: 'idle' };
    }

    if (this.isSpinning) {
      const sign = Math.sign(this.angularVelocity) || 1;
      let speed = Math.abs(this.angularVelocity);

      if (this.guideMode) {
        this.spinElapsed += dt;

        // Subtle table bump — brief re-acceleration then keeps slowing
        if (
          this.maxFakeOuts > 0 &&
          this.fakeOutCount < this.maxFakeOuts &&
          this.spinElapsed >= this.fakeOutAt &&
          speed < this.initialOmega * 0.08 &&
          speed > STOP_OMEGA * 4
        ) {
          this.fakeOutCount++;
          this.angularVelocity = sign * (speed + 0.004 + Math.random() * 0.003);
          this.tickCallback?.('fakeout');
          speed = Math.abs(this.angularVelocity);
        }

        const t = this.spinElapsed;
        const traveled = this.initialOmega * t - 0.5 * this.deceleration * t * t;
        speed = Math.max(0, this.initialOmega - this.deceleration * t);

        if (traveled >= this.spinTotalAngle - 0.002 || speed <= STOP_OMEGA || t >= this.spinDuration + 30) {
          this.angle = this.normalize(this.targetStopAngle);
          this.finishStop();
        } else {
          const prevPhase = this.phase;
          this.phase = this.classifyPhase(speed);
          if (prevPhase === 'fast' && this.phase === 'slow') {
            this.tickCallback?.('slow');
          }
          if (prevPhase !== 'tick' && this.phase === 'tick') {
            this.tickCallback?.('tick');
          }
          this.angle = this.normalize(this.startAngle + traveled * sign);
          this.angularVelocity = sign * speed;
          this.lastTickSpeed = speed;
        }
      } else {
        const prevPhase = this.phase;
        const newSpeed = this.applyFriction(speed, dt);
        const avgSpeed = (speed + newSpeed) / 2;
        this.angle = this.normalize(this.angle + sign * avgSpeed * dt);
        this.angularVelocity = sign * newSpeed;
        speed = newSpeed;

        this.phase = this.classifyPhase(speed);
        if (prevPhase === 'fast' && this.phase === 'slow') {
          this.tickCallback?.('slow');
        }
        if (prevPhase !== 'tick' && this.phase === 'tick') {
          this.tickCallback?.('tick');
        }

        if (speed <= STOP_OMEGA) this.finishStop();
      }
    }

    const speed = Math.abs(this.angularVelocity);
    return {
      spinning: this.isSpinning,
      angle: this.angle,
      velocity: this.angularVelocity,
      wobble: this.getWobble(speed),
      speed,
      phase: this.phase,
    };
  }

  finishStop() {
    this.isSpinning = false;
    this.angularVelocity = 0;
    this.guideMode = false;
    this.wobbleAmplitude = 0.035 + Math.random() * 0.03;
    this.wobblePhase = 0;
    if (this.targetStopAngle !== null) {
      this.angle = this.normalize(this.targetStopAngle);
    }
    this.targetStopAngle = null;
    this.phase = 'stopped';
    this.tickCallback?.('stop');
    this.tickCallback = null;
  }

  getWobble(speed = 0) {
    // Idle settle wobble after stop
    if (this.wobbleAmplitude > 0.001) {
      this.wobblePhase += 0.16;
      const damp = Math.max(0, 1 - this.wobblePhase * 0.09);
      if (damp <= 0.01) {
        this.wobbleAmplitude = 0;
        return 0;
      }
      return Math.sin(this.wobblePhase * 3.4) * this.wobbleAmplitude * damp;
    }
    // Micro wobble while crawling — uneven table surface
    if (this.isSpinning && speed > 0.003 && speed < 0.018) {
      return Math.sin(this.wobblePhase * 8) * 0.004 * (speed / 0.018);
    }
    if (this.isSpinning) this.wobblePhase += speed * 2.5;
    return 0;
  }

  getSelectedIndex(playerCount) {
    if (playerCount < 1) return 0;
    const bottlePointsUp = this.normalize(-this.angle + Math.PI / 2);
    const slice = TAU / playerCount;
    return Math.floor((bottlePointsUp + slice / 2) / slice) % playerCount;
  }
}

export { TAU, DEG };
