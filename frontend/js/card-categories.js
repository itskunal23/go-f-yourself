// Card situation categories — color + label for UI and rules.

export const CARD_CATEGORIES = {
  filthy: {
    id: 'filthy',
    label: 'Filthy AF',
    short: 'Filthy',
    emoji: '🔥',
    color: '#ff453a',
    accent: '#ff6b2c',
    desc: 'Raw, explicit, no-filter sexual situations.',
  },
  cnc: {
    id: 'cnc',
    label: 'Heavy CNC',
    short: 'CNC',
    emoji: '⛓️',
    color: '#bf5af2',
    accent: '#8b5cf6',
    desc: 'Consensual force fantasy — safewords, partner only, in the room.',
  },
  kink: {
    id: 'kink',
    label: 'Kink',
    short: 'Kink',
    emoji: '🎭',
    color: '#ff6482',
    accent: '#ec4899',
    desc: 'Pet play, spanking, toys, pegging, specific fetishes.',
  },
  family: {
    id: 'family',
    label: 'Family Roasts',
    short: 'Family',
    emoji: '💀',
    color: '#ffd60a',
    accent: '#f59e0b',
    desc: 'Dark parent jokes — walk-ins, embarrassment, upbringing roasts. Never sexual with parents.',
  },
};

export function categoryMeta(id) {
  return CARD_CATEGORIES[id] || CARD_CATEGORIES.filthy;
}

export const CATEGORY_LIST = Object.values(CARD_CATEGORIES);
export const ALL_CATEGORY_IDS = Object.keys(CARD_CATEGORIES);
/** One category per round — default deck for new rooms */
export const DEFAULT_CATEGORY = 'filthy';
export const DEFAULT_CATEGORIES = [DEFAULT_CATEGORY];

/** Normalize to exactly one valid category id (first pick wins). */
export function sanitizeCategories(raw) {
  if (!Array.isArray(raw) || !raw.length) return [...DEFAULT_CATEGORIES];
  const first = raw.find((id) => CARD_CATEGORIES[id]);
  return first ? [first] : [...DEFAULT_CATEGORIES];
}

export function activeCategoryId(categories) {
  return sanitizeCategories(categories)[0];
}
