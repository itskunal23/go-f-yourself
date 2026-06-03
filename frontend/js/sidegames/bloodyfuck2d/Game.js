import gsap from '/vendor/gsap/index.js';
import { CFG } from './config.js';
import { loadMatter, clamp } from './utils.js';
import { Input } from './input/Input.js';
import { ParticlePool } from './vfx/ParticlePool.js';
import { AudioDirector } from './audio/AudioDirector.js';
import { CinematicDirector } from './director/CinematicDirector.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { Atmosphere } from './render/Atmosphere.js';
import { Renderer } from './render/Renderer.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';

/**
 * Bloody Fuck — cinematic 2D action (Canvas + Matter.js + GSAP + Web Audio).
 */
export class BloodyFuckGame {
  /** @param {HTMLElement} mount @param {object} [opts] */
  constructor(mount, opts = {}) {
    this.mount = mount;
    this.opts = opts;
    this.running = false;
    this.score = 0;
    this.wave = 1;
    this.spawnTimer = 0;
    this.t = 0;
    this._last = 0;
    this.enemies = [];
    this.destructProps = [];

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bf2d-canvas';
    mount.appendChild(this.canvas);

    this.hud = document.createElement('div');
    this.hud.className = 'bf2d-hud';
    this.hud.innerHTML = '<span class="bf2d-hint">A/D move · Space jump · J punch · K heavy · tap right side to fight</span>';
    mount.appendChild(this.hud);
  }

  async init() {
    const Matter = await loadMatter();
    this.particles = new ParticlePool(CFG.maxParticles);
    this.audio = new AudioDirector();
    await this.audio.init();
    this.director = new CinematicDirector();
    this.physics = new PhysicsWorld(Matter);
    this.destructProps = this.physics.props.map((p) => ({ body: p, health: 2 }));
    this.atmosphere = new Atmosphere(this.particles);
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);
    this.player = new Player(this.physics);

    this._resize = this._resize.bind(this);
    this._loop = this._loop.bind(this);
    this._ro = new ResizeObserver(this._resize);
    this._ro.observe(this.mount);
    this._resize();

    this.running = true;
    requestAnimationFrame(this._loop);
  }

  _resize() {
    this.renderer.resize(this.mount.clientWidth || 800, this.mount.clientHeight || 520);
  }

  _spawnEnemy() {
    if (this.enemies.filter((e) => !e.dead).length >= CFG.maxEnemies) return;
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = clamp(this.player.x + side * (420 + Math.random() * 200), 80, CFG.worldW - 80);
    this.enemies.push(new Enemy(this.physics, x));
  }

  _dangerLevel() {
    const near = this.enemies.filter((e) => !e.dead && Math.abs(e.x - this.player.x) < 260).length;
    return clamp(near / 3, 0, 1);
  }

  _combat(dt) {
    const p = this.player;
    if (this.input.attack) {
      const kind = p.tryAttack(this.input.heavy);
      if (kind) {
        this.audio.whoosh(p.facing * 0.3);
        const hb = p.hitbox();
        let hit = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - hb.x, e.y - hb.y) < hb.r + 18) {
            const dmg = kind === 'heavy' ? CFG.player.heavyDmg : CFG.player.punchDmg;
            e.hurt(dmg * (1 + p.combo * 0.05), p.facing);
            hit = true;
            p.combo++;
            p.comboTimer = 2.5;
            this.score += kind === 'heavy' ? 150 : 80;
            this.director.hitStop(kind === 'heavy' ? 0.05 : 0.08, kind === 'heavy' ? 0.09 : 0.05);
            this.director.shakeImpact(kind === 'heavy' ? 1.4 : 0.8);
            this.audio.impact(kind, clamp((e.x - p.x) / 200, -1, 1));
            this.particles.burst(e.x, e.y - 10, 'spark', kind === 'heavy' ? 18 : 10);
            this.particles.burst(e.x, e.y, 'dust', 8);
          }
        }
        if (hit) {
          for (const prop of this.destructProps) {
            if (prop.health <= 0) continue;
            const dx = prop.body.position.x - p.x;
            if (Math.abs(dx) < 70 && Math.abs(prop.body.position.y - p.y) < 80) {
              prop.health--;
              this.audio.creak();
              this.particles.burst(prop.body.position.x, prop.body.position.y - 20, 'debris', 6);
              if (prop.health <= 0) {
                this.physics.M.World.remove(this.physics.world, prop.body);
              }
            }
          }
        }
      }
    }

    for (const e of this.enemies) {
      const atk = e.attackHitbox();
      if (!atk || p.dead || e._hitPlayer) continue;
      if (Math.hypot(p.x - atk.x, p.y - atk.y) < atk.r + 16) {
        e._hitPlayer = true;
        p.hurt(CFG.enemy.dmg);
        this.director.shakeImpact(0.6);
        this.audio.impact('light', clamp((p.x - e.x) / 200, -1, 1));
        this.particles.burst(p.x, p.y - 10, 'dust', 6);
      }
    }

    this.enemies = this.enemies.filter((e) => {
      if (e.dead && e.deadT === undefined) {
        e.deadT = 0;
        this.particles.burst(e.x, e.y, 'smoke', 10);
      }
      if (e.dead) {
        e.deadT += dt;
        return e.deadT < 1.2;
      }
      return true;
    });
  }

  _loop(now) {
    if (!this.running) return;
    const rawDt = Math.min(0.05, (now - (this._last || now)) / 1000);
    this._last = now;

    this.input.update();
    const cam = this.director.getTransform();
    const dt = rawDt * cam.timeScale;
    this.t += dt;

    this.player.update(this.input, dt);
    for (const e of this.enemies) e.update(this.player, dt);

    const danger = this._dangerLevel();
    this.director.setDanger(danger);
    this.director.follow(this.player.x - this.renderer.W * 0.35, 0, dt);

    const speed = Math.abs(this.player.vx);
    if (speed > 0.5 && this.player.onGround) this.audio.footstep('concrete', speed / CFG.player.speed);

    this._combat(dt);
    this.physics.step(dt);
    this.particles.update(dt);
    this.atmosphere.update(dt, this.director.camX);
    this.audio.update(dt, speed, danger);

    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= CFG.enemy.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnEnemy();
      this.wave++;
    }

    const tr = this.director.getTransform();
    this.renderer.frame({
      atmosphere: this.atmosphere,
      particles: this.particles,
      camX: this.director.camX,
      camY: this.director.camY,
      ox: tr.ox,
      oy: tr.oy,
      zoom: tr.zoom,
      flash: tr.flash,
      W: this.renderer.W,
      H: this.renderer.H,
      t: this.t,
      player: this.player,
      enemies: this.enemies,
      props: this.destructProps.map((p) => ({ position: p.body.position, health: p.health })),
      score: this.score,
      combo: this.player.combo,
    });

    if (this.player.dead) {
      this.running = false;
      gsap.delayedCall(0.6, () => this.opts.onGameOver?.(this.score));
      return;
    }

    requestAnimationFrame(this._loop);
  }

  dispose() {
    this.running = false;
    this._ro?.disconnect();
    this.input?.dispose();
    this.audio?.dispose();
    this.canvas.remove();
    this.hud.remove();
  }
}
