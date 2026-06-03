// ===========================================================================
//  weapons.js — weapon handling: melee + hitscan firearms, ammo/reload,
//  weapon swap, recoil, tracers and impact effects. Responsive-first:
//  firing is edge/auto based on fire-rate, no allocations in the loop.
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';
import { WEAPONS, ARENA } from './config.js';

export class WeaponSystem {
  constructor({ player, enemies, blood, sparks, tracers, audio, viewmodel, unlocked }) {
    this.player = player;
    this.enemies = enemies;
    this.blood = blood;
    this.sparks = sparks;
    this.tracers = tracers;
    this.audio = audio;
    this.vm = viewmodel;
    this.unlocked = unlocked.slice();         // array of weapon ids
    this.index = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.ammo = {};
    for (const id of this.unlocked) this.ammo[id] = WEAPONS[id].mag ?? Infinity;
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._pt = new THREE.Vector3();
    this.onShot = null;   // (kill:boolean) for stats/score hooks via enemies.onKill
    this._applyViewmodel();
  }

  get id() { return this.unlocked[this.index]; }
  get def() { return WEAPONS[this.id]; }
  get curAmmo() { return this.ammo[this.id]; }

  unlock(id) {
    if (this.unlocked.includes(id)) return;
    this.unlocked.push(id);
    this.ammo[id] = WEAPONS[id].mag ?? Infinity;
  }
  swap() {
    this.index = (this.index + 1) % this.unlocked.length;
    this.reloading = 0; this.cooldown = 120;
    this._applyViewmodel();
  }
  _applyViewmodel() {
    const isMelee = this.def.kind === 'melee';
    this.vm.userData.knife.visible = isMelee;
    this.vm.userData.body.visible = !isMelee;
    this.vm.userData.barrel.visible = !isMelee;
  }

  reload() {
    const d = this.def;
    if (d.kind !== 'gun' || this.reloading > 0 || this.curAmmo === d.mag) return;
    this.reloading = d.reload;
    this.audio?.sfx('reload');
  }

  update(dt, input) {
    const s = input.state;
    this.cooldown -= dt * 1000;
    if (s.swap) this.swap();
    if (s.reload) this.reload();

    if (this.reloading > 0) {
      this.reloading -= dt * 1000;
      if (this.reloading <= 0) this.ammo[this.id] = this.def.mag;
    }

    if (s.firing && this.cooldown <= 0 && this.reloading <= 0) this._fire();

    // viewmodel ease back from recoil
    const rest = this.def.kind === 'melee' ? 0 : 0;
    this.vm.position.z += (-0.5 - this.vm.position.z) * Math.min(1, dt * 14);
    rest;
  }

  _fire() {
    const d = this.def;
    this.cooldown = d.rate;
    this.player.getEye(this._eye);
    this.player.getAimDir(this._dir);

    if (d.kind === 'melee') {
      this._fireMelee(d);
      this.vm.position.z = -0.2;             // stab punch-out
      this.audio?.sfx('knife');
      return;
    }

    // gun
    if (this.curAmmo <= 0) { this.audio?.sfx('empty'); if (this.def.mag) this.reload(); return; }
    this.ammo[this.id] = this.curAmmo - 1;
    const pellets = d.pellets || 1;
    for (let i = 0; i < pellets; i++) this._fireBullet(d);
    this.player.addRecoil(0.02 + d.knock * 0.004);
    this.vm.position.z = -0.34;
    this.audio?.sfx(this.id === 'shotgun' ? 'shotgun' : this.id === 'smg' ? 'smg' : 'pistol');
  }

  _fireBullet(d) {
    // jittered direction
    const jx = (Math.random() - 0.5) * d.spread * 2;
    const jy = (Math.random() - 0.5) * d.spread * 2;
    this._dir.set(0, 0, -1).applyEuler(this.player.camera.rotation);
    this._dir.x += jx; this._dir.y += jy; this._dir.normalize();

    const hit = this.enemies.raycast(this._eye, this._dir, d.range);
    let hitDist = d.range;
    if (hit) {
      hitDist = hit.dist;
      this._pt.copy(this._eye).addScaledVector(this._dir, hit.dist);
      this.enemies.damage(hit.enemy, d.dmg, this._dir, d.knock, hit.head);
      this.blood.burst(this._pt, 7, 4, 3, 0.45, 1.2);
    } else {
      hitDist = this._impactDist(d.range);
      this._pt.copy(this._eye).addScaledVector(this._dir, hitDist);
      this.sparks.burst(this._pt, 4, 3, 2.4, 0.3, 0.8);
    }
    this.tracers.fire(this._muzzle(), this._pt);
  }

  _fireMelee(d) {
    const hits = this.enemies.meleeHits(this._eye, this._dir, d.range, d.arc);
    for (const e of hits) {
      this.enemies.damage(e, d.dmg, this._dir, d.knock, false);
      this._pt.set(e.pos.x, e.pos.y + 1.1, e.pos.z);
      this.blood.burst(this._pt, 6, 4, 3, 0.4, 1.2);
    }
  }

  _muzzle() {
    if (!this._tmpMuzzle) this._tmpMuzzle = new THREE.Vector3();
    return this._tmpMuzzle.copy(this._eye).addScaledVector(this._dir, 0.6);
  }

  // distance to ground/wall for spark placement (cheap analytic)
  _impactDist(max) {
    let t = max;
    if (this._dir.y < -0.001) t = Math.min(t, (0 - this._eye.y) / this._dir.y); // ground y=0
    const lim = ARENA.size - 1.2;
    for (const [comp, dval] of [['x', this._dir.x], ['z', this._dir.z]]) {
      if (Math.abs(dval) > 0.001) {
        const bound = dval > 0 ? lim : -lim;
        const tw = (bound - this._eye[comp]) / dval;
        if (tw > 0) t = Math.min(t, tw);
      }
    }
    return Math.max(0.5, t);
  }
}
