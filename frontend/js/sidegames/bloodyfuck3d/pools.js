// ===========================================================================
//  pools.js — object pooling + InstancedMesh effect pools.
//  Goal: ZERO allocations during the gameplay loop. Everything that spawns
//  (tracers, sparks, blood) is pre-allocated and recycled.
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';

/** Generic free-list pool of plain objects. */
export class Pool {
  constructor(factory, reset, size) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = [];
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  acquire() {
    const o = this.free.pop() || this.factory();
    this.active.push(o);
    return o;
  }
  release(o) {
    const i = this.active.indexOf(o);
    if (i !== -1) this.active.splice(i, 1);
    this.reset?.(o);
    this.free.push(o);
  }
  releaseAll() {
    for (const o of this.active) { this.reset?.(o); this.free.push(o); }
    this.active.length = 0;
  }
}

/**
 * Instanced point-effect pool (sparks / blood / impact bits) rendered as a
 * single InstancedMesh — one draw call for hundreds of particles.
 */
export class ParticlePool {
  constructor(scene, { count = 220, color = 0xff3030, size = 0.12 } = {}) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = count;
    scene.add(this.mesh);
    this.count = count;
    this.p = new Array(count).fill(null).map(() => ({
      life: 0, max: 0.5, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scl: 1,
    }));
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._hidden = new THREE.Vector3(0, -9999, 0);
    this._init = false;
  }
  burst(pos, n, spread = 4, up = 2, life = 0.5, scl = 1) {
    let spawned = 0;
    for (let i = 0; i < this.count && spawned < n; i++) {
      const part = this.p[i];
      if (part.life > 0) continue;
      part.life = part.max = life * (0.6 + Math.random() * 0.6);
      part.scl = scl * (0.6 + Math.random() * 0.8);
      part.pos.copy(pos);
      part.vel.set((Math.random() - 0.5) * spread, Math.random() * up + 0.5, (Math.random() - 0.5) * spread);
      spawned++;
    }
  }
  update(dt) {
    const m = this.mesh;
    for (let i = 0; i < this.count; i++) {
      const part = this.p[i];
      if (part.life <= 0) {
        if (!this._init) { this._m.makeTranslation(0, -9999, 0); m.setMatrixAt(i, this._m); }
        continue;
      }
      part.life -= dt;
      part.vel.y -= 9.8 * dt;
      part.pos.addScaledVector(part.vel, dt);
      const t = Math.max(0, part.life / part.max);
      this._s.setScalar(part.scl * t);
      this._m.compose(part.pos, this._q, this._s);
      m.setMatrixAt(i, this._m);
    }
    this._init = true;
    m.instanceMatrix.needsUpdate = true;
  }
  reset() {
    for (const part of this.p) part.life = 0;
    this._init = false;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}

/** Pool of short-lived line tracers for gunfire (reused Line segments). */
export class TracerPool {
  constructor(scene, count = 24) {
    this.items = [];
    const mat = new THREE.LineBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.85 });
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, mat.clone());
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.items.push({ line, life: 0 });
    }
    this.idx = 0;
  }
  fire(from, to, life = 0.06) {
    const it = this.items[this.idx];
    this.idx = (this.idx + 1) % this.items.length;
    const pos = it.line.geometry.attributes.position;
    pos.array[0] = from.x; pos.array[1] = from.y; pos.array[2] = from.z;
    pos.array[3] = to.x; pos.array[4] = to.y; pos.array[5] = to.z;
    pos.needsUpdate = true;
    it.line.visible = true;
    it.line.material.opacity = 0.85;
    it.life = life;
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      it.line.material.opacity = Math.max(0, (it.life / 0.06) * 0.85);
      if (it.life <= 0) it.line.visible = false;
    }
  }
  reset() { for (const it of this.items) { it.life = 0; it.line.visible = false; } }
  dispose() { for (const it of this.items) { it.line.geometry.dispose(); it.line.material.dispose(); it.line.parent?.remove(it.line); } }
}
