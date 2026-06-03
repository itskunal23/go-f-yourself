// Shared roast-fuel schema — used by profile UI and Bhenchod Bartender prompts.



/** Card onboarding order + friendly titles (one tap at a time) */

export const ONBOARDING_QUESTIONS = [

  {

    key: 'initiator',

    cardTitle: 'Relationship Dynamic',

    emoji: '💑',

    label: 'Who starts the fucking trouble',

    optionsDom: ['I pounce & order them first', 'I tease till they beg to submit', 'I decide when we fuck — always', 'Loser of the game gets used by me', 'I rip their clothes off & take control', 'They wait for my command to touch me', 'Whoever\u2019s drunkest still obeys me'],

    optionsSub: ['They jump me & I submit instantly', 'I beg until they give in & use me', 'They decide when I get touched', 'Loser of the game — I get used', 'They rip my clothes off & take me', 'I wait for their command to touch them', 'Whoever\u2019s drunkest — I still submit to them'],

  },

  {

    key: 'turnOn',

    cardTitle: 'Turn-Ons',

    emoji: '🔥',

    label: 'What makes you want to fuck them stupid',

    optionsDom: ['When they obey without hesitation', 'That submissive fuckable ass', 'When they beg me to use them', 'Their filthy mouth saying yes sir', 'When they go full feral for my cock', 'The fucked-out noises they make for me', 'When they take orders & say fuck me harder', 'Their hands everywhere begging for more', 'When they submit like they\u2019re mine'],

    optionsSub: ['When they own me & use me hard', 'That dominant fucking energy', 'When they order me to my knees', 'Their filthy mouth telling me what to do', 'When they go full feral on me', 'The fucked-out noises I make for them', 'When they choke me & say good girl', 'Their hands controlling every inch of me', 'When they take me like I\u2019m theirs'],

  },

  {

    key: 'ick',

    cardTitle: 'Pet Peeves',

    emoji: '🙄',

    label: 'Instant not-fucking-you killer',

    optionsDom: ['Bratty sub who won\u2019t obey', 'Dead-fish, no fucking effort', 'Won\u2019t go down when ordered', 'Two-pump quitter who taps out', 'Nasty hygiene, hard fuckin\u2019 pass', 'Brings up drama mid-scene', 'Cums in 10 sec & fucks off', 'All talk, can\u2019t submit for shit'],

    optionsSub: ['Selfish dom who never checks in', 'Dead-fish, no fucking effort', 'Won\u2019t go down, fuck that', 'Two-pump fuckin\u2019 chump', 'Nasty hygiene, hard fuckin\u2019 pass', 'Brings up drama mid-fuck', 'Cums in 10 sec & fucks off', 'All talk, can\u2019t dom for shit'],

  },

  {

    key: 'dateNight',

    cardTitle: 'Date Night',

    emoji: '🌙',

    label: 'Dream filthy date night',

    optionsDom: ['Hotel — I cuff them & run the scene', 'Wine then I fuck them senseless', 'Pretend-strangers — I pick them up & take control', 'Strip poker — loser serves me all night', 'Massage that ends with me owning them', 'Backseat — I have my way with them', 'Every surface — they submit room to room'],

    optionsSub: ['Hotel — they cuff me & ruin me', 'Wine then they fuck me senseless', 'Pretend-strangers — they pick me up & use me', 'Strip poker — I lose & serve them all night', 'Massage that ends with them owning me', 'Backseat — they have their way with me', 'Every surface — they take me room to room'],

  },

  {

    key: 'friskyDrink',

    cardTitle: 'Alcohol Personality',

    emoji: '🍷',

    label: 'Drink that turns you into a fuck-demon',

    optionsDom: ['Tequila — I get bossy & take what I want', 'Wine — slow dirty control all night', 'Whiskey — reckless rough dom energy', 'Cocktails — smug & handsy with them', 'Champagne — fancy dom who still commands', 'Beer — down to fuck around & order them', 'Shots — zero regrets, full control'],

    optionsSub: ['Tequila — I get needy & submit fast', 'Wine — slow dirty surrender all night', 'Whiskey — reckless rough sub energy', 'Cocktails — giggly & begging for them', 'Champagne — fancy little fuckslut energy', 'Beer — down to fuck around & obey', 'Shots — zero regrets, full submission'],

  },

  {

    key: 'kink',

    cardTitle: 'Secret Turn-On',

    emoji: '😈',

    label: 'Filthiest secret kink',

    optionsDom: ['Choke them till they tap', 'Tie them up & fucking ruin them', 'Spank them till they can\u2019t sit', 'Filthy degrading dom talk', 'Fuck them with the toys I pick', 'Fuck them where we\u2019ll get caught', 'Daddy owns his babygirl tonight', 'Make them watch me get worshipped', 'Spit, bite & fuck them raw', 'Breed them & mark what\u2019s mine', 'Boring vanilla — I still top'],

    optionsSub: ['Choke me till I tap', 'Tie me up & fucking ruin me', 'Spank me till I can\u2019t fucking sit', 'Filthy degrading sub talk', 'They fuck me with the toys they pick', 'They fuck me where we\u2019ll get caught', 'Daddy fuck your babygirl', 'Watch me get used & obey', 'Spit, bite & fuck me raw', 'Fuck me dumb & breed me', 'Boring vanilla — I still submit'],

  },

  {

    key: 'kinkRank',

    cardTitle: 'Kink Hierarchy',

    emoji: '📊',

    label: 'Pick your top 3 kinks — #1 most turned on',

    type: 'rank',

  },

];



/** How many kinks the player ranks on the hierarchy card */
export const KINK_RANK_TOP_N = 3;

