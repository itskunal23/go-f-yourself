// ===========================================================================
//  world.js — the arena: ground, boundary walls, and InstancedMesh obstacles.
//  Exposes bounds + obstacle circles for the AI/player to avoid, and spawn
//  points around the rim. All obstacles share ONE InstancedMesh (1 draw call).
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';
import { ARENA } from './config.js';

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.size = ARENA.size;
    this.obstacles = []; // { x, z, r } circles for avoidance

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.size * 2, this.size * 2), materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;

    // boundary walls (4 thin boxes, shared wall material)
    const wallH = ARENA.wallHeight;
    const wallGeoNS = new THREE.BoxGeometry(this.size * 2, wallH, 1.5);
    const wallGeoEW = new THREE.BoxGeometry(1.5, wallH, this.size * 2);
    const mk = (geo, x, z) => { const m = new THREE.Mesh(geo, materials.wall); m.position.set(x, wallH / 2, z); m.receiveShadow = true; scene.add(m); return m; };
    this.walls = [
      mk(wallGeoNS, 0, -this.size), mk(wallGeoNS, 0, this.size),
      mk(wallGeoEW, -this.size, 0), mk(wallGeoEW, this.size, 0),
    ];

    // instanced obstacles (crates / pillars)
    const box = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(box, materials.crate, ARENA.obstacleCount);
    inst.castShadow = true; inst.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let placed = 0, tries = 0;
    while (placed < ARENA.obstacleCount && tries < 400) {
      tries++;
      const x = (Math.random() * 2 - 1) * (this.size - 6);
      const z = (Math.random() * 2 - 1) * (this.size - 6);
      if (Math.hypot(x, z) < 8) continue; // keep spawn center clear
      const sx = 1.4 + Math.random() * 2.2;
      const sy = 1.4 + Math.random() * 3.5;
      const r = sx * 0.72;
      if (this.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 1.5)) continue;
      p.set(x, sy / 2, z); s.set(sx, sy, sx); m.compose(p, q, s);
      inst.setMatrixAt(placed, m);
      this.obstacles.push({ x, z, r });
      placed++;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    this.obstacleMesh = inst;
  }

  /** Clamp a position inside the arena walls (mutates v). */
  clamp(v, radius = 0.5) {
    const lim = this.size - 1.2 - radius;
    v.x = Math.max(-lim, Math.min(lim, v.x));
    v.z = Math.max(-lim, Math.min(lim, v.z));
    return v;
  }

  /** Push a position out of any overlapping obstacle (mutates v). Cheap circle test. */
  resolveObstacles(v, radius = 0.5) {
    for (const o of this.obstacles) {
      const dx = v.x - o.x, dz = v.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + radius;
      if (d > 0 && d < min) {
        const k = (min - d) / d;
        v.x += dx * k; v.z += dz * k;
      }
    }
    return v;
  }

  /** A random spawn point on the arena rim. */
  rimSpawn(out) {
    const edge = (Math.random() * 4) | 0;
    const t = (Math.random() * 2 - 1) * (this.size - 4);
    const s = this.size - 3;
    if (edge === 0) out.set(t, 0, -s);
    else if (edge === 1) out.set(t, 0, s);
    else if (edge === 2) out.set(-s, 0, t);
    else out.set(s, 0, t);
    return out;
  }

  dispose() {
    this.floor.geometry.dispose();
    this.obstacleMesh.geometry.dispose();
    for (const w of this.walls) w.geometry.dispose();
  }
}
