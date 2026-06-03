import * as THREE from '/vendor/three/three.module.js';

/** Three-point lighting for realistic skin. */
export class LightingSystem {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    scene.add(new THREE.HemisphereLight(0xfff0e8, 0x2a1818, 0.55));
    this.key = new THREE.DirectionalLight(0xffe8d0, 1.35);
    this.key.position.set(2.5, 4, 3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 15;
    const sc = 4;
    this.key.shadow.camera.left = -sc;
    this.key.shadow.camera.right = sc;
    this.key.shadow.camera.top = sc;
    this.key.shadow.camera.bottom = -sc;
    scene.add(this.key);

    const fill = new THREE.DirectionalLight(0xaaccff, 0.35);
    fill.position.set(-3, 2, 2);
    scene.add(fill);

    const rim = new THREE.PointLight(0xff4422, 0.45, 12);
    rim.position.set(0, 2.5, -2);
    scene.add(rim);
  }
}
