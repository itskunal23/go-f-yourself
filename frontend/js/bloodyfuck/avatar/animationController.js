import * as THREE from '/vendor/three/three.module.js';

/**
 * AnimationMixer with crossfade between idle / walk / talk clips.
 */
export class AnimationController {
  /** @param {THREE.Object3D} root @param {THREE.AnimationClip[]} clips */
  constructor(root, clips) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    /** @type {Map<string, THREE.AnimationAction>} */
    this.actions = new Map();
    this.current = null;
    this.upperWeight = 0;
    this._proceduralIdle = false;

    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      this.actions.set(clip.name.toLowerCase(), action);
    }

    if (this.actions.size === 0 && root.userData.isProcedural) {
      this._proceduralIdle = true;
    }
  }

  /** @param {string} name @param {number} [fade=0.35] */
  play(name, fade = 0.35) {
    const key = name.toLowerCase();
    const next = this.actions.get(key);
    if (!next) return;
    if (this.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  /** Blend upper-body talk on procedural avatar via sine idle */
  /** @param {number} dt @param {number} talkAmt */
  update(dt, talkAmt = 0) {
    this.mixer.update(dt);
    if (this._proceduralIdle && this.root.userData.parts) {
      const t = performance.now() * 0.001;
      const breathe = Math.sin(t * 1.2) * 0.012;
      const torso = this.root.userData.parts.torso;
      if (torso) torso.scale.y = 1 + breathe;
      const head = this.root.userData.parts.head;
      if (head) head.rotation.y = Math.sin(t * 0.4) * 0.06;
      const la = this.root.userData.parts.leftArm;
      const ra = this.root.userData.parts.rightArm;
      if (la) la.rotation.z = 0.35 + Math.sin(t * 0.8) * 0.04 + talkAmt * 0.1;
      if (ra) ra.rotation.z = -0.35 - Math.sin(t * 0.8) * 0.04;
    }
  }

  /** @returns {string[]} */
  activeNames() {
    const out = [];
    this.actions.forEach((a, k) => { if (a.isRunning() && a.getEffectiveWeight() > 0.05) out.push(k); });
    if (this._proceduralIdle) out.push('idle-proc');
    return out;
  }

  dispose() { this.mixer.stopAllAction(); }
}