/** Fixed kink palette — same for dom & sub; player ranks most → least */

export const KINK_RANK_OPTIONS = [

  { id: 'family_taboo', label: 'Family taboo', short: 'Family taboo' },

  { id: 'force_cnc', label: 'Force fucking / CNC', short: 'Force / CNC' },

  { id: 'knife_gore', label: 'Knife & gore', short: 'Knife & gore' },

  { id: 'death', label: 'Death kink', short: 'Death kink' },

  { id: 'public', label: 'Public kink', short: 'Public' },

  { id: 'toxic_threesome', label: 'Toxic kink — threesomes & jealousy', short: 'Toxic / 3somes' },

  { id: 'education', label: 'Education kink', short: 'Education' },

  { id: 'swearing', label: 'Swearing kink — saying fuck is a turn-on', short: 'Swearing' },

  { id: 'animals', label: 'Being animals kink', short: 'Animal play' },

];



const KINK_RANK_IDS = new Set(KINK_RANK_OPTIONS.map((o) => o.id));



export function parseKinkRank(val) {

  let ids = [];

  if (Array.isArray(val)) ids = val.map(String).filter((id) => KINK_RANK_IDS.has(id));

  else if (val) ids = String(val).split(',').map((s) => s.trim()).filter((id) => KINK_RANK_IDS.has(id));

  return ids.slice(0, KINK_RANK_TOP_N);

}



export function serializeKinkRank(ids) {

  return parseKinkRank(ids).join(',');

}



export function kinkRankComplete(val) {

  return parseKinkRank(val).length >= KINK_RANK_TOP_N;

}



export function kinkRankLabel(id) {

  return KINK_RANK_OPTIONS.find((o) => o.id === id)?.label || id;

}



/** Kunal = dom, Nandini = sub — locked by display name */

export function inferPlayRole(name = '') {

  const n = String(name).toLowerCase();

  if (n.includes('nandini')) return 'sub';

  if (n.includes('kunal')) return 'dom';

  return null;

}



export function isRoleLocked(name = '') {

  return inferPlayRole(name) !== null;

}



/** Questions with role-appropriate option sets */

export function questionsForRole(role = 'dom') {

  const r = role === 'sub' ? 'sub' : 'dom';

  return ONBOARDING_QUESTIONS.map((q) => {

    if (q.type === 'rank') return { ...q, options: KINK_RANK_OPTIONS };

    return {

      ...q,

      options: r === 'sub' ? q.optionsSub : q.optionsDom,

    };

  });

}



export const QUESTIONNAIRE_FIELDS = ONBOARDING_QUESTIONS.map(({ key, label, optionsDom, type }) => ({

  key,

  label,

  type: type || 'choice',

  options: type === 'rank' ? KINK_RANK_OPTIONS : optionsDom,

}));



const LABEL_BY_KEY = Object.fromEntries(QUESTIONNAIRE_FIELDS.map((f) => [f.key, f.label]));



export function questionnaireComplete(q = {}) {

  return QUESTIONNAIRE_FIELDS.every((f) => {

    if (f.type === 'rank') return kinkRankComplete(q[f.key]);

    return q[f.key] && String(q[f.key]).trim();

  });

}



export function missingQuestionnaireKeys(q = {}) {

  return QUESTIONNAIRE_FIELDS.filter((f) => {

    if (f.type === 'rank') return !kinkRankComplete(q[f.key]);

    return !q[f.key] || !String(q[f.key]).trim();

  }).map((f) => f.key);

}



/** Human-readable block for LLM prompts */

export function formatQuestionnaireBlock(q = {}, name = 'Player', playRole = null) {

  const role = playRole === 'sub' ? 'sub' : playRole === 'dom' ? 'dom' : null;

  const roleLine = role ? `Play role tonight: ${role === 'dom' ? 'DOM (always tops / orders)' : 'SUB (always submits / obeys)'}` : '';

  const lines = QUESTIONNAIRE_FIELDS.map((f) => {

    if (f.type === 'rank') {

      const ids = parseKinkRank(q[f.key]);

      if (!ids.length) return `- ${f.label}: (not answered — roast them for skipping)`;

      const ranked = ids.map((id, i) => `${i + 1}. ${kinkRankLabel(id)}`).join('; ');

      return `- ${f.label}: ${ranked}`;

    }

    const v = q[f.key];

    if (!v || !String(v).trim()) return `- ${f.label}: (not answered — roast them for skipping)`;

    return `- ${f.label}: "${String(v).trim()}"`;

  });

  const header = roleLine ? `${name}'s roast fuel (${roleLine}):\n` : `${name}'s roast fuel:\n`;

  return header + lines.join('\n');

}



/** Pick a random answered field for offline roasts */

export function pickQuestionnaireHook(q = {}) {

  const topKink = parseKinkRank(q.kinkRank)[0];

  if (topKink) {

    return { key: 'kinkRank', label: 'Top kink', value: kinkRankLabel(topKink) };

  }

  const answered = QUESTIONNAIRE_FIELDS.filter((f) => {

    if (f.type === 'rank') return kinkRankComplete(q[f.key]);

    return q[f.key] && String(q[f.key]).trim();

  });

  if (!answered.length) return null;

  const field = answered[Math.floor(Math.random() * answered.length)];

  if (field.type === 'rank') {

    const ids = parseKinkRank(q[field.key]);

    const pick = ids[Math.floor(Math.random() * ids.length)];

    return { key: field.key, label: field.label, value: kinkRankLabel(pick) };

  }

  return { key: field.key, label: field.label, value: String(q[field.key]).trim() };

}



export function questionnaireLabel(key) {

  return LABEL_BY_KEY[key] || key;

}


