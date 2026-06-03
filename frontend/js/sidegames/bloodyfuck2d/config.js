/** Game constants — tuned for 60+ FPS on mobile. */
export const CFG = {
  gravity: 1.1,
  worldW: 2400,
  worldH: 720,
  groundY: 580,
  maxParticles: 140,
  maxEnemies: 8,
  player: {
    w: 42,
    h: 78,
    speed: 5.2,
    jump: -11.5,
    maxHp: 100,
    punchDmg: 18,
    heavyDmg: 34,
  },
  enemy: {
    w: 40,
    h: 76,
    speed: 2.4,
    dmg: 12,
    hp: 55,
    spawnInterval: 4200,
  },
};
