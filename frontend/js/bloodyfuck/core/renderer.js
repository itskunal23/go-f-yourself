import * as THREE from '/vendor/three/three.module.js';

/**
 * WebGL renderer tuned for 60+ FPS on mobile.
 */
export class RenderSystem {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, {
      display: 'block', width: '100%', height: '100%', touchAction: 'none',
    });
    this._dprCap = Math.min(window.devicePixelRatio || 1, 1.75);
    this._onResize = this._onResize.bind(this);
    this.resize();
    window.addEventListener('resize', this._onResize);
  }

  _onResize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setPixelRatio(this._dprCap);
    this.renderer.setSize(w, h, false);
  }

  /** @param {THREE.Scene} scene @param {THREE.Camera} camera */
  render(scene, camera) {
    this.renderer.render(scene, camera);
  }

  /** @returns {number} delta seconds */
  getDelta() { return this.clock.getDelta(); }

  resize() { this._onResize(); }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
