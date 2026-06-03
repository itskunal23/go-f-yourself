// ===========================================================================
//  enemies.js — pooled low-poly humanoid enemies with simple AI + animation.
//   Types: melee (Thug), runner (Runner), heavy (Brute), boss (Warden).
//   AI: seek player + separation + obstacle avoidance; attack on cooldown.
//   Anim: procedural walk (limb swing) + attack lunge; hit-flash + knockback.
//   All meshes are pre-pooled; spawning never allocates.
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';
import { ENEMIES, MAX_ENEMIES } from './config.js';
import { makeHumanoid } from './assets.js';

export class EnemyManager {
  constructor(scene, world, cap = MAX_ENEMIES) {
    this.scene = scene;
    this.world = world;
    this.cap = cap;
    this.list = [];
    this.onKill = null;     // (enemy, byHeadshot) => void
    this.onAttack = null;   // (enemy) => void   (for audio)
    this.onHit = null;      // (enemy, head) => void  (hit-marker / audio)

    // pre-pool humanoids
    this.pool = [];
    for (let i = 0; i < cap; i++) {
      const g = makeHumanoid(0xffffff);
      g.visible = false;
      scene.add(g);
      this.pool.push({
        group: g, alive: false, type: null, cfg: null,
        hp: 0, maxHp: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        knock: new THREE.Vector3(), attackTimer: 0, anim: Math.random() * 6.28,
        flash: 0, lunge: 0, scale: 1,
      });
    }
    // scratch vectors (no per-frame allocation)
    this._toP = new THREE.Vector3();
    this._sep = new THREE.Vector3();
    this._next = new THREE.Vector3();
    this._oc = new THREE.Vector3();
  }

  get aliveCount() { let n = 0; for (const e of this.list) if (e.alive) n++; return n; }

  spawn(type, pos) {
    const e = this.pool.find((x) => !x.alive);
    if (!e) return null;
    const cfg = ENEMIES[type];
    e.alive = true; e.type = type; e.cfg = cfg;
    e.hp = e.maxHp = cfg.hp;
    e.scale = cfg.scale;
    e.pos.copy(pos); e.pos.y = 0;
    e.vel.set(0, 0, 0); e.knock.set(0, 0, 0);
    e.attackTimer = 0; e.flash = 0; e.lunge = 0;
    const g = e.group;
    g.visible = true;
    g.scale.setScalar(cfg.scale);
    g.position.copy(e.pos);
    // recolor
    const m = g.userData.mats[0];
    m.color.setHex(cfg.color); m.emissive.setHex(0x000000);
    if (!this.list.includes(e)) this.list.push(e);
    return e;
  }

