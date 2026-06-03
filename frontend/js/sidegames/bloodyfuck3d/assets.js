// ===========================================================================
//  assets.js — procedural texture atlas + shared geometries/materials and
//  low-poly mesh builders. Procedural (canvas) textures keep load time near
//  zero (no network) and act as a single shared atlas to cut state changes.
// ===========================================================================
import * as THREE from '/vendor/three/three.module.js';

/** One 256x256 canvas atlas: [0]=floor grime, [1]=wall, [2]=crate. */
export function makeAtlas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  // floor cell (top-left)
  g.fillStyle = '#16121a'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(120,30,40,0.25)';
  for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  g.fillStyle = 'rgba(80,0,0,0.18)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  // wall cell (top-right)
  g.fillStyle = '#241726'; g.fillRect(128, 0, 128, 128);
  g.fillStyle = '#1b111d';
  for (let y = 0; y < 128; y += 18) for (let x = 0; x < 128; x += 36) g.fillRect(128 + x + (y % 36 ? 18 : 0), y, 32, 15);
  // crate cell (bottom-left)
  g.fillStyle = '#5a4326'; g.fillRect(0, 128, 128, 128);
  g.strokeStyle = '#3a2a18'; g.lineWidth = 6; g.strokeRect(4, 132, 120, 120);
  g.beginPath(); g.moveTo(4, 132); g.lineTo(124, 252); g.moveTo(124, 132); g.lineTo(4, 252); g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// UV helpers to pick an atlas cell (2x2 grid).
const CELL = { floor: [0, 0.5], wall: [0.5, 0.5], crate: [0, 0] }; // [u,v] of bottom-left

function cellMaterial(atlas, cell, { repeat = 1, color = 0xffffff, rough = 0.95 } = {}) {
  const t = atlas.clone();
  t.needsUpdate = true;
  t.offset.set(cell[0], cell[1]);
  t.repeat.set(0.5 * repeat, 0.5 * repeat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, color, roughness: rough, metalness: 0 });
}

/** Build the shared material set from one atlas. */
export function makeMaterials(atlas) {
  return {
    floor: cellMaterial(atlas, CELL.floor, { repeat: 24 }),
    wall: cellMaterial(atlas, CELL.wall, { repeat: 6 }),
    crate: cellMaterial(atlas, CELL.crate, { repeat: 1 }),
  };
}

// Shared, reused geometries (created once) for low-poly humanoids.
export const GEO = {
  head: new THREE.BoxGeometry(0.42, 0.42, 0.42),
  torso: new THREE.BoxGeometry(0.62, 0.78, 0.36),
  limb: new THREE.BoxGeometry(0.2, 0.66, 0.2),
};

/**
 * Low-poly humanoid: a Group of shared-geometry boxes with named limbs so the
 * enemy system can do cheap procedural walk/attack animation. ~6 boxes.
 */
export function makeHumanoid(color) {
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });
  const g = new THREE.Group();

  const torso = new THREE.Mesh(GEO.torso, skin); torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(GEO.head, skin); head.position.y = 1.62; g.add(head);
  const armL = new THREE.Mesh(GEO.limb, skin); armL.position.set(-0.42, 1.08, 0);
  const armR = new THREE.Mesh(GEO.limb, skin); armR.position.set(0.42, 1.08, 0);
  const legL = new THREE.Mesh(GEO.limb, dark); legL.position.set(-0.17, 0.36, 0);
  const legR = new THREE.Mesh(GEO.limb, dark); legR.position.set(0.17, 0.36, 0);
  // pivot limbs at their top so rotation looks like swinging
  for (const [m, py] of [[armL, 1.08], [armR, 1.08], [legL, 0.36], [legR, 0.36]]) {
    m.geometry = GEO.limb; g.add(m); m.userData.baseY = py;
  }
  g.userData = { torso, head, armL, armR, legL, legR, mats: [skin, dark] };
  for (const c of g.children) { c.castShadow = true; c.receiveShadow = false; }
  return g;
}

/** A simple first-person weapon viewmodel parented to the camera. */
export function makeViewmodel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.6, metalness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.6 });
  const blade = new THREE.MeshStandardMaterial({ color: 0xd9dee6, roughness: 0.3, metalness: 0.7 });
  // gun body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), mat); body.position.set(0, 0, -0.25);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), accent); barrel.position.set(0, 0.02, -0.55);
  const knife = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.55), blade); knife.position.set(0, 0, -0.4); knife.visible = false;
  g.add(body, barrel, knife);
  g.position.set(0.34, -0.34, -0.55);
  g.scale.setScalar(0.8);
  g.userData = { body, barrel, knife };
  return g;
}
