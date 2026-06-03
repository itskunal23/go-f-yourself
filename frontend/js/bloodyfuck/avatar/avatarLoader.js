import * as THREE from '/vendor/three/three.module.js';
import { AssetManager } from '../utils/assetManager.js';

const GLB_URL = '/assets/avatar/human.glb';

/**
 * Builds a seated procedural human with morph-capable head when GLB is unavailable.
 */
function buildProceduralHuman() {
  const root = new THREE.Group();
  root.name = 'BloodyFuck';

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a574, roughness: 0.62, metalness: 0.02,
  });
  const muscleMat = new THREE.MeshStandardMaterial({ color: 0x8b3030, roughness: 0.7 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.55 });

  /** @type {Record<string, THREE.Mesh>} */
  const parts = {};

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 8, 16), skinMat.clone());
  torso.position.set(0, 1.05, 0.05);
  torso.castShadow = true;
  torso.userData.part = 'torso';
  root.add(torso);
  parts.torso = torso;

  const headGeo = new THREE.SphereGeometry(0.19, 32, 32);
  const basePos = headGeo.attributes.position.array.slice();
  headGeo.morphAttributes.position = [
    new THREE.Float32BufferAttribute(basePos.slice(), 3),
    new THREE.Float32BufferAttribute(basePos.slice(), 3),
  ];
  const head = new THREE.Mesh(headGeo, skinMat.clone());
  head.position.set(0, 1.52, 0.08);
  head.castShadow = true;
  head.userData.part = 'head';
  head.userData.morphNames = ['mouthOpen', 'browDown'];
  root.add(head);
  parts.head = head;

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.12), skinMat.clone());
  jaw.position.set(0, 1.42, 0.14);
  jaw.userData.part = 'jaw';
  root.add(jaw);
  parts.jaw = jaw;

  const makeLimb = (name, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(w, h, 6, 12), skinMat.clone());
    m.position.set(x, y, z);
    m.castShadow = true;
    m.userData.part = name;
    root.add(m);
    parts[name] = m;
    return m;
  };

  makeLimb('leftArm', 0.07, 0.35, -0.42, 1.05, 0.1);
  makeLimb('rightArm', 0.07, 0.35, 0.42, 1.05, 0.1);
  makeLimb('leftLeg', 0.09, 0.28, -0.18, 0.62, 0.35);
  makeLimb('rightLeg', 0.09, 0.28, 0.18, 0.62, 0.35);

  const guts = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), muscleMat);
  guts.position.set(0, 0.95, 0.12);
  guts.visible = false;
  guts.userData.part = 'guts';
  root.add(guts);
  parts.guts = guts;

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), boneMat);
  spine.position.set(0, 1.0, 0);
  spine.visible = false;
  spine.userData.part = 'spine';
  root.add(spine);
  parts.spine = spine;

  root.userData.parts = parts;
  root.userData.isProcedural = true;
  root.userData.seatedOffset = { y: 0, z: 0.15 };

  return root;
}

/**
 * Loads GLB avatar or falls back to procedural mesh.
 */
export class AvatarLoader {
  /** @param {AssetManager} assets */
  constructor(assets) {
    this.assets = assets;
  }

  /** @param {(p: number)=>void} [onProgress] */
  async load(onProgress) {
    try {
      const gltf = await this.assets.loadGLB(GLB_URL, onProgress);
      const model = gltf.scene;
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (!c.userData.part) c.userData.part = c.name || 'body';
        }
      });
      model.scale.setScalar(1);
      model.userData.isProcedural = false;
      model.userData.mixerClips = gltf.animations || [];
      return { root: model, animations: gltf.animations || [] };
    } catch {
      const root = buildProceduralHuman();
      return { root, animations: [] };
    }
  }
}
