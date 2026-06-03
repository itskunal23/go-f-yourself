import * as THREE from '/vendor/three/three.module.js';

/** Orbit-style camera locked on seated avatar. */
export class CameraSystem {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.target = new THREE.Vector3(0, 1.05, 0);
    this._radius = 3.2;
    this._theta = 0.15;
    this._phi = 1.45;
    this._updatePosition();
  }

  _updatePosition() {
    const x = this._radius * Math.sin(this._phi) * Math.sin(this._theta);
    const y = this._radius * Math.cos(this._phi) + this.target.y;
    const z = this._radius * Math.sin(this._phi) * Math.cos(this._theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  /** @param {number} aspect */
  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Gentle drift for cinematic feel */
  /** @param {number} t */
  update(t) {
    this._theta = 0.15 + Math.sin(t * 0.15) * 0.08;
    this._updatePosition();
  }
}
