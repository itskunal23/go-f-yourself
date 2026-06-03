// ===========================================================================
//  config.js — central tunables for the Bloody Fuck 3D survival game.
//  Keep all balance / content data here so systems stay logic-only.
// ===========================================================================

export const ARENA = {
  size: 60,          // half-extent of the square arena floor (world units)
  wallHeight: 6,
  obstacleCount: 26, // instanced crates/pillars for cover + avoidance
};

export const PLAYER = {
  height: 1.7,
  radius: 0.4,
  walkSpeed: 6.0,
  sprintSpeed: 9.6,
  accel: 60,
  friction: 12,
  maxHp: 100,
  maxStamina: 100,
  staminaDrain: 26,    // per second while sprinting
  staminaRegen: 18,    // per second otherwise
  lookSpeed: 2.6,      // radians/sec at full stick deflection (touch)
  mouseSens: 0.0022,
  pitchClamp: 1.4,
};

// Weapons: melee (range arc) + firearms (hitscan). Damage in HP.
export const WEAPONS = {
  knife:   { name: 'Knife',   kind: 'melee',  dmg: 34, range: 2.6, arc: 0.7, rate: 320, knock: 4, unlock: 0 },
  pistol:  { name: 'Pistol',  kind: 'gun',    dmg: 26, range: 80, rate: 300, mag: 12, reload: 900, spread: 0.012, knock: 3, pellets: 1, unlock: 0 },
  smg:     { name: 'SMG',     kind: 'gun',    dmg: 16, range: 70, rate: 95,  mag: 30, reload: 1100, spread: 0.04, knock: 2, pellets: 1, unlock: 1500 },
  shotgun: { name: 'Shotgun', kind: 'gun',    dmg: 11, range: 34, rate: 720, mag: 6,  reload: 1500, spread: 0.13, knock: 7, pellets: 8, unlock: 4000 },
};

export const ENEMIES = {
  melee:  { name: 'Thug',   hp: 60,  speed: 3.0, dmg: 9,  reach: 1.9, attackCd: 900,  color: 0x9c6b46, scale: 1.0,  score: 10, knockResist: 1 },
  runner: { name: 'Runner', hp: 32,  speed: 6.4, dmg: 6,  reach: 1.7, attackCd: 700,  color: 0x37d6c0, scale: 0.86, score: 14, knockResist: 0.7 },
  heavy:  { name: 'Brute',  hp: 180, speed: 1.9, dmg: 22, reach: 2.4, attackCd: 1300, color: 0xb5662f, scale: 1.45, score: 28, knockResist: 2.4 },
  boss:   { name: 'Warden', hp: 1400, speed: 2.4, dmg: 34, reach: 3.2, attackCd: 1100, color: 0xff2d55, scale: 2.4, score: 250, knockResist: 6 },
};

export const MODES = {
  endless:    { id: 'endless',    name: 'Endless Survival', icon: '♾️', desc: 'Survive endless escalating waves.' },
  boss:       { id: 'boss',       name: 'Boss Waves',       icon: '☠️', desc: 'Clear waves, fight a boss every 5th.' },
  timeattack: { id: 'timeattack', name: 'Time Attack',      icon: '⏱️', desc: 'Max score in 120 seconds.' },
};

export const TIME_ATTACK_SECONDS = 120;
export const MAX_ENEMIES = 34;       // hard cap for mobile perf
export const MAX_ENEMIES_LOW = 20;   // cap on low quality tier

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Kill your first enemy.' },
  { id: 'kill_50', name: 'Butcher', desc: 'Kill 50 enemies in one run.' },
  { id: 'kill_150', name: 'Massacre', desc: 'Kill 150 enemies in one run.' },
  { id: 'wave_10', name: 'Survivor', desc: 'Reach wave 10.' },
  { id: 'boss_down', name: 'Warden Slayer', desc: 'Kill a boss.' },
  { id: 'score_5000', name: 'High Roller', desc: 'Score 5000 in a run.' },
];
