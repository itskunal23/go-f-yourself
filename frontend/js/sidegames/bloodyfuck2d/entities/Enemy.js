import { CFG } from '../config.js';
import { rand } from '../utils.js';

/**
 * Enemy fighter — approach, strike, react to hits.
 */
export class Enemy {
  /** @param {import('../physics/PhysicsWorld.js').PhysicsWorld} physics @param {number} x */
  constructor(physics, x) {
    this.physics = physics;
    this.body = physics.addBody(x, CFG.groundY - 50, CFG.enemy.w, CFG.enemy.h, { label: 'enemy' });
    this.hp = CFG.enemy.hp;
    this.facing = -1;
    this.vx = 0;
    this.x = x;
    this.y = CFG.groundY - 50;
    this.attackT = 0;
    this.attackCd = rand(0.5, 1.2);
    this.hitStagger = 0;
    this.animT = rand(0, 3);
    this.dead = false;
    this.state = 'idle';
    this._hitPlayer = false;
  }

  /** @param {import('../entities/Player.js').Player} player @param {number} dt */
  update(player, dt) {
    if (this.dead) return;
    const { Body } = this.physics.M;
    const b = this.body;
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    this.facing = dx >= 0 ? 1 : -1;

    if (this.hitStagger > 0) {
      this.hitStagger -= dt;
      Body.setVelocity(b, { x: -this.facing * 2, y: b.velocity.y });
    } else if (dist > 42) {
      const spd = CFG.enemy.speed * (1 + rand(-0.05, 0.05));
      Body.setVelocity(b, { x: this.facing * spd * 3.2, y: b.velocity.y });
      this.state = 'walk';
    } else {
      Body.setVelocity(b, { x: 0, y: b.velocity.y });
      this.state = 'attack';
      this.attackCd -= dt;
      if (this.attackCd <= 0 && !player.dead) {
        this.attackT = 0.18;
        this.attackCd = rand(0.9, 1.6);
        this._hitPlayer = false;
      }
    }

    if (this.attackT > 0) this.attackT -= dt;
    this.vx = b.velocity.x;
    this.x = b.position.x;
    this.y = b.position.y;
    this.animT += dt;
  }

  /** @param {number} dmg @param {number} knockDir */
  hurt(dmg, knockDir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitStagger = 0.2;
    this.physics.M.Body.applyForce(this.body, this.body.position, {
      x: knockDir * 0.015,
      y: -0.004,
    });
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  /** @returns {{ x: number, y: number, r: number }|null} */
  attackHitbox() {
    if (this.attackT <= 0 || this.attackT > 0.12) return null;
    return { x: this.x + this.facing * 28, y: this.y - 8, r: 20 };
  }
}
