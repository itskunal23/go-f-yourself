import * as THREE from '/vendor/three/three.module.js';

/**
 * 3D slash / raycast gore on seated avatar.
 */
export class SliceController {
  /** @param {THREE.WebGLRenderer} renderer @param {THREE.Camera} camera @param {THREE.Object3D} avatar @param {THREE.Group} bloodGroup @param {(part: string, depth: number)=>void} onHit */
  constructor(renderer, camera, avatar, bloodGroup, onHit) {
    this.renderer = renderer;
    this.camera = camera;
    this.avatar = avatar;
    this.bloodGroup = bloodGroup;
    this.onHit = onHit;
    this.raycaster = new THREE.Raycaster();
    /** @type {{ x: number, y: number }[]} */
    this.trail = [];
    this.maxTrail = 12;
    /** @type {Map<string, number>} */
    this.wounds = new Map();
    this._ndc = new THREE.Vector2();
    /** @type {THREE.Mesh[]} */
    this.particles = [];
    this._pool = [];
    for (let i = 0; i < 80; i++) this._pool.push(this._makeParticle());
  }

  _makeParticle() {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x8b0000, transparent: true, opacity: 0.9 })
    );
    m.visible = false;
    this.bloodGroup.add(m);
    return m;
  }

  _spawnBlood(pos) {
    const p = this._pool.find((x) => !x.visible) || this._makeParticle();
    p.position.copy(pos);
    p.visible = true;
    p.userData.life = 1;
    p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.08, Math.random() * 0.06, (Math.random() - 0.5) * 0.08);
    this.particles.push(p);
  }

  /** @param {PointerEvent} ev */
  pointerDown(ev) {
    this.trail = [];
    this._addPoint(ev);
  }

  /** @param {PointerEvent} ev */
  pointerMove(ev) {
    if (ev.buttons !== 1) return;
    this._addPoint(ev);
  }

  /** @param {PointerEvent} ev */
  _addPoint(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.trail.push({ x: this._ndc.x, y: this._ndc.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();
    if (this.trail.length >= 2) this._slash();
  }

  _slash() {
    const a = this.trail[this.trail.length - 2];
    const b = this.trail[this.trail.length - 1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.raycaster.setFromCamera(mid, this.camera);
    const hits = this.raycaster.intersectObject(this.avatar, true);
    if (!hits.length) return;
    const hit = hits[0];
    const part = hit.object.userData.part || 'body';
    const depth = (this.wounds.get(part) || 0) + 0.18;
    this.wounds.set(part, Math.min(1, depth));
    this._applyWound(hit.object, depth);
    this._spawnBlood(hit.point);
    this.onHit(part, depth);
  }

  /** @param {THREE.Mesh} mesh @param {number} depth */
  _applyWound(mesh, depth) {
    if (!mesh.material) return;
    const mat = mesh.material;
    if (mat.color) {
      const r = THREE.MathUtils.lerp(0.83, 0.45, depth);
      const g = THREE.MathUtils.lerp(0.65, 0.12, depth);
      const b = THREE.MathUtils.lerp(0.45, 0.08, depth);
      mat.color.setRGB(r, g, b);
    }
    if (depth > 0.55 && mesh.userData.part === 'torso') {
      const guts = this.avatar.userData.parts?.guts;
      if (guts) guts.visible = true;
    }
    if (depth > 0.85) {
      mesh.visible = depth < 1.2;
      if (mesh.userData.part?.includes('Arm') || mesh.userData.part?.includes('Leg')) {
        mesh.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.05, -0.02, 0.02));
        mesh.rotation.z += (Math.random() - 0.5) * 0.3;
      }
    }
  }

  /** @param {number} dt */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt * 0.9;
      p.position.addScaledVector(p.userData.v, dt * 8);
      p.userData.v.y -= dt * 0.4;
      p.material.opacity = Math.max(0, p.userData.life);
      if (p.userData.life <= 0) {
        p.visible = false;
        this.particles.splice(i, 1);
      }
    }
  }

  reset() {
    this.wounds.clear();
    this.trail = [];
    this.particles.forEach((p) => { p.visible = false; });
    this.particles = [];
    this.avatar.traverse((c) => {
      if (c.isMesh) {
        c.visible = true;
        if (c.userData.part === 'guts' || c.userData.part === 'spine') c.visible = false;
        if (c.material?.color && c.userData.part !== 'guts' && c.userData.part !== 'spine') {
          c.material.color.setHex(0xd4a574);
        }
      }
    });
  }
}
