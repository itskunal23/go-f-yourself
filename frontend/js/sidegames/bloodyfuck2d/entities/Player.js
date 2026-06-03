import { CFG } from '../config.js';
import { clamp } from '../utils.js';

/**
 * Player entity — momentum, weight, combat states.
 */
export class Player {
  /** @param {import('../physics/PhysicsWorld.js').PhysicsWorld} physics */
  constructor(physics) {
    this.physics = physics;
    this.body = physics.addBody(200, CFG.groundY - 50, CFG.player.w, CFG.player.h, { label: 'player' });
    this.hp = CFG.player.maxHp;
    this.facing = 1;
    this.vx = 0;
    this.x = 200;
    this.y = CFG.groundY - 50;
    this.onGround = false;
    this.attackT = 0;
    this.attackCd = 0;
    this.heavyCd = 0;
    this.hitStagger = 0;
    this.animT = 0;
    this.dead = false;
    this.combo = 0;
    this.comboTimer = 0;
  }

  /** @param {import('../input/Input.js').Input} input @param {number} dt */
  update(input, dt) {
    if (this.dead) return;
    const { Body, Vector } = this.physics.M;
    const b = this.body;
    this.onGround = b.position.y >= CFG.groundY - 52;

    let move = input.axis * CFG.player.speed;
    if (Math.abs(move) > 0.1) this.facing = move > 0 ? 1 : -1;

    Body.setVelocity(b, {
      x: move * 4.5,
      y: b.velocity.y,
    });

    if (input.jump && this.onGround) {
      Body.setVelocity(b, { x: b.velocity.x, y: CFG.player.jump });
    }

    this.vx = b.velocity.x;
    this.x = b.position.x;
    this.y = b.position.y;
    this.animT += dt;

    if (this.attackT > 0) this.attackT -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.heavyCd > 0) this.heavyCd -= dt;
    if (this.hitStagger > 0) this.hitStagger -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  /** @returns {'light'|'heavy'|null} */
  tryAttack(heavy) {
    if (this.dead || this.attackT > 0) return null;
    if (heavy && this.heavyCd > 0) return null;
    if (!heavy && this.attackCd > 0) return null;
    this.attackT = heavy ? 0.22 : 0.14;
    if (heavy) this.heavyCd = 0.55;
    else this.attackCd = 0.28;
    return heavy ? 'heavy' : 'light';
  }

  /** @param {number} dmg */
  hurt(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitStagger = 0.25;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  /** @returns {{ x: number, y: number, r: number }} */
  hitbox() {
    const reach = this.attackT > 0.1 ? 48 : 0;
    return {
      x: this.x + this.facing * (18 + reach * 0.5),
      y: this.y - 10,
      r: 22 + reach,
    };
  }
}
