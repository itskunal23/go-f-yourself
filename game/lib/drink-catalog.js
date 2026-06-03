/**
 * Known drinks for vision snap + sensible defaults (volume / ABV / roast).
 */

export const DRINK_CATALOG = [
  {
    name: 'Old Monk Rum',
    aliases: ['old monk', 'old monk rum', 'monk rum', 'very old vatted', 'blended rum xxx'],
    category: 'spirit',
    abv: 42.8,
    defaultVolumeMl: 180,
    roast: 'Old Monk? Classic fucking move of someone with childhood trauma and great stories. Drink up, fucker.',
  },
  {
    name: 'Kingfisher Strong Lager',
    aliases: ['kingfisher strong', 'kingfisher strong lager', 'kingfisher'],
    category: 'beer',
    abv: 8,
    defaultVolumeMl: 650,
    roast: 'Strong beer in a 650ml bottle? You\'re clearly fucking planning a blackout. Slow the fuck down, fucker.',
  },
  {
    name: 'Kingfisher Premium Lager',
    aliases: ['kingfisher premium'],
    category: 'beer',
    abv: 5,
    defaultVolumeMl: 650,
    roast: 'Kingfisher Premium — pacing yourself for once? We\'ll see how long that lasts, fucker.',
  },
  {
    name: 'Vodka Shot',
    aliases: ['vodka shot', 'shot of vodka', 'vodka'],
    category: 'shot',
    abv: 40,
    defaultVolumeMl: 40,
    roast: 'Shots already? Some fucker\'s trying to black out before the next round. Bold as fuck.',
  },
];

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Whole-phrase match only — avoids "shot" matching "vodka shot". */
function hayMatchesPhrase(hay, phrase) {
  const p = norm(phrase);
  if (!p || !hay) return false;
  if (hay === p) return true;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(hay);
}

export function calcStandardDrinks(volumeMl, abv) {
  return +((volumeMl * (abv / 100) * 0.789) / 14).toFixed(2);
}

/** @param {object} entry @param {number} [volumeMl] */
export function catalogToDrink(entry, volumeMl) {
  const vol = volumeMl || entry.defaultVolumeMl;
  const abv = entry.abv;
  return {
    name: entry.name,
    category: entry.category,
    abv,
    volumeMl: vol,
    standardDrinks: calcStandardDrinks(vol, abv),
    facts: entry.facts || [],
    confidence: 'high',
    roast: entry.roast || '',
  };
}

/**
 * Match vision JSON to a catalog entry (label text / name field).
 * @param {object} parsed
 * @returns {object | null}
 */
export function matchCatalogDrink(parsed) {
  const hay = norm(`${parsed?.name || ''} ${(parsed?.facts || []).join(' ')}`);
  if (!hay) return null;

  const abv = Number(parsed?.abv ?? parsed?.alcohol_percent);
  const vol = Number(parsed?.volume_ml ?? parsed?.volumeMl ?? parsed?.volume);
  const cat = norm(parsed?.category || '');

  if (/\b(old\s*monk|very old vatted|honeycomb|monk logo|monk head|blended rum)\b/.test(hay)) {
    return catalogToDrink(DRINK_CATALOG[0], pickVolume(parsed, DRINK_CATALOG[0]));
  }

  if (/\bmonk\b/.test(hay) && !/\bkingfisher\b/.test(hay)) {
    return catalogToDrink(DRINK_CATALOG[0], pickVolume(parsed, DRINK_CATALOG[0]));
  }

  if (
    (cat === 'spirit' || abv >= 35)
    && (/\brum\b/.test(hay) || (vol >= 100 && vol <= 500 && abv >= 35))
  ) {
    return catalogToDrink(DRINK_CATALOG[0], pickVolume(parsed, DRINK_CATALOG[0]));
  }

  for (const entry of DRINK_CATALOG) {
    if (entry.name === 'Vodka Shot') {
      if (vol > 80 || cat === 'spirit') continue;
      if (!/\bvodka\b/.test(hay)) continue;
    }
    const names = [entry.name, ...(entry.aliases || [])];
    if (names.some((alias) => hayMatchesPhrase(hay, alias))) {
      return catalogToDrink(entry, pickVolume(parsed, entry));
    }
  }

  return null;
}

function pickVolume(parsed, entry) {
  const vol = Number(parsed?.volume_ml ?? parsed?.volumeMl ?? parsed?.volume);
  const cat = norm(parsed?.category);
  if (entry.category === 'spirit') {
    if (Number.isFinite(vol) && vol > 0 && vol <= 60) return 40;
    if (Number.isFinite(vol) && vol >= 61 && vol <= 250) return 180;
    if (Number.isFinite(vol) && vol >= 251 && vol <= 500) return 375;
    if (Number.isFinite(vol) && vol >= 501 && vol <= 900) return 750;
    return entry.defaultVolumeMl;
  }
  if (Number.isFinite(vol) && vol > 0 && vol <= 2000) return Math.round(vol);
  return entry.defaultVolumeMl;
}

/**
 * Vision sometimes returns beer for a rum bottle — triggers a focused retry.
 * @param {object} parsed
 */
export function drinkNeedsRumRetry(parsed) {
  const name = norm(parsed?.name || '');
  const cat = norm(parsed?.category || '');
  const abv = Number(parsed?.abv ?? parsed?.alcohol_percent);
  const vol = Number(parsed?.volume_ml ?? parsed?.volumeMl);

  if (/\b(old\s*monk|monk\s*rum)\b/.test(name)) return false;
  if (cat === 'spirit' && abv >= 35) return false;

  if (/\bmonk\b/.test(name) && !/\bkingfisher\b/.test(name)) return true;
  if (cat === 'beer' && abv >= 15) return true;
  if (cat === 'beer' && vol > 0 && vol <= 375) return true;

  return false;
}

export function drinkLooksLikeBeerMisparse(parsed) {
  const cat = norm(parsed?.category || '');
  const name = norm(parsed?.name || '');
  if (cat !== 'beer') return false;
  if (/\bkingfisher\b/.test(name)) return false;
  const abv = Number(parsed?.abv);
  const vol = Number(parsed?.volume_ml ?? parsed?.volumeMl);
  if (abv >= 15) return true;
  if (vol > 0 && vol <= 375) return true;
  return false;
}

/** Merge catalog defaults over raw vision fields. */
export function applyCatalogSnap(parsed) {
  const matched = matchCatalogDrink(parsed);
  if (!matched) return null;
  return {
    ...matched,
    facts: Array.isArray(parsed?.facts)?.length ? parsed.facts.slice(0, 4) : matched.facts,
    confidence: parsed?.confidence === 'low' ? 'medium' : (parsed?.confidence || matched.confidence),
  };
}

export function looksLikeBottleSpirit(parsed) {
  const vol = Number(parsed?.volume_ml ?? parsed?.volumeMl ?? parsed?.volume);
  const abv = Number(parsed?.abv ?? parsed?.alcohol_percent);
  const cat = norm(parsed?.category || '');
  return vol > 80 || cat === 'spirit' || (abv >= 35 && vol > 60);
}
