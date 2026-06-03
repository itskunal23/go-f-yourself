import { BottlePhysics } from './physics.js';
import { Renderer } from './renderer.js';
import { AnimationController } from './animation.js';
import { PlayerManager } from '../ui/playerManager.js';
import { MenuController } from '../ui/menus.js';
import { OverlayController } from '../ui/overlays.js';
import { MODES } from '../modes/index.js';
import { PartyHost } from '../party/host.js';
import { pickWeightedTarget, seatAngleForIndex } from '../party/picker.js';
import { playerDrunkDisplay, addSessionDrink } from '../party/drunkMeter.js';
import { audio } from '../audio/audioManager.js';
import { haptics } from '../effects/haptics.js';
import { confetti } from '../effects/confetti.js';
import { ambientParticles } from '../effects/particles.js';

/** Main game — party-first loop with roasts, suspense, punishments. */
export class SpinBottleGame {
  constructor(container, externalCtx = {}) {
    this.container = container;
    this.externalCtx = externalCtx;
    this.phase = 'menu';
    this.mode = MODES.party;
    this.playerManager = new PlayerManager();
    this.physics = new BottlePhysics();
    this.anim = new AnimationController();
    this.host = new PartyHost();
    this.spinnerIndex = 0;
    this.selectedIndex = -1;
    this.pendingTargetIndex = -1;
    this.lastPickedId = null;
    this.pickCounts = {};
    this.round = 0;
    this.currentPunishment = null;
    this.currentEvent = null;
    this.spinTwicePending = false;
    this.lastTickHaptic = 0;
    this.wasSpinning = false;
    this.draggingBottle = false;
    this.pointerDown = false;
    this.screenFlash = 0;
    this.raf = null;
    this.lastTime = 0;
    this.soundEnabled = true;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bacFn = externalCtx.playerStatus ?? null;

    this.buildDOM();
    this.setupUI();
    this.setupInput();
    this.loadExternalPlayers();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildDOM() {
    this.container.innerHTML = '';
    this.container.className = 'stb-root';

    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'stb-canvas-wrap';
    this.canvasWrap.setAttribute('role', 'img');
    this.canvasWrap.setAttribute('aria-label', 'Spin the bottle game board');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stb-canvas';
    this.canvasWrap.appendChild(this.canvas);

    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'stb-ui-layer';

    this.container.appendChild(this.canvasWrap);
    this.container.appendChild(this.uiLayer);

    this.renderer = new Renderer(this.canvas);
    this.anim.setReducedMotion(this.reducedMotion);
  }

  setupUI() {
    const cb = {
      onModeSelect: (id) => this.startMode(id),
      onPlayerCount: (n) => this.setPlayerCount(n),
      onRename: (id, name) => this.playerManager.updateName(id, name),
      onRemove: (id) => this.removePlayer(id),
      onAvatar: (id, url) => this.setPlayerAvatar(id, url),
      onReducedMotion: (on) => {
        this.reducedMotion = on;
        document.documentElement.classList.toggle('stb-reduced', on);
        this.anim.setReducedMotion(on);
      },
      onSoundToggle: (on) => {
        this.soundEnabled = on;
        audio.setEnabled(on);
      },
      onSound: (type) => type === 'click' && this.soundEnabled && audio.click(),
      onStagger: (el) => this.anim.staggerIn(el),
      onPause: () => this.pause(),
      onPlayersQuick: () => this.menus.showPlayers(this.playerManager.players, this.playerManager.players.length),
    };

    this.menus = new MenuController(this.uiLayer, cb);
    this.overlays = new OverlayController(this.uiLayer, cb);
    this.menus.mount();
    this.overlays.mount();
  }

  removePlayer(id) {
    if (this.playerManager.players.length <= 2) return;
    this.playerManager.remove(id);
    this.menus.showPlayers(this.playerManager.players, this.playerManager.players.length);
  }

  setPlayerAvatar(id, url) {
    const p = this.playerManager.players.find((x) => x.id === id);
    if (p) {
      this.playerManager.setAvatar(p, url);
      this.menus.showPlayers(this.playerManager.players, this.playerManager.players.length);
    }
  }

  setPlayerCount(n) {
    this.playerManager.setCount(n);
    this.menus.showPlayers(this.playerManager.players, n);
  }

  loadExternalPlayers() {
    const raw = this.externalCtx.players;
    if (raw?.length >= 2) {
      this.playerManager.loadFromExternal(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          drinks: p.drinks,
          sex: p.sex,
          age: p.age,
          heightCm: p.heightCm,
          weightKg: p.weightKg,
        }))
      );
    } else if (this.playerManager.players.length < 2) {
      this.playerManager.setCount(4);
    }
  }

  getDrunkMap() {
    const map = {};
    for (const p of this.playerManager.players) {
      const bac = this.bacFn?.(p, p.drinks || []);
      map[p.id] = playerDrunkDisplay(p, bac);
    }
    return map;
  }

  async startMode(modeId) {
    await audio.unlock();
    this.mode = MODES[modeId] || MODES.party;
    this.phase = 'playing';
    this.spinnerIndex = 0;
    this.selectedIndex = -1;
    this.round = 0;
    this.physics = new BottlePhysics();
    this.menus.hide();
    this.overlays.clear();
    this.updateHUD();
    this.anim.breatheTable(this.canvasWrap);
    this.startLoop();
    haptics.tap();
  }

  updateHUD() {
    const spinner = this.playerManager.players[this.spinnerIndex];
    this.menus.showHUD({
      modeName: this.mode.name,
      spinnerName: spinner?.name,
      canSpin: this.phase === 'playing',
      phase: this.phase,
      drunkMap: this.getDrunkMap(),
    });
  }

  setupInput() {
    const getPos = (e) => {
      const t = e.touches?.[0] || e;
      return { x: t.clientX, y: t.clientY };
    };

    const onStart = async (e) => {
      if (this.phase !== 'playing') return;
      await audio.unlock();
      this.pointerDown = true;
      const { x, y } = getPos(e);
      const rect = this.canvas.getBoundingClientRect();
      const px = x - rect.left;
      const py = y - rect.top;
      if (this.renderer.hitTestBottle(px, py, this.physics.angle)) {
        this.draggingBottle = true;
        this.physics.startDrag(this.renderer.cx, this.renderer.cy, px, py);
        haptics.tap();
      }
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!this.physics.isDragging) return;
      const { x, y } = getPos(e);
      const rect = this.canvas.getBoundingClientRect();
      this.physics.updateDrag(this.renderer.cx, this.renderer.cy, x - rect.left, y - rect.top);
      e.preventDefault();
    };

    const onEnd = (e) => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      if (this.physics.isDragging) {
        const vel = this.physics.endDrag();
        this.draggingBottle = false;
        if (Math.abs(vel) > 0.002) this.beginSpin();
      } else if (!this.draggingBottle) {
        this.tapSpin();
      }
      e.preventDefault();
    };

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onEnd);
    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  tapSpin() {
    if (this.phase !== 'playing') return;
    this.beginSpin();
  }

  beginSpin() {
    const players = this.playerManager.players;
    const n = players.length;
    this.round++;

    this.pendingTargetIndex = pickWeightedTarget(players, {
      lastPickedId: this.lastPickedId,
      pickCounts: this.pickCounts,
      spinnerIndex: this.spinnerIndex,
    });

    const seatAngle = seatAngleForIndex(this.pendingTargetIndex, n);

    this.phase = 'spinning';
    this.wasSpinning = true;
    this.overlays.clear();
    this.overlays.showSpinning('fast');
    this.updateHUD();

    if (this.soundEnabled) {
      audio.spinStart();
      audio.whoosh();
    }
    haptics.spin();

    this.physics.spinToTargetDramatic(seatAngle, n, (event) => this.onSpinEvent(event));
  }

  onSpinEvent(event) {
    if (event === 'slow') {
      this.overlays.showSpinning('slow');
    } else if (event === 'tick') {
      if (this.soundEnabled) audio.tick(600 + Math.random() * 200);
      haptics.tick();
      this.overlays.showSpinning('tick');
    } else if (event === 'fakeout') {
      if (this.soundEnabled) audio.fakeOut();
      haptics.spin();
      this.overlays.showSpinning('fakeout');
    } else if (event === 'stop') {
      this.onBottleStop();
    }
  }

  update(dt) {
    if (this.phase === 'paused' || this.phase === 'menu') return;

    const result = this.physics.update(dt);
    const speed = result.speed || 0;

    if (this.phase === 'spinning') {
      if (this.soundEnabled && speed > 0.008) {
        if (!audio.frictionOsc) audio.startFriction(speed);
        else audio.updateFriction(speed);
      } else if (speed <= 0.008) {
        audio.stopFriction();
      }

      if (!result.spinning && !this.physics.isDragging && this.wasSpinning && result.phase === 'stopped') {
        if (!this.physics.tickCallback) this.onBottleStop();
      }
      this.wasSpinning = result.spinning;
    }

    if (this.screenFlash > 0) this.screenFlash -= dt * 0.08;

    confetti.update();
    ambientParticles.update(this.renderer.width, this.renderer.height);
  }

  onBottleStop() {
    if (this.phase !== 'spinning') return;
    this.phase = 'anticipation';
    audio.stopFriction();

    if (this.soundEnabled) audio.bottleStop();
    haptics.stop();
    this.anim.shake(this.canvasWrap, 1.2);
    this.screenFlash = 1;

    this.selectedIndex = this.pendingTargetIndex;
    const target = this.playerManager.players[this.selectedIndex];
    this.lastPickedId = target.id;
    this.pickCounts[target.id] = (this.pickCounts[target.id] || 0) + 1;
    this.renderer.setSelectedIndex(this.selectedIndex);

    if (this.soundEnabled) audio.lockIn();

    this.overlays.showLockIn(target.name, () => this.showVerdict());
  }

  showVerdict() {
    this.phase = 'reveal';
    const players = this.playerManager.players;
    const target = players[this.selectedIndex];
    const spinner = players[this.spinnerIndex];

    this.currentEvent = this.host.maybeSpecialEvent(this.round);
    this.currentPunishment = this.host.getPunishment(this.mode.id);
    const roast = this.host.getRoast(target);
    const drunk = playerDrunkDisplay(target, this.bacFn?.(target, target.drinks || []));

    this.anim.spotlight(1, (v) => this.renderer.setSpotlight(v));
    confetti.burst(this.renderer.cx, this.renderer.cy, this.reducedMotion ? 40 : 100);
    if (this.soundEnabled) audio.celebrate();
    haptics.winner();

    if (this.currentEvent) {
      if (this.soundEnabled) audio.chaos();
      this.overlays.showSpecialEvent(this.currentEvent, () => {
        this.overlays.showVerdict({
          target,
          spinner,
          roast,
          punishment: this.currentPunishment,
          drunk,
          specialEvent: this.currentEvent,
          onSurvived: (doubleDown) => this.resolveOutcome(target, spinner, true, doubleDown),
          onRefused: () => this.resolveOutcome(target, spinner, false, false),
        });
      });
    } else {
      this.overlays.showVerdict({
        target,
        spinner,
        roast,
        punishment: this.currentPunishment,
        drunk,
        specialEvent: null,
        onSurvived: (doubleDown) => this.resolveOutcome(target, spinner, true, doubleDown),
        onRefused: () => this.resolveOutcome(target, spinner, false, false),
      });
    }
  }

  resolveOutcome(target, spinner, survived, doubleDown) {
    const ext = this.externalCtx;
    let drinks = 0;
    let title;
    let subtitle;

    if (!survived) {
      const penalty = this.host.getRefusalPenalty();
      drinks = penalty.drinks + (this.currentPunishment.drinks || 0);
      title = '😈 THEY REFUSED';
      subtitle = `${target.name} chickened out — ${penalty.text}`;
    } else if (doubleDown) {
      const dd = this.host.getDoubleDownPenalty(this.currentPunishment);
      drinks = dd.drinks || 2;
      title = '🍺 THEY SURVIVED (DOUBLE DOWN)';
      subtitle = dd.text;
    } else {
      drinks = this.currentPunishment.drinks || 0;
      title = '🍺 THEY SURVIVED';
      subtitle =
        drinks > 0
          ? `${target.name} completed it — log ${drinks} drink${drinks > 1 ? 's' : ''}`
          : `${target.name} nailed it. Respect.`;
    }

    this.applyDrinks(target, drinks);
    if (this.currentEvent?.everyoneDrinks) {
      for (const p of this.playerManager.players) {
        if (p.id !== target.id) this.applyDrinks(p, this.currentEvent.drinks || 1, false);
      }
      subtitle += ' — EVERYONE drank (Chaos Round)!';
    }
    if (this.currentEvent?.spinnerDrinks) {
      this.applyDrinks(spinner, this.currentEvent.drinks || 2, false);
      subtitle += ` — ${spinner.name} drinks too (Double Trouble)!`;
    }

    if (drinks > 0 && ext.toast) {
      ext.toast(`${target.name} → ${playerDrunkDisplay(target, this.bacFn?.(target, target.drinks || [])).level}/10`);
    }

    const spinTwice = this.currentEvent?.spinTwice || this.spinTwicePending;
    this.spinTwicePending = false;

    this.overlays.showOutcome({
      title,
      subtitle,
      btnLabel: spinTwice ? 'SPIN AGAIN (ROUND 2) 🔄' : 'SPIN AGAIN 🔄',
      onSpin: () => {
        if (spinTwice) {
          this.phase = 'playing';
          this.selectedIndex = -1;
          this.renderer.setSelectedIndex(-1);
          this.renderer.setSpotlight(0);
          confetti.clear();
          this.updateHUD();
          setTimeout(() => this.beginSpin(), 400);
        } else {
          this.nextTurn();
        }
      },
    });
  }

  applyDrinks(player, count, logExt = true) {
    if (count <= 0) return;
    addSessionDrink(player, count);
    for (let i = 0; i < count; i++) {
      player.drinks = player.drinks || [];
      player.drinks.push({ volumeMl: 44, abv: 40, at: Date.now() + i * 500 });
    }
    const ext = this.externalCtx;
    if (logExt && ext.logDrink && player.id === ext.me) {
      ext.logDrink(player, { name: `${count} shot${count > 1 ? 's' : ''}`, volumeMl: 44, abv: 40 });
    } else if (logExt && ext.drink) {
      ext.drink(player, `Spin the Bottle: ${count} drink${count > 1 ? 's' : ''}`);
    }
  }

  nextTurn() {
    this.spinnerIndex = (this.selectedIndex + 1) % this.playerManager.players.length;
    this.selectedIndex = -1;
    this.pendingTargetIndex = -1;
    this.renderer.setSelectedIndex(-1);
    this.renderer.setSpotlight(0);
    confetti.clear();
    this.phase = 'playing';
    this.updateHUD();
    this.menus.show();
  }

  pause() {
    this.phase = 'paused';
    this.overlays.showPause(
      () => {
        this.phase = 'playing';
        this.updateHUD();
      },
      () => this.destroy()
    );
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    this.renderer.resize(w, h);
    ambientParticles.init(w, h);
  }

  startLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.lastTime = performance.now();
    const tick = (now) => {
      const dt = Math.min(32, now - this.lastTime) / 16.67;
      this.lastTime = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  draw() {
    const ctx = this.renderer.ctx;
    this.renderer.render({
      players: this.playerManager.players,
      physics: this.physics,
      spinnerIndex: this.spinnerIndex,
      phase: this.phase,
      drunkMap: this.getDrunkMap(),
    });

    ambientParticles.render(ctx);
    confetti.render(ctx);

    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 220, 100, ${this.screenFlash * 0.25})`;
      ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    audio.stopFriction();
    haptics.cancel();
    this.menus.destroy();
    this.overlays.destroy();
    this.anim.killAll();
    this.container.innerHTML = '';
    this.externalCtx.onClose?.();
  }
}

export function launchSpinBottle(container, ctx = {}) {
  return new SpinBottleGame(container, ctx);
}
