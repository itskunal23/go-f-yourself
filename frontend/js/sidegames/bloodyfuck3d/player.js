// ===========================================================================
//  player.js — first-person controller. Yaw/pitch from look input, planar
//  movement relative to facing, sprint w/ stamina, collision vs world.
//  Light camera effects only (head-bob + recoil kick + hurt shake).
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';
import { PLAYER } from './config.js';

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0, PLAYER.height, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.hp = PLAYER.maxHp;
    this.stamina = PLAYER.maxStamina;
    this.alive = true;
    this._bob = 0; this._kick = 0; this._shake = 0;
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this.recoil = 0;
  }

  addRecoil(amt) { this._kick = Math.min(0.25, this._kick + amt); this.pitch = Math.max(-PLAYER.pitchClamp, this.pitch - amt * 0.4); }
  hurt(dmg) {
    if (!this.alive) return;
    this.hp -= dmg; this._shake = Math.min(0.5, this._shake + dmg * 0.01);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  update(dt, input) {
    const s = input.state;
    // --- look ---
    if (input.touch) {
      this.yaw -= s.look.dx * 0.004;
      this.pitch -= s.look.dy * 0.004;
    } else {
      this.yaw -= s.look.dx * PLAYER.mouseSens;
      this.pitch -= s.look.dy * PLAYER.mouseSens;
    }
    this.pitch = Math.max(-PLAYER.pitchClamp, Math.min(PLAYER.pitchClamp, this.pitch));

    // --- movement basis (planar) ---
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const sprinting = s.sprint && this.stamina > 1 && s.move.y > 0.1;
    const maxSpeed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    this.stamina += (sprinting ? -PLAYER.staminaDrain : PLAYER.staminaRegen) * dt;
    this.stamina = Math.max(0, Math.min(PLAYER.maxStamina, this.stamina));

    // desired velocity
    this._tmp.set(0, 0, 0)
      .addScaledVector(this._fwd, s.move.y)
      .addScaledVector(this._right, s.move.x);
    if (this._tmp.lengthSq() > 1) this._tmp.normalize();
    this._tmp.multiplyScalar(maxSpeed);

    // accelerate toward desired (snappy, low input lag)
    const a = PLAYER.accel * dt;
    this.vel.x += (this._tmp.x - this.vel.x) * Math.min(1, a / maxSpeed * 1.4 || 1);
    this.vel.z += (this._tmp.z - this.vel.z) * Math.min(1, a / maxSpeed * 1.4 || 1);

    // integrate + collide
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.world.clamp(this.pos, PLAYER.radius);
    this.world.resolveObstacles(this.pos, PLAYER.radius);

    // --- camera effects (light) ---
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this._bob += dt * speed * 1.6;
    this._kick *= Math.max(0, 1 - dt * 9);
    this._shake *= Math.max(0, 1 - dt * 6);
    const bobY = Math.sin(this._bob) * 0.035 * Math.min(1, speed / PLAYER.walkSpeed);
    const shakeX = (Math.random() - 0.5) * this._shake;
    const shakeY = (Math.random() - 0.5) * this._shake;

    this.camera.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + shakeX;
    this.camera.rotation.x = this.pitch - this._kick + shakeY;

    this.recoil = this._kick;
  }

  /** Forward direction for shooting (includes pitch). */
  getAimDir(out) {
    out.set(0, 0, -1).applyEuler(this.camera.rotation);
    return out;
  }
  getEye(out) { return out.copy(this.camera.position); }
}
