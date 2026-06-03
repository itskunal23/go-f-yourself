/** @typedef {{ fps: number, drawCalls: number, triangles: number, memoryMb: number, workerMs: number, animations: string[] }} PerfStats */

/**
 * Floating debug overlay for FPS, draw calls, and worker latency.
 */
export class PerformanceMonitor {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'bf-perf';
    this.el.innerHTML = 'FPS — · DC — · TRI —';
    container.appendChild(this.el);
    this.stats = { fps: 0, drawCalls: 0, triangles: 0, memoryMb: 0, workerMs: 0, animations: [] };
    this._frames = 0;
    this._acc = 0;
  }

  /** @param {number} dt @param {THREE.WebGLRenderer} renderer @param {string[]} anims */
  tick(dt, renderer, anims = []) {
    this._frames++;
    this._acc += dt;
    if (this._acc >= 0.5) {
      this.stats.fps = Math.round(this._frames / this._acc);
      this._frames = 0;
      this._acc = 0;
      if (renderer?.info) {
        this.stats.drawCalls = renderer.info.render.calls;
        this.stats.triangles = renderer.info.render.triangles;
      }
      this.stats.memoryMb = performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : 0;
      this.stats.animations = anims;
      this.el.innerHTML =
        `FPS ${this.stats.fps} · DC ${this.stats.drawCalls} · TRI ${this.stats.triangles}<br>` +
        `MEM ${this.stats.memoryMb}MB · WK ${this.stats.workerMs.toFixed(1)}ms<br>` +
        `ANI ${anims.join(', ') || '—'}`;
    }
  }

  setWorkerMs(ms) { this.stats.workerMs = ms; }
  dispose() { this.el.remove(); }
}
