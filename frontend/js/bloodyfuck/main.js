import * as THREE from '/vendor/three/three.module.js';
import { RenderSystem } from './core/renderer.js';
import { SceneSystem } from './core/scene.js';
import { CameraSystem } from './core/camera.js';
import { LightingSystem } from './core/lighting.js';
import { AssetManager } from './utils/assetManager.js';
import { PerformanceMonitor } from './utils/performanceMonitor.js';
import { AvatarLoader } from './avatar/avatarLoader.js';
import { AnimationController } from './avatar/animationController.js';
import { BlendshapeController } from './avatar/blendshapeController.js';
import { LipsyncController } from './avatar/lipsyncController.js';
import { FaceTrackingController } from './avatar/faceTrackingController.js';
import { MicrophoneCapture } from './audio/microphone.js';
import { SliceController } from './sliceController.js';
import { GoreAudio } from '../sidegames/slicer-audio.js';

/**
 * Bloody Fuck — production Three.js avatar + seated gore sandbox.
 */
export class BloodyFuckApp {
  /** @param {HTMLElement} mount @param {object} [opts] */
  constructor(mount, opts = {}) {
    this.mount = mount;
    this.opts = opts;
    this.cutCount = 0;
    /** @type {number|null} */
    this.raf = null;
    this.running = false;
    this.assets = new AssetManager();
    this.audio = new GoreAudio();
    this.emotion = { anger: 0, pain: 0, fear: 0 };
    this._lastTap = 0;
  }

  async init() {
    this.shell = document.createElement('div');
    this.shell.className = 'bf-shell';
    this.shell.innerHTML = `
      <div class="bf-stage"></div>
      <div class="bf-hud">
        <div class="bf-title">Bloody Fuck</div>
        <div class="bf-sub">Drag to slice · double-tap reset · mic optional</div>
        <div class="bf-emotion"></div>
      </div>`;
    this.mount.appendChild(this.shell);
    this.stage = this.shell.querySelector('.bf-stage');
    this.emotionEl = this.shell.querySelector('.bf-emotion');

    this.render = new RenderSystem(this.stage);
    this.sceneSys = new SceneSystem();
    this.cameraSys = new CameraSystem();
    this.lighting = new LightingSystem(this.sceneSys.scene);
    this.perf = new PerformanceMonitor(this.shell);

    this.aiWorker = new Worker(new URL('./workers/ai.worker.js', import.meta.url), { type: 'module' });
    this.physicsWorker = new Worker(new URL('./workers/physics.worker.js', import.meta.url), { type: 'module' });
    this.aiWorker.onmessage = (ev) => {
      if (ev.data?.type === 'state') {
        this.emotion = ev.data.emotion;
        this.perf.setWorkerMs(ev.data.latency || 0);
        this._updateEmotionHud();
      }
    };

    const loader = new AvatarLoader(this.assets);
    const { root, animations } = await loader.load();
    this.avatar = root;
    this.sceneSys.attachAvatar(root);

    this.anim = new AnimationController(root, animations);
    if (this.anim.actions.has('idle')) this.anim.play('idle', 0);
    else if (this.anim.actions.has('talk')) this.anim.play('talk', 0);

    this.blend = new BlendshapeController(root);
    this.mic = new MicrophoneCapture();
    this.lipsync = new LipsyncController(this.blend, this.mic);
    this.faceTrack = new FaceTrackingController(this.blend);

    this.slice = new SliceController(
      this.render.renderer,
      this.cameraSys.camera,
      root,
      this.sceneSys.bloodGroup,
      (part, depth) => this._onSlice(part, depth)
    );

    this._onPointerDown = (e) => { this.audio.resume(); this.slice.pointerDown(e); };
    this._onPointerMove = (e) => this.slice.pointerMove(e);
    this._onDblTap = (e) => {
      const now = performance.now();
      if (now - this._lastTap < 320) {
        this.slice.reset();
        this.aiWorker.postMessage({ type: 'reset' });
      }
      this._lastTap = now;
    };

    const canvas = this.render.renderer.domElement;
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onDblTap);

    this._resizeObs = new ResizeObserver(() => this._onResize());
    this._resizeObs.observe(this.stage);

    this._onResize();
    this.running = true;
    this._loop();

    this.lipsync.start().catch(() => {});
    this.faceTrack.init().catch(() => {});
  }

  _onResize() {
    this.render.resize();
    const w = this.stage.clientWidth || 1;
    const h = this.stage.clientHeight || 1;
    this.cameraSys.setAspect(w / h);
  }

  /** @param {string} part @param {number} depth */
  _onSlice(part, depth) {
    this.cutCount++;
    this.opts.onSlice?.(part, depth);
    this.audio.fleshScrape(depth);
    if (depth > 0.4) this.audio.splatter();
    if (depth > 0.75) this.audio.wetChop();
    if (depth > 0.9) this.audio.scream();
    this.aiWorker.postMessage({ type: 'pain', payload: { amount: 0.12, part } });
    this.physicsWorker.postMessage({ type: 'spawn', payload: { x: 0, y: 1 } });
    const talk = Math.min(1, depth * 0.8);
    this.anim.update(0, talk);
    this.blend.setValues({ mouthOpen: talk, browDown: talk * 0.5 });
  }

  _updateEmotionHud() {
    if (!this.emotionEl) return;
    const { pain, anger, fear } = this.emotion;
    this.emotionEl.textContent =
      `Pain ${Math.round(pain * 100)}% · Rage ${Math.round(anger * 100)}% · Fear ${Math.round(fear * 100)}%`;
  }

  _loop = () => {
    if (!this.running) return;
    const dt = this.render.getDelta();
    const t = performance.now() * 0.001;

    this.aiWorker.postMessage({ type: 'tick' });
    this.physicsWorker.postMessage({ type: 'step', payload: { dt } });

    this.cameraSys.update(t);
    this.anim.update(dt, this.emotion.pain * 0.3);
    this.lipsync.update(dt);
    this.slice.update(dt);
    this.blend.update(dt);

    this.render.render(this.sceneSys.scene, this.cameraSys.camera);
    this.perf.tick(dt, this.render.renderer, this.anim.activeNames());

    this.raf = requestAnimationFrame(this._loop);
  };

  dispose(opts = {}) {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.lipsync.stop();
    this.faceTrack.dispose();
    this.aiWorker.terminate();
    this.physicsWorker.terminate();
    this.anim.dispose();
    this.render.dispose();
    this.perf.dispose();
    this._resizeObs?.disconnect();

    const canvas = this.render?.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this._onPointerDown);
      canvas.removeEventListener('pointermove', this._onPointerMove);
      canvas.removeEventListener('pointerup', this._onDblTap);
    }
    this.shell?.remove();
    if (!opts.silent) this.opts.onClose?.();
  }
}

/**
 * Side-game entry: mount Bloody Fuck overlay.
 * @param {HTMLElement} root
 * @param {object} ctx
 */
export async function launchBloodyFuck(root, ctx) {
  void ctx;
  const app = new BloodyFuckApp(root, { onClose: () => root.remove() });
  await app.init();
  return app;
}
