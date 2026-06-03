import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js';

/**
 * Progressive GLB/texture loader with in-memory cache.
 */
export class AssetManager {
  constructor() {
    /** @type {Map<string, unknown>} */
    this.cache = new Map();
    this.loader = new GLTFLoader();
    this.loading = new Map();
  }

  /** @param {string} url @param {(p: number)=>void} [onProgress] */
  async loadGLB(url, onProgress) {
    if (this.cache.has(url)) return this.cache.get(url);
    if (this.loading.has(url)) return this.loading.get(url);

    const p = new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => { this.cache.set(url, gltf); this.loading.delete(url); resolve(gltf); },
        (ev) => { if (ev.total && onProgress) onProgress(ev.loaded / ev.total); },
        (err) => { this.loading.delete(url); reject(err); }
      );
    });
    this.loading.set(url, p);
    return p;
  }

  /** @param {string} key @param {unknown} data */
  put(key, data) { this.cache.set(key, data); }

  /** @param {string} key */
  get(key) { return this.cache.get(key); }

  clear() { this.cache.clear(); }
}