  /** ray-sphere test against torso/head; returns {enemy, dist, head} or null. */
  raycast(origin, dir, maxDist) {
    let best = null, bestT = maxDist;
    for (const e of this.list) {
      if (!e.alive) continue;
      // two spheres: body and head
      for (let part = 0; part < 2; part++) {
        const cy = (part === 0 ? 1.05 : 1.62) * e.scale;
        const r = (part === 0 ? 0.55 : 0.32) * e.scale;
        const ox = origin.x - e.pos.x, oy = origin.y - (e.pos.y + cy), oz = origin.z - e.pos.z;
        const b = ox * dir.x + oy * dir.y + oz * dir.z;
        const c = ox * ox + oy * oy + oz * oz - r * r;
        const disc = b * b - c;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0.1 && t < bestT) { bestT = t; best = { enemy: e, dist: t, head: part === 1 }; }
      }
    }
    return best;
  }

  /** melee cone test; returns array of enemies hit. */
  meleeHits(origin, dir, range, arc) {
    const out = [];
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.6 * e.scale) continue;
      const dot = (dx / (d || 1)) * dir.x + (dz / (d || 1)) * dir.z;
      if (dot >= Math.cos(arc)) out.push(e);
    }
    return out;
  }

  damage(e, dmg, knockDir, knockAmt, head) {
    if (!e.alive) return;
    e.hp -= dmg * (head ? 1.8 : 1);
    e.flash = 0.12;
    const kr = e.cfg.knockResist || 1;
    if (knockDir) { e.knock.x += knockDir.x * knockAmt / kr; e.knock.z += knockDir.z * knockAmt / kr; }
    this.onHit?.(e, head);
    if (e.hp <= 0) this._kill(e, head);
  }

  _kill(e, head) {
    e.alive = false;
    e.group.visible = false;
    this.onKill?.(e, head);
  }

  update(dt, player) {
    const pp = player.pos;
    for (const e of this.list) {
      if (!e.alive) continue;
      const cfg = e.cfg;

      // seek player
      this._toP.set(pp.x - e.pos.x, 0, pp.z - e.pos.z);
      const distToP = this._toP.length() || 0.0001;
      this._toP.multiplyScalar(1 / distToP);

      // separation from neighbors (avoid clumping)
      this._sep.set(0, 0, 0);
      for (const o of this.list) {
        if (o === e || !o.alive) continue;
        const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0 && d2 < 2.2) { const inv = 1 / Math.sqrt(d2); this._sep.x += dx * inv; this._sep.z += dz * inv; }
      }

      // steering = seek + separation
      const steerX = this._toP.x + this._sep.x * 0.7;
      const steerZ = this._toP.z + this._sep.z * 0.7;
      const sl = Math.hypot(steerX, steerZ) || 1;

      const attacking = e.lunge > 0;
      const moveSpeed = attacking ? cfg.speed * 0.2 : cfg.speed;
      // proposed next position
      e.vel.x = (steerX / sl) * moveSpeed;
      e.vel.z = (steerZ / sl) * moveSpeed;

      this._next.set(e.pos.x + (e.vel.x + e.knock.x) * dt, 0, e.pos.z + (e.vel.z + e.knock.z) * dt);
      this.world.clamp(this._next, 0.4 * e.scale);
      this.world.resolveObstacles(this._next, 0.5 * e.scale);
      e.pos.x = this._next.x; e.pos.z = this._next.z;

      // knockback decay
      e.knock.multiplyScalar(Math.max(0, 1 - dt * 6));

      // attack when in reach
      e.attackTimer -= dt * 1000;
      if (distToP <= cfg.reach + 0.4 && e.attackTimer <= 0) {
        e.attackTimer = cfg.attackCd;
        e.lunge = 0.28;
        this.onAttack?.(e);
        if (player.alive) player.hurt(cfg.dmg);
      }
      if (e.lunge > 0) e.lunge -= dt;

      // hit flash decay
      if (e.flash > 0) {
        e.flash -= dt;
        const m = e.group.userData.mats[0];
        m.emissive.setHex(e.flash > 0 ? 0xff3030 : 0x000000);
        m.emissiveIntensity = Math.max(0, e.flash * 8);
      }

      // ---- transform + animation ----
      const g = e.group;
      g.position.set(e.pos.x, e.pos.y, e.pos.z);
      // face player
      g.rotation.y = Math.atan2(pp.x - e.pos.x, pp.z - e.pos.z);
      // walk swing
      const moving = Math.hypot(e.vel.x, e.vel.z);
      e.anim += dt * (4 + moving * 1.4);
      const swing = Math.sin(e.anim) * Math.min(0.9, 0.3 + moving * 0.12);
      const u = g.userData;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      const armSwing = attacking ? -1.2 : -swing * 0.6;
      u.armL.rotation.x = armSwing; u.armR.rotation.x = armSwing;
      u.head.rotation.x = attacking ? 0.3 : 0;
    }
  }

  reset() {
    for (const e of this.list) { e.alive = false; e.group.visible = false; }
    this.list.length = 0;
  }
  dispose() {
    for (const e of this.pool) {
      e.group.parent?.remove(e.group);
      for (const m of e.group.userData.mats) m.dispose();
    }
  }
}
