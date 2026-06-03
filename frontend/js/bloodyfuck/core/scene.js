import * as THREE from '/vendor/three/three.module.js';

/** Scene graph + room props (chair, floor, blood pool plane). */
export class SceneSystem {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1410);
    this.scene.fog = new THREE.Fog(0x1a1410, 8, 28);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.95, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.chair = this._buildChair();
    this.chair.position.set(0, 0, 0);
    this.scene.add(this.chair);

    /** @type {THREE.Group} */
    this.avatarRoot = new THREE.Group();
    this.avatarRoot.position.set(0, 0.05, 0);
    this.scene.add(this.avatarRoot);

    this.bloodGroup = new THREE.Group();
    this.scene.add(this.bloodGroup);
  }

  _buildChair() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x3d3028, roughness: 0.85 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.85), wood);
    seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.08), wood);
    back.position.set(0, 0.85, -0.38); back.castShadow = true; g.add(back);
    for (const x of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), wood);
      leg.position.set(x, 0.22, 0.3); g.add(leg);
    }
    return g;
  }

  /** @param {THREE.Object3D} avatar */
  attachAvatar(avatar) {
    this.avatarRoot.clear();
    this.avatarRoot.add(avatar);
  }
}
