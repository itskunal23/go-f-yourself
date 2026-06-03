/** Sarcastic party host — roasts, punishments, chaos events. */

const ROASTS = [
  (name) => `Of all the people here...\nit somehow picked the biggest liability.`,
  (name) => `"Bad luck, ${name.split(' ')[0]}." — The bottle, probably.`,
  (name) => `The bottle has spoken.\nAnd it said "${name.split(' ')[0]} is cooked."`,
  (name) => `Everyone saw that coming.\nExcept ${name.split(' ')[0]}, apparently.`,
  (name) => `${name.split(' ')[0]}'s liver just sighed audibly.`,
  (name) => `Congratulations, ${name.split(' ')[0]}.\nYou're the problem now.`,
  (name) => `The universe looked at ${name.split(' ')[0]} and said "yeah, them."`,
  (name) => `Not ${name.split(' ')[0]} again!\n...Just kidding. Yes, again.`,
  (name) => `${name.split(' ')[0]} was having such a good night too.`,
  (name) => `Statistically unfair.\nEmotionally perfect.`,
  (name) => `The bottle didn't land on ${name.split(' ')[0]}.\nIt hunted them.`,
  (name) => `Somewhere, ${name.split(' ')[0]}'s dignity just filed for divorce.`,
  (name) => `Bold choice, bottle.\nVery bold.`,
  (name) => `${name.split(' ')[0]} — chosen by fate, cursed by friends.`,
  (name) => `If embarrassment was a sport,\n${name.split(' ')[0]} just made the podium.`,
  (name) => `The bottle paused on ${name.split(' ')[0]} like it was savoring the moment.`,
  (name) => `Plot twist: it's ${name.split(' ')[0]}.\nPlot twist rejected by everyone.`,
  (name) => `${name.split(' ')[0]} drew the short straw.\nThe straw was a bottle.`,
];

const PUNISHMENTS = {
  drink: {
    icon: '🥃',
    label: 'Drink',
    items: [
      { text: 'Take 1 shot', drinks: 1 },
      { text: 'Take 2 shots', drinks: 2 },
      { text: 'Chug your drink', drinks: 1, chug: true },
      { text: 'Finish what\'s in your cup', drinks: 1 },
      { text: 'Waterfall — don\'t stop until the person to your right stops', drinks: 2 },
    ],
  },
  confession: {
    icon: '😳',
    label: 'Confession',
    items: [
      { text: 'Confess your most embarrassing drunk story', drinks: 0 },
      { text: 'Admit the wildest thing you\'ve done with your partner', drinks: 0 },
      { text: 'Reveal a kink you\'ve never said out loud', drinks: 0 },
      { text: 'Tell the group something you\'ve never said out loud', drinks: 0 },
    ],
  },
  dare: {
    icon: '🔥',
    label: 'Dare',
    items: [
      { text: 'Do your best seductive dance for 15 seconds', drinks: 0 },
      { text: 'Whisper the filthiest thing you\'d do to your partner tonight', drinks: 0 },
      { text: 'Swap an item of clothing with someone', drinks: 0 },
      { text: 'Serenade the person next to you', drinks: 0 },
    ],
  },
  truth: {
    icon: '💬',
    label: 'Truth',
    items: [
      { text: 'Who in this room would you kiss right now?', drinks: 0 },
      { text: 'What\'s the wildest thing on your bucket list?', drinks: 0 },
      { text: 'What\'s your biggest turn-on nobody knows?', drinks: 0 },
      { text: 'What secret are you keeping from someone here?', drinks: 0 },
    ],
  },
  selfie: {
    icon: '📸',
    label: 'Selfie',
    items: [
      { text: 'Pull the ugliest face you can for 5 seconds — group judges', drinks: 0 },
      { text: 'Group photo pose — most ridiculous faces only', drinks: 0 },
      { text: 'Strike a pose with the person the bottle landed on', drinks: 0 },
    ],
  },
  sing: {
    icon: '🎤',
    label: 'Sing',
    items: [
      { text: 'Sing the chorus of the last song you heard', drinks: 0 },
      { text: 'Rap battle the person to your left — loser drinks', drinks: 1 },
      { text: 'Sing "Happy Birthday" like you mean it', drinks: 0 },
    ],
  },
  flirt: {
    icon: '💋',
    label: 'Flirt',
    items: [
      { text: 'Give your partner your best 10-second lap dance', drinks: 0 },
      { text: 'Describe your partner in three filthy words — out loud', drinks: 0 },
      { text: 'Whisper what you want done to you tonight', drinks: 0 },
    ],
  },
};

