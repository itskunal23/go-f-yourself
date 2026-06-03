/** Drunk meter — party-friendly emoji tiers. */

const TIERS = [
  { max: 1, emoji: '😐', label: 'Sober' },
  { max: 3, emoji: '🙂', label: 'Buzzed' },
  { max: 5, emoji: '😏', label: 'Feeling It' },
  { max: 8, emoji: '🤪', label: 'Gone' },
  { max: 10, emoji: '💀', label: 'Disaster' },
];

export function drunkTier(level) {
  for (const t of TIERS) {
    if (level <= t.max) return t;
  }
  return TIERS[TIERS.length - 1];
}

/** Session drinks stack on top of BAC from profile when available. */
export function sessionDrunkLevel(player, bacLevel = 0) {
  const session = player.sessionDrinks || 0;
  const bonus = Math.min(4, session * 0.6);
  return Math.min(10, +(bacLevel + bonus).toFixed(1));
}

export function addSessionDrink(player, count = 1) {
  player.sessionDrinks = (player.sessionDrinks || 0) + count;
}

export function playerDrunkDisplay(player, bacStatus = null) {
  const bacLevel = bacStatus?.level ?? 0;
  const level = sessionDrunkLevel(player, bacLevel);
  const tier = drunkTier(level);
  return { level, ...tier, color: bacStatus?.color || tierColor(level) };
}

function tierColor(level) {
  if (level < 2) return '#37d67a';
  if (level < 4) return '#ffd23f';
  if (level < 6) return '#ff8c42';
  if (level < 8) return '#ff5757';
  return '#c026d3';
}

export { TIERS };
