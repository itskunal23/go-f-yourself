/**
 * Drives morph targets / jaw for facial expressions.
 */
export class BlendshapeController {
  /** @param {THREE.Object3D} root */
  constructor(root) {
    this.root = root;
    /** @type {THREE.Mesh[]} */
    this.meshes = [];
    root.traverse((c) => {
      if (c.isMesh && (c.morphTargetDictionary || c.userData.morphNames)) {
        this.meshes.push(c);
      }
    });
    this.values = { mouthOpen: 0, browDown: 0, smile: 0, blink: 0 };
  }

  /** @param {Record<string, number>} v */
  setValues(v) {
    Object.assign(this.values, v);
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary;
      if (dict) {
        for (const [name, val] of Object.entries(this.values)) {
          const idx = dict[name];
          if (idx !== undefined) mesh.morphTargetInfluences[idx] = val;
        }
      }
    }
    if (this.root.userData.parts?.jaw) {
      const j = this.root.userData.parts.jaw;
      j.position.y = 1.42 - this.values.mouthOpen * 0.05;
      j.rotation.x = this.values.mouthOpen * 0.25;
    }
    if (this.root.userData.parts?.head) {
      this.root.userData.parts.head.rotation.x = -this.values.browDown * 0.08;
    }
  }

  /** @param {number} dt */
  update(dt) {
    void dt;
  }
}
