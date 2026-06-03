// ===========================================================================
//  game.js — orchestrator. Wires every system together, owns the main loop,
//  routes kill/hit/spawn events, tracks score/stats, and handles game over.
//  Designed for a stable frame: clamp dt, no per-frame allocations downstream.
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';
import { RenderSystem } from './renderer.js';
import { World } from './world.js';
import { makeAtlas, makeMaterials, makeViewmodel } from './assets.js';
import { ParticlePool, TracerPool } from './pools.js';
import { InputSystem } from './input.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { WeaponSystem } from './weapons.js';
import { AudioSystem } from './audio.js';
import { UISystem } from './ui.js';
import { Director } from './modes.js';
import { MAX_ENEMIES, MAX_ENEMIES_LOW } from './config.js';

export class Game {
  constructor(container, { mode = 'endless', progress, onEnd } = {}) {
    this.container = container;
    this.mode = mode;
    this.progress = progress;
    this.onEnd = onEnd;
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.stats = { kills: 0, wave: 1, bossKills: 0, score: 0 };

    // --- rendering + world ---
    this.render = new RenderSystem(container);
    const atlas = makeAtlas();
    this.materials = makeMaterials(atlas);
    this.world = new World(this.render.scene, this.materials);

    // --- effect pools (instanced, pre-allocated) ---
    this.blood = new ParticlePool(this.render.scene, { count: 200, color: 0xb00000, size: 0.13 });
    this.sparks = new ParticlePool(this.render.scene, { count: 120, color: 0xffd27a, size: 0.08 });
    this.tracers = new TracerPool(this.render.scene, 28);

    // --- player + viewmodel ---
    this.player = new Player(this.render.camera, this.world);
    this.render.scene.add(this.render.camera);          // so viewmodel (child) renders
    this.viewmodel = makeViewmodel();
    this.render.camera.add(this.viewmodel);

    // --- enemies ---
    this.enemies = new EnemyManager(this.render.scene, this.world, MAX_ENEMIES);

    // --- audio ---
    this.audio = new AudioSystem();
    this.audio.resume();
    this.audio.startMusic();
    this.audio.startAmbience();

    // --- weapons ---
    this.weapons = new WeaponSystem({
      player: this.player, enemies: this.enemies,
      blood: this.blood, sparks: this.sparks, tracers: this.tracers,
      audio: this.audio, viewmodel: this.viewmodel,
      unlocked: progress?.unlocked || ['knife', 'pistol'],
    });

    // --- input + ui ---
    this.input = new InputSystem(container);
    this.ui = new UISystem(container);
    this.ui.setMode(mode === 'timeattack');

    // --- director / spawning ---
    const cap = this.render.tier === 0 ? MAX_ENEMIES_LOW : MAX_ENEMIES;
    this.director = new Director(mode, this.enemies, this.world, cap);
    this.director.onWave = (w, boss) => { this.stats.wave = w; this.ui.setWave(w); if (!boss) this.audio.sfx('wave'); };
    this.director.onBoss = () => { this.audio.sfx('boss'); this.ui.banner('☠ BOSS — WARDEN'); };
    this.director.onFinish = () => this.end('time');

    // --- event wiring ---
    this.enemies.onHit = (e, head) => { this.ui.hitMarker(); this.audio.sfx('enemyHit', e.pos); if (head) this.ui.banner('HEADSHOT', 600); };
    this.enemies.onAttack = (e) => this.audio.sfx('enemyAttack', e.pos);
    this.enemies.onKill = (e) => {
      this.stats.score += e.cfg.score;
      this.stats.kills++;
      this.director.noteKill(e);
      if (e.type === 'boss') { this.stats.bossKills++; this.ui.banner('WARDEN DOWN 🩸'); }
      this.blood.burst(e.pos.clone().setY(1), e.type === 'boss' ? 40 : 14, 5, 4, 0.6, 1.6);
      this.ui.setScore(this.stats.score);
    };

    // scratch
    this._spawnV = new THREE.Vector3();

    this._onResize = () => this.render.resize();
    window.addEventListener('resize', this._onResize);
    this._onVis = () => { if (document.hidden) this._wasRunning = this.running, this.pause(); else if (this._wasRunning) this.resume(); };
    document.addEventListener('visibilitychange', this._onVis);

    this.ui.setWeapon(this.weapons.def.name, this.weapons.curAmmo, false);
    this.ui.banner(mode === 'timeattack' ? '⏱ TIME ATTACK' : mode === 'boss' ? '☠ BOSS WAVES' : '♾ SURVIVE', 1600);
  }

  start() { this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this._loop(t)); }
  pause() { this.running = false; cancelAnimationFrame(this.raf); }
  resume() { if (this.ended) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this._loop(t)); }

  _loop(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this._loop(t));
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.05) dt = 0.05; // clamp big stalls

    this.input.beginFrame();
    this.player.update(dt, this.input);
    this.weapons.update(dt, this.input);
    this.enemies.update(dt, this.player);
    this.director.cap = this.render.tier === 0 ? MAX_ENEMIES_LOW : MAX_ENEMIES;
    this.director.update(dt, this._spawnV);

    this.blood.update(dt);
    this.sparks.update(dt);
    this.tracers.update(dt);

    this.audio.setListener(this.render.camera);

    // HUD
    this.ui.frame(this.player);
    this.ui.setWeapon(this.weapons.def.name, this.weapons.curAmmo, this.weapons.reloading > 0);
    if (this.mode === 'timeattack') this.ui.setTimer(this.director.timeLeft);

    this.input.endFrame();
    this.render.render();
    this.render.trackFps(dt);

    if (!this.player.alive && !this.ended) this.end('dead');
  }

  end(reason) {
    if (this.ended) return;
    this.ended = true; this.running = false;
    cancelAnimationFrame(this.raf);
    this.audio.sfx('gameover');
    this.audio.stopAll();
    const result = {
      reason, mode: this.mode, score: this.stats.score, kills: this.stats.kills,
      wave: this.stats.wave, bossKills: this.stats.bossKills,
      newWeapons: [], achievements: [],
    };
    if (this.progress) {
      result.newWeapons = this.progress.addRunResult(this.mode, result.score, this.stats);
      result.achievements = this.progress.lastGranted;
    }
    this.onEnd?.(result);
  }

  dispose() {
    this.running = false; this.ended = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    this.input.dispose();
    this.ui.dispose();
    this.audio.dispose();
    this.blood.dispose();
    this.sparks.dispose();
    this.tracers.dispose();
    this.enemies.dispose();
    this.world.dispose();
    for (const m of Object.values(this.materials)) { m.map?.dispose(); m.dispose(); }
    this.render.dispose();
  }
}
