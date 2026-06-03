// ===========================================================================
//  progress.js — persistent progression in localStorage: weapon unlocks,
//  character customization, achievements and per-mode best scores.
// ===========================================================================
import { WEAPONS, ACHIEVEMENTS } from './config.js';

const KEY = 'bf3d_save_v1';

const DEFAULT = {
  totalScore: 0,
  best: { endless: 0, boss: 0, timeattack: 0 },
  unlocked: ['knife', 'pistol'],
  achievements: {},
  custom: { color: '#19e6ff' },
};

export const PlayerColors = ['#19e6ff', '#ff2d95', '#37d67a', '#ffd23f', '#b026ff', '#ff5a3c'];

export class Progress {
  constructor() { this.data = this._load(); this._reconcileUnlocks(); }
  _load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.best) return { ...DEFAULT, ...d }; } catch {}
    return structuredClone(DEFAULT);
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {} }

  // unlock any weapon whose lifetime-score threshold is met
  _reconcileUnlocks() {
    for (const [id, w] of Object.entries(WEAPONS)) {
      if (w.unlock != null && this.data.totalScore >= w.unlock && !this.data.unlocked.includes(id)) {
        this.data.unlocked.push(id);
      }
    }
  }
  get unlocked() { return this.data.unlocked.slice(); }
  get color() { return this.data.custom.color; }
  setColor(c) { this.data.custom.color = c; this.save(); }

  /** Returns array of newly-unlocked weapon ids after adding score. */
  addRunResult(mode, score, stats) {
    const newlyUnlocked = [];
    this.data.totalScore += score;
    if (score > (this.data.best[mode] || 0)) this.data.best[mode] = score;
    for (const [id, w] of Object.entries(WEAPONS)) {
      if (w.unlock != null && this.data.totalScore >= w.unlock && !this.data.unlocked.includes(id)) {
        this.data.unlocked.push(id); newlyUnlocked.push(id);
      }
    }
    this._checkAchievements(stats, score);
    this.save();
    return newlyUnlocked;
  }

  _checkAchievements(stats = {}, score = 0) {
    const grant = (id) => { if (!this.data.achievements[id]) { this.data.achievements[id] = Date.now(); this._lastGranted ||= []; this._lastGranted.push(id); } };
    this._lastGranted = [];
    if (stats.kills >= 1) grant('first_blood');
    if (stats.kills >= 50) grant('kill_50');
    if (stats.kills >= 150) grant('kill_150');
    if (stats.wave >= 10) grant('wave_10');
    if (stats.bossKills >= 1) grant('boss_down');
    if (score >= 5000) grant('score_5000');
  }
  get lastGranted() { return (this._lastGranted || []).map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean); }
  hasAchievement(id) { return !!this.data.achievements[id]; }
}
