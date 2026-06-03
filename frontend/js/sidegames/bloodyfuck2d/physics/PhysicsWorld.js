import { CFG } from '../config.js';

/**
 * Matter.js world — player, enemies, ground only. Visual FX stay fake.
 */
export class PhysicsWorld {
  /** @param {typeof Matter} Matter */
  constructor(Matter) {
    this.M = Matter;
    const { Engine, World, Bodies, Composite } = Matter;
    this.engine = Engine.create({ gravity: { x: 0, y: CFG.gravity } });
    this.world = this.engine.world;

    this.ground = Bodies.rectangle(CFG.worldW / 2, CFG.groundY + 40, CFG.worldW, 80, {
      isStatic: true,
      friction: 0.9,
      label: 'ground',
    });
    this.leftWall = Bodies.rectangle(-20, CFG.worldH / 2, 40, CFG.worldH, { isStatic: true });
    this.rightWall = Bodies.rectangle(CFG.worldW + 20, CFG.worldH / 2, 40, CFG.worldH, { isStatic: true });

    // destructible props — few static boxes
    this.props = [];
    for (let i = 0; i < 6; i++) {
      const x = 400 + i * 280 + Math.random() * 80;
      const prop = Bodies.rectangle(x, CFG.groundY - 30, 50, 60, {
        isStatic: true,
        label: 'prop',
        render: { health: 2 },
      });
      this.props.push(prop);
    }

    World.add(this.world, [this.ground, this.leftWall, this.rightWall, ...this.props]);
    this.bodies = [];
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {object} opts */
  addBody(x, y, w, h, opts = {}) {
    const body = this.M.Bodies.rectangle(x, y, w, h, {
      friction: 0.02,
      frictionAir: 0.02,
      restitution: 0,
      ...opts,
    });
    this.M.World.add(this.world, body);
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    this.M.World.remove(this.world, body);
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  /** @param {number} dt */
  step(dt) {
    this.M.Engine.update(this.engine, dt * 1000);
  }

  /** @param {import('matter-js').Body} a @param {import('matter-js').Body} b */
  touching(a, b, pad = 8) {
    if (!a || !b) return false;
    return Math.abs(a.position.x - b.position.x) < (a.bounds.max.x - a.bounds.min.x) / 2 + (b.bounds.max.x - b.bounds.min.x) / 2 + pad
      && Math.abs(a.position.y - b.position.y) < 60;
  }
}
