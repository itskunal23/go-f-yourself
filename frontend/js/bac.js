// ===========================================================================
//  BAC / DRUNK-LEVEL ENGINE
//  Uses the Watson Total Body Water model (accounts for age, height, weight,
//  sex) combined with Widmark elimination. Maps BAC -> a 0..10 drunk score.
//  5 = buzzed, 10 = blackout.  Educational estimate, NOT medical advice.
// ===========================================================================

const ETHANOL_DENSITY = 0.789; // g/ml
const BLOOD_WATER_FRACTION = 0.806; // fraction of whole blood that is water
const METABOLISM_PER_HOUR = 0.015; // % BAC eliminated per hour (g/dL/hr)

// Watson Total Body Water (litres).
export function totalBodyWaterLitres({ sex, age, heightCm, weightKg }) {
  const a = Number(age) || 25;
  const h = Number(heightCm) || 170;
  const w = Number(weightKg) || 70;
  if (String(sex).toLowerCase().startsWith('f')) {
    return Math.max(10, -2.097 + 0.1069 * h + 0.2466 * w);
  }
  return Math.max(10, 2.447 - 0.09516 * a + 0.1074 * h + 0.3362 * w);
}

// grams of pure alcohol in a drink
export function alcoholGrams({ volumeMl, abv }) {
  return (Number(volumeMl) || 0) * ((Number(abv) || 0) / 100) * ETHANOL_DENSITY;
}

// One "standard drink" = 14 g pure alcohol (US standard).
export function standardDrinks({ volumeMl, abv }) {
  return alcoholGrams({ volumeMl, abv }) / 14;
}

// Compute current BAC (% g/dL) given a player profile and a list of drinks.
// Each drink: { volumeMl, abv, at: epochMillis }
export function computeBAC(profile, drinks, nowMs = Date.now()) {
  const tbw = totalBodyWaterLitres(profile);
  let bac = 0;
  for (const d of drinks) {
    const gA = alcoholGrams(d);
    if (gA <= 0) continue;
    // peak contribution of this drink to whole-blood alcohol concentration
    const contribution = (gA / (tbw * 1000)) * BLOOD_WATER_FRACTION * 100; // g/dL
    const hours = Math.max(0, (nowMs - (d.at ?? nowMs)) / 3_600_000);
    const eliminated = METABOLISM_PER_HOUR * hours;
    bac += Math.max(0, contribution - eliminated);
  }
  return Math.max(0, +bac.toFixed(4));
}

// Map BAC -> 0..10 drunk level via interpolated breakpoints.
// 0.08% -> 5 (buzzed), 0.35% -> 10 (blackout).
const BREAKPOINTS = [
  [0.0, 0],
  [0.03, 2],
  [0.08, 5],
  [0.15, 7],
  [0.25, 9],
  [0.35, 10],
];

export function drunkLevelFromBAC(bac) {
  if (bac <= 0) return 0;
  for (let i = 1; i < BREAKPOINTS.length; i++) {
    const [b0, l0] = BREAKPOINTS[i - 1];
    const [b1, l1] = BREAKPOINTS[i];
    if (bac <= b1) {
      const t = (bac - b0) / (b1 - b0);
      return +(l0 + t * (l1 - l0)).toFixed(1);
    }
  }
  return 10;
}

export function levelLabel(level) {
  if (level <= 0.5) return 'Stone Cold Sober';
  if (level < 2) return 'Warming Up';
  if (level < 4) return 'Tipsy';
  if (level < 5.5) return 'Buzzed';
  if (level < 7) return 'Properly Drunk';
  if (level < 8.5) return 'Wasted';
  if (level < 9.5) return 'Shitfaced';
  return 'BLACKOUT — STOP';
}

export function levelColor(level) {
  if (level < 4) return '#37d67a';
  if (level < 5.5) return '#ffd23f';
  if (level < 7) return '#ff8c42';
  if (level < 8.5) return '#ff5757';
  return '#c026d3';
}

// Convenience: full status object for a player.
export function playerStatus(profile, drinks, nowMs = Date.now()) {
  const bac = computeBAC(profile, drinks, nowMs);
  const level = drunkLevelFromBAC(bac);
  return {
    bac,
    level,
    label: levelLabel(level),
    color: levelColor(level),
    totalStandardDrinks: +drinks.reduce((s, d) => s + standardDrinks(d), 0).toFixed(2),
    shouldStop: level >= 8,
    shouldWarn: level >= 5.5,
  };
}
