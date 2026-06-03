// ===========================================================================
//  renderer.js — RenderSystem: scene, camera, WebGL renderer, lights, fog,
//  and automatic quality scaling driven by a rolling FPS average.
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';

export class RenderSystem {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x140a16);

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, 220);
    this.camera.position.set(0, 1.7, 0);

    const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 4) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,                 // perf: rely on resolution + FXAA-free
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.shadowMap.enabled = !lowMem;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });

    // Quality tiers control pixel ratio, shadows and fog distance.
    this.tier = lowMem ? 1 : 2;       // 0 = low, 1 = med, 2 = high
    this.maxTier = 2;

    // --- Lighting (cheap): hemisphere ambient + 1 directional + neon fill ---
    this.scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x2a1420, 1.15));
    const neon = new THREE.PointLight(0xff2d55, 0.6, 90, 1.6);
    neon.position.set(0, 14, 0);
    this.scene.add(neon);
    const sun = new THREE.DirectionalLight(0xfff1e0, 1.5);
    sun.position.set(30, 50, 20);
    if (this.renderer.shadowMap.enabled) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      const c = sun.shadow.camera;
      c.near = 1; c.far = 140; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70;
    }
    this.sun = sun;
    this.scene.add(sun);

    // --- Fog (atmosphere + draw-distance limiter) ---
    this.scene.fog = new THREE.Fog(0x140a16, 34, 120);

    // fps tracking for auto quality scaling
    this._frames = 0; this._fpsTimer = 0; this._fps = 60; this._cooldown = 0;

    this.applyTier();
    this.resize();
  }

  applyTier() {
    const dpr = window.devicePixelRatio || 1;
    const cap = [0.7, 1.0, Math.min(1.6, dpr)][this.tier];
    this.renderer.setPixelRatio(Math.min(dpr, cap));
    const shadows = this.tier >= 2;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    // tighter fog on low tiers = less to draw
    const far = [80, 105, 120][this.tier];
    this.scene.fog.far = far;
    this.camera.far = far + 60;
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Feed real frame time; auto-adjusts tier to hold ~60fps (down) / recover (up). */
  trackFps(dt) {
    this._frames++; this._fpsTimer += dt; this._cooldown -= dt;
    if (this._fpsTimer >= 1) {
      this._fps = this._frames / this._fpsTimer;
      this._frames = 0; this._fpsTimer = 0;
      if (this._cooldown <= 0) {
        if (this._fps < 45 && this.tier > 0) { this.tier--; this.applyTier(); this._cooldown = 3; }
        else if (this._fps > 58 && this.tier < this.maxTier) { this.tier++; this.applyTier(); this._cooldown = 5; }
      }
    }
    return this._fps;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
