// ===========================================================================
//  modes.js — wave/spawn director for the three game modes. Decides what and
//  when to spawn, manages waves and win/lose timing. Keeps enemy counts under
//  the cap for mobile performance.
// ===========================================================================
import { TIME_ATTACK_SECONDS } from './config.js';

export class Director {
  constructor(mode, enemies, world, cap) {
    this.mode = mode;
    this.enemies = enemies;
    this.world = world;
    this.cap = cap;
    this.wave = 0;
    this.time = 0;
    this.spawnAcc = 0;
    this.toSpawn = 0;
    this.bossAlive = false;
    this.bossKills = 0;
    this._spawnPos = { set() {}, };
    this._v = null;
    this.finished = false;
    this.timeLeft = mode === 'timeattack' ? TIME_ATTACK_SECONDS : Infinity;
    this._startWave();
  }

  _waveBudget() {
    if (this.mode === 'timeattack') return 9999;
    return 4 + this.wave * 2;
  }
  _spawnInterval() {
    // faster spawns over time, floored for sanity
    const base = this.mode === 'timeattack' ? 0.5 : 0.9;
    return Math.max(0.28, base - this.wave * 0.03 - this.time * 0.004);
  }
  _pickType() {
    const w = this.wave, r = Math.random();
    if (w < 2) return r < 0.85 ? 'melee' : 'runner';
    if (w < 5) return r < 0.55 ? 'melee' : r < 0.85 ? 'runner' : 'heavy';
    return r < 0.4 ? 'melee' : r < 0.72 ? 'runner' : 'heavy';
  }

  _startWave() {
    this.wave++;
    // boss mode: every 5th wave is a boss
    if (this.mode === 'boss' && this.wave % 5 === 0) {
      this.bossPending = true;
      this.toSpawn = 1;
    } else {
      this.bossPending = false;
      this.toSpawn = this._waveBudget();
    }
    this.onWave?.(this.wave, this.bossPending);
  }

  /** Returns spawn requests by mutating; caller provides a Vector3 scratch. */
  update(dt, vScratch) {
    if (this.finished) return;
    this.time += dt;
    if (this.mode === 'timeattack') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finished = true; this.onFinish?.('time'); return; }
    }

    const alive = this.enemies.aliveCount;

    // spawn pacing
    this.spawnAcc += dt;
    if (this.toSpawn > 0 && this.spawnAcc >= this._spawnInterval() && alive < this.cap) {
      this.spawnAcc = 0;
      this.world.rimSpawn(vScratch);
      if (this.bossPending) {
        const e = this.enemies.spawn('boss', vScratch);
        if (e) { this.toSpawn--; this.bossAlive = true; this.onBoss?.(); }
      } else {
        const e = this.enemies.spawn(this._pickType(), vScratch);
        if (e) this.toSpawn--;
      }
    }

    // wave completion (not in time attack): all spawned & all dead
    if (this.mode !== 'timeattack' && this.toSpawn === 0 && alive === 0) {
      this._startWave();
    }
  }

  /** Hook the manager's kill to count bosses. */
  noteKill(enemy) {
    if (enemy.type === 'boss') { this.bossKills++; this.bossAlive = false; }
  }
}