const SPECIAL_EVENTS = [
  {
    id: 'chaos',
    icon: '⚠️',
    title: 'CHAOS ROUND',
    desc: 'Everyone drinks. No exceptions. No lawyers.',
    everyoneDrinks: true,
    drinks: 1,
  },
  {
    id: 'king',
    icon: '👑',
    title: "KING'S RULE",
    desc: 'The spinner makes a rule that lasts 3 rounds. Break it = drink.',
    spinnerRule: true,
  },
  {
    id: 'double',
    icon: '💀',
    title: 'DOUBLE TROUBLE',
    desc: 'The victim AND the spinner both drink. Twice.',
    spinnerDrinks: true,
    drinks: 2,
  },
  {
    id: 'spin2',
    icon: '🔄',
    title: 'SPIN TWICE',
    desc: 'Land on someone? Nope. Spin again immediately.',
    spinTwice: true,
  },
];

class ShuffleBag {
  constructor(items) {
    this.all = items;
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) {
      this.bag = [...this.all].sort(() => Math.random() - 0.5);
    }
    return this.bag.pop();
  }
}

export class PartyHost {
  constructor() {
    this.roastBag = new ShuffleBag(ROASTS);
    this.recentRoasts = new Set();
    this.lastEventRound = -3;
  }

  getRoast(target) {
    let roast = this.roastBag.next();
    let attempts = 0;
    while (this.recentRoasts.has(roast) && attempts < 8) {
      roast = this.roastBag.next();
      attempts++;
    }
    this.recentRoasts.add(roast);
    if (this.recentRoasts.size > 10) {
      const first = this.recentRoasts.values().next().value;
      this.recentRoasts.delete(first);
    }
    return roast(target.name);
  }

  getPunishment(modeId = 'party') {
    const weights =
      modeId === 'truth'
        ? { truth: 3, dare: 2, drink: 1, confession: 2, selfie: 1, sing: 1, flirt: 1 }
        : modeId === 'challenge'
          ? { dare: 3, sing: 2, selfie: 2, drink: 2, truth: 1, confession: 1, flirt: 2 }
          : { drink: 2, dare: 2, truth: 2, confession: 2, selfie: 1, sing: 1, flirt: 2 };

    const pool = [];
    for (const [key, w] of Object.entries(weights)) {
      for (let i = 0; i < w; i++) pool.push(key);
    }
    const typeKey = pool[Math.floor(Math.random() * pool.length)];
    const type = PUNISHMENTS[typeKey];
    const item = type.items[Math.floor(Math.random() * type.items.length)];
    return {
      type: typeKey,
      icon: type.icon,
      label: type.label,
      text: item.text,
      drinks: item.drinks || 0,
      chug: item.chug,
      alt: item.alt,
    };
  }

  maybeSpecialEvent(round) {
    if (round - this.lastEventRound < 2) return null;
    if (Math.random() > 0.05) return null;
    const event = SPECIAL_EVENTS[Math.floor(Math.random() * SPECIAL_EVENTS.length)];
    this.lastEventRound = round;
    return { ...event };
  }

  getRefusalPenalty() {
    return { text: '+2 DRINKS for refusing', drinks: 2 };
  }

  getDoubleDownPenalty(base) {
    return {
      ...base,
      text: `DOUBLE DOWN: ${base.text} — again, but worse`,
      drinks: (base.drinks || 0) + 2,
    };
  }
}

export { PUNISHMENTS, SPECIAL_EVENTS };
