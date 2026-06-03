// ===========================================================================
//  GO FUCK YOURSELF — official Go Fish rules (rule sheet), filthy situation cards.
//  Setup: shuffle → deal 5 each (2–4 players) or 4 each (5–6) → pond for draws.
//  Ask for a situation you hold; miss → "Go fuck yourself!" + draw one; match on
//  draw continues turn. Four of a situation → bank set ("Sweet, I officially have…").
//  52 cards · 13 situations × 4 · most completed sets wins.
// ===========================================================================
import { DEFAULT_CATEGORIES, sanitizeCategories } from './card-categories.js';

export {
  CARD_CATEGORIES, CATEGORY_LIST, categoryMeta, DEFAULT_CATEGORIES, ALL_CATEGORY_IDS, sanitizeCategories,
} from './card-categories.js';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const TOTAL_SETS = RANKS.length;

/** Kunal dom / Nandini sub — real couple lore on every card face + dare */
export const SCENARIOS = {
  // —— FILTHY AF ——
  A: {
    category: 'filthy',
    headline: 'KUNAL\'S WHISKEY DICK',
    line: 'Kunal\'s whiskey dick goes limp mid-fuck and Nandini\'s still grinding on nothing',
    flavor: 'Whiskey won. The hard-on lost.\nNandini\'s still grinding on nothing.',
    title: 'Kunal\'s whiskey dick',
    dare: 'Kunal — say out loud the last time whiskey killed your hard-on inside Nandini. Nandini roasts how long she waited. Lie = chug twice.',
    art: 'whiskeydick',
  },
  2: {
    category: 'filthy',
    headline: 'NANDINI\'S MOUTH WON\'T OPEN',
    line: 'Nandini sucking Kunal\'s dick while Aanchal is right outside the door',
    flavor: 'Aanchal is right outside the door.\nNandini does not care.',
    title: 'Nandini\'s mouth won\'t open',
    dare: 'Nandini — demo the tight-lipped blowjob face that makes Kunal rage, then open wide on command. Hold 10 sec. Chicken = drink.',
    art: 'narrowmouth',
  },
  4: {
    category: 'filthy',
    headline: 'NANDINI SWALLOWS KUNAL\'S LOAD',
    line: 'Nandini swallows every drop of Kunal\'s load while he watches her throat work',
    flavor: 'Every drop. No theatrics.\nKunal watches her throat work.',
    title: 'Nandini swallowing Kunal\'s load',
    dare: 'Nandini — say out loud exactly how you take Kunal\'s cum. Messy or clean. Chicken = shot without wiping. Kunal judges.',
    art: 'swallow',
  },
  8: {
    category: 'filthy',
    headline: 'KUNAL CUMS FAST IN DOGGY',
    line: 'Kunal nuts in ten seconds doggy-style while Nandini\'s still arching for round two',
    flavor: 'Ten seconds. Doggy.\nNandini\'s still arching for round two.',
    title: 'Kunal cumming too fast in doggy',
    dare: 'Kunal — confess your fastest doggy finish on Nandini out loud. Under 60 sec and Nandini spanks you once. Hide it = double drink.',
    art: 'doggycum',
  },

  // —— HEAVY CNC ——
  5: {
    category: 'cnc',
    headline: 'KUNAL FACE-FUCKS NANDINI',
    line: 'Kunal face-fucks Nandini until she\'s drooling, gagging, and begging for air',
    flavor: 'Drool. Gag. Tap for air.\nShe still moans yes.',
    title: 'Kunal face-fucking Nandini',
    dare: 'Safeword first. Kunal holds Nandini\'s head — 10 sec clothed face-fuck practice while she gags. Tap out anytime. Skip = drink twice.',
    art: 'facefuck',
  },
  6: {
    category: 'cnc',
    headline: 'KUNAL OWNS NANDINI\'S ASS',
    line: 'Kunal owns Nandini\'s ass in doggy — gripping her hips like she can\'t escape',
    flavor: 'Doggy. Hips locked.\nShe\'s not going anywhere.',
    title: 'Kunal owning Nandini\'s ass',
    dare: 'Nandini over Kunal\'s knee — three hard spanks, loud. Kunal picks force. Whimper "harder" or drink. Soft taps = Nandini chugs.',
    art: 'doggyspank',
  },
  9: {
    category: 'cnc',
    headline: 'KUNAL CHOKES NANDINI',
    line: 'Kunal chokes Nandini till she taps — eyes water, mascara runs, she still moans yes',
    flavor: 'Hand on throat. Eyes water.\nTap when you need air.',
    title: 'Kunal choking Nandini',
    dare: 'Safeword first. Kunal light hand on Nandini\'s throat 5 sec — eye contact, she taps when done. Skip = drink twice.',
    art: 'choke',
  },
  K: {
    category: 'cnc',
    headline: 'KUNAL CNC RAPE-PLAY',
    line: 'Kunal pins Nandini down CNC-style — she begs him to stop while spreading wider',
    flavor: 'Pinned. Begging him to stop.\nSpreading wider anyway.',
    title: 'Kunal CNC rape-play',
    dare: 'Safeword set. Kunal pins Nandini\'s wrists, she begs stop/start for 15 sec — in character, clothed. Chicken = double.',
    art: 'cncpin',
  },

  // —— KINK ——
  3: {
    category: 'kink',
    headline: 'NANDINI TIRED AT 5 STROKES',
    line: 'Nandini jerks Kunal five times then taps out like her wrist is broken',
    flavor: 'Five strokes. Wrist dead.\nShe taps out like it\'s a sport.',
    title: 'Nandini tired at five strokes',
    dare: 'Nandini — air-stroke Kunal exactly five times then flop your wrist like you\'re dead. Kunal counts. Fake it = drink.',
    art: 'fivestrokes',
  },
  Q: {
    category: 'kink',
    headline: 'KUNAL\'S 45-MIN HOLE HUNT',
    line: 'Kunal hunts Nandini\'s hole for forty-five minutes like he forgot where the pussy is',
    flavor: 'Forty-five minutes. Wrong hole energy.\nGPS would not help.',
    title: 'Kunal\'s forty-five-minute hole hunt',
    dare: 'Kunal — reenact the lost-in-the-pussy compass spin for 10 sec while Nandini narrates "wrong hole" like a GPS. Bail = chug.',
    art: 'losthole',
  },

  // —— FAMILY ROASTS — embarrassment only, never sexual with parents ——
  7: {
    category: 'family',
    headline: 'DAD ALMOST CAUGHT KUNAL & NANDINI',
    line: 'Dad almost walked in on Kunal balls-deep in Nandini on the living room couch',
    flavor: 'Living room couch. Dad\'s footsteps.\nNobody stopped.',
    title: 'dad almost catching Kunal and Nandini',
    dare: 'Whoever drew this — tell the real or worst parent walk-in story. Boring = drink. No lying about who was on top.',
    art: 'familydoor',
  },
  10: {
    category: 'family',
    headline: 'MOM WOULD FAINT AT NANDINI\'S KINK',
    line: 'Mom would literally faint seeing Nandini on all fours taking Kunal like a fucktoy',
    flavor: 'Mom walks in mentally.\nInstant faint. No recovery.',
    title: 'mom fainting at Nandini\'s kink',
    dare: 'Nandini — perform out loud what mom would scream seeing you on all fours for Kunal. Full voice or drink. Kunal adds one filthy detail.',
    art: 'momfaint',
  },
  J: {
    category: 'family',
    headline: 'HORNY-FREAK PARENTS RAISED THEM',
    line: 'Kunal and Nandini were raised by horny freaks — explains every filthy thing they do',
    flavor: 'Raised by horny freaks.\nExplains everything tonight.',
    title: 'horny-freak parents raised them',
    dare: 'Roast who got weirder sex-ed from mom or dad — Kunal vs Nandini. Winner picks loser\'s next drink. Brutal, not sexual with parents.',
    art: 'familyroast',
  },
};

/** Short memorable names for card inspect (Pokémon-style), not the long scenario line */
export const COLLECTIBLE_TITLES = {
  A: 'WHISKEY DICK',
  2: 'MOUTH WON\'T OPEN',
  3: 'FIVE STROKES',
  4: 'SWALLOWS THE LOAD',
  5: 'FACE-FUCK',
  6: 'DOGGY SPANK',
  7: 'DAD WALK-IN',
  8: 'TEN-SECOND DOGGY',
  9: 'CHOKE TAP',
  10: 'MOM WOULD FAINT',
  J: 'HORNY PARENTS',
  Q: 'LOST HOLE HUNT',
  K: 'CNC PIN DOWN',
};

/** Set completion reward flavor per category */
export const CATEGORY_SET_REWARD = {
  filthy: { emoji: '🍺', label: 'FUNCTIONAL ALCOHOLIC' },
  cnc: { emoji: '⛓️', label: 'SAFEWORD OPTIONAL' },
  kink: { emoji: '🎭', label: 'TOY BOX HERO' },
  family: { emoji: '💀', label: 'CHRISTMAS RUINED' },
};

/** Short flavor text for card inspect (2 beats max) */
export function cardFlavor(rank) {
  const m = rankMeta(rank);
  if (m.flavor) return m.flavor;
  const words = String(m.line || '').split(/\s+/);
  if (words.length <= 12) return m.line;
  return `${words.slice(0, 8).join(' ')}…`;
}

export function collectibleTitle(rank) {
  if (COLLECTIBLE_TITLES[rank]) return COLLECTIBLE_TITLES[rank];
  const m = rankMeta(rank);
  if (m.headline) {
    return m.headline
      .replace(/^KUNAL'S\s+/i, '')
      .replace(/^NANDINI'S\s+/i, '')
      .trim()
      .toUpperCase();
  }
  return String(m.title || m.line).split(/\s+/).slice(0, 4).join(' ').toUpperCase();
}

export const rankName = (r) => SCENARIOS[r]?.headline || SCENARIOS[r]?.line || r;
export const rankTitle = (r) => SCENARIOS[r]?.title || String(r).toLowerCase();
export const rankDare = (r) => SCENARIOS[r]?.dare || '';
export const rankCategory = (r) => SCENARIOS[r]?.category || 'filthy';
export const rankMeta = (r) => {
  const s = SCENARIOS[r];
  if (!s) return { line: r, headline: r, title: r, dare: '', art: 'default', category: 'filthy' };
  return { ...s };
};
export const rankAskPhrase = (r) => `Hey, do you have a ${rankTitle(r)}?`;

/** Ranks whose category is in the active set. */
export function ranksForCategories(categories) {
  const allowed = new Set(sanitizeCategories(categories));
  return RANKS.filter((r) => allowed.has(SCENARIOS[r]?.category));
}

export function deckCatalog(categories) {
  return ranksForCategories(categories).map((rank) => {
    const m = rankMeta(rank);
    return { rank, line: m.line, headline: m.headline, title: m.title, category: m.category, art: m.art };
  });
}

function isRankCard(c) {
  return c && c.rank && !c.chaos;
}

function buildDeck(activeRanks) {
  const ranks = activeRanks?.length ? activeRanks : RANKS;
  const deck = [];
  for (const r of ranks) for (const s of SUITS) deck.push({ rank: r, suit: s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export class GoFishGame {
  constructor(players, options = {}) {
    this.activeRanks = ranksForCategories(options.categories);
    if (!this.activeRanks.length) this.activeRanks = ranksForCategories(DEFAULT_CATEGORIES);
    this.totalSets = this.activeRanks.length;
    this.categories = sanitizeCategories(options.categories);

    this.players = players.map((p) => ({ ...p, hand: [], books: [] }));
    this.deck = buildDeck(this.activeRanks);
    this.turnIndex = 0;
    this.finished = false;
    this.winnerId = null;
    this.interactiveSets = options.interactiveSets !== false;

    const dealCount = this.players.length >= 5 ? 4 : 5;
    for (let i = 0; i < dealCount; i++) {
      for (const p of this.players) {
        const card = this.deck.pop();
        if (card) p.hand.push(card);
      }
    }
    for (const p of this.players) this._collectBooks(p, { autoBank: true });
  }

  get current() {
    return this.players[this.turnIndex];
  }

  player(id) {
    return this.players.find((p) => p.id === id);
  }

  askableRanks(playerId = this.current.id) {
    const p = this.player(playerId);
    const set = new Set(p.hand.filter(isRankCard).map((c) => c.rank));
    return this.activeRanks.filter((r) => set.has(r));
  }

  opponents(playerId = this.current.id) {
    return this.players.filter((p) => p.id !== playerId && (p.hand.length > 0 || this.deck.length > 0));
  }

  _findQuads(player) {
    const counts = {};
    for (const c of player.hand.filter(isRankCard)) (counts[c.rank] ||= []).push(c);
    return Object.keys(counts).filter((r) => counts[r].length >= 4);
  }

  _bankRank(player, rank) {
    const matches = player.hand.filter((c) => isRankCard(c) && c.rank === rank);
    if (matches.length < 4) return false;
    player.hand = player.hand.filter((c) => !isRankCard(c) || c.rank !== rank);
    player.books.push(rank);
    return true;
  }

  _collectBooks(player, { autoBank = true } = {}) {
    const quads = this._findQuads(player);
    const banked = [];
    const pending = [];
    for (const r of quads) {
      if (autoBank || !this.interactiveSets) {
        if (this._bankRank(player, r)) banked.push(r);
      } else {
        pending.push(r);
      }
    }
    return { banked, pending };
  }

  peekPendingQuad(playerId) {
    return this._findQuads(this.player(playerId))[0] || null;
  }

  createSet(playerId, rank) {
    const player = this.player(playerId);
    if (!player || !this._findQuads(player).includes(rank)) return null;
    if (!this._bankRank(player, rank)) return null;
    this._checkEnd();
    return rank;
  }

  forceBankQuads(playerId) {
    const player = this.player(playerId);
    if (!player) return [];
    return this._collectBooks(player, { autoBank: true }).banked;
  }

  _totalBooks() {
    return this.players.reduce((n, p) => n + p.books.length, 0);
  }

  _checkEnd() {
    if (this._totalBooks() >= this.totalSets) return this._finish();
    if (this._deckEmpty() && this.players.every((p) => p.hand.filter(isRankCard).length === 0)) {
      return this._finish();
    }
    return false;
  }

  _deckEmpty() {
    return this.deck.length === 0;
  }

  _refillIfEmpty(player) {
    while (player.hand.length === 0 && this.deck.length > 0) {
      player.hand.push(this.deck.pop());
    }
    this._collectBooks(player, { autoBank: !this.interactiveSets });
  }

  _advanceTurn() {
    if (this._checkEnd()) return;

    let guard = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      guard++;
    } while (this.current.hand.length === 0 && this.deck.length === 0 && guard < this.players.length * 2);

    this._refillIfEmpty(this.current);
    this._checkEnd();
  }

  /** Skip current player — used by chaos bottle effects. */
  advanceTurn() {
    this._advanceTurn();
  }

  _finish() {
    this.finished = true;
    let best = -1;
    for (const p of this.players) {
      if (p.books.length > best) {
        best = p.books.length;
        this.winnerId = p.id;
      }
    }
    return true;
  }

  drawFromDeck(playerId, count = 1) {
    const p = this.player(playerId);
    if (!p) return [];
    const drawn = [];
    for (let i = 0; i < count && this.deck.length; i++) {
      const c = this.deck.pop();
      p.hand.push(c);
      drawn.push(c);
    }
    this._collectBooks(p, { autoBank: true });
    return drawn;
  }

  /** Validate ask without mutating state. */
  validateAsk(targetId, rank) {
    if (this.finished) return { error: 'game over' };
    const asker = this.current;
    const target = this.player(targetId);
    if (!target || target.id === asker.id) return { error: 'bad target' };
    if (!asker.hand.some((c) => isRankCard(c) && c.rank === rank)) return { error: 'you must hold that card' };
    const matchCount = target.hand.filter((c) => isRankCard(c) && c.rank === rank).length;
    return { asker, target, matchCount };
  }

  _baseResult(asker, target, rank) {
    return {
      askerId: asker.id,
      askerName: asker.name,
      targetId: target.id,
      targetName: target.name,
      rank,
      rankName: rankName(rank),
      rankTitle: rankTitle(rank),
      category: rankCategory(rank),
      gotCards: 0,
      goFuckYourself: false,
      drewAsked: false,
      newBooks: [],
      pendingCreateSet: null,
      turnEnds: false,
      gameOver: false,
      winnerId: null,
      lied: false,
      honestDenial: false,
    };
  }

  /** Transfer all cards of rank from target to asker (truth). */
  giveRank(targetId, rank) {
    const asker = this.current;
    const target = this.player(targetId);
    const result = this._baseResult(asker, target, rank);
    const matches = target.hand.filter((c) => isRankCard(c) && c.rank === rank);
    if (!matches.length) return { ...result, error: 'no cards' };
    target.hand = target.hand.filter((c) => !(isRankCard(c) && c.rank === rank));
    asker.hand.push(...matches);
    result.gotCards = matches.length;
    this._refillIfEmpty(target);
    return this._finalizeAsk(result, asker);
  }

  /** Ask denied — draw one from the pond. */
  goFish(rank, targetId) {
    const asker = this.current;
    const target = (targetId && this.player(targetId)) || this.opponents(asker.id)[0] || asker;
    const result = this._baseResult(asker, target, rank);
    result.goFuckYourself = true;
    result.honestDenial = true;
    if (this.deck.length > 0) {
      const drawn = this.deck.pop();
      asker.hand.push(drawn);
      if (drawn.rank === rank) result.drewAsked = true;
    }
    return this._finalizeAsk(result, asker);
  }

  /** Lie path — asker draws, defender keeps cards. */
  goFishAfterLie(rank) {
    const res = this.goFish(rank);
    res.lied = true;
    res.honestDenial = false;
    res.goFuckYourself = true;
    return res;
  }

  _finalizeAsk(result, asker) {
    const { banked, pending } = this._collectBooks(asker, { autoBank: !this.interactiveSets });
    result.newBooks = banked;
    result.pendingCreateSet = pending[0] || null;
    const goAgain = result.gotCards > 0 || result.drewAsked;
    if (!goAgain) {
      result.turnEnds = true;
      this._advanceTurn();
    } else {
      this._refillIfEmpty(asker);
    }
    if (this.finished) {
      result.gameOver = true;
      result.winnerId = this.winnerId;
    }
    return result;
  }

  /** Remove one random card from player and give to recipient. */
  stealRandomCard(fromId, toId) {
    const from = this.player(fromId);
    const to = this.player(toId);
    if (!from?.hand.length || !to) return null;
    const i = Math.floor(Math.random() * from.hand.length);
    const [card] = from.hand.splice(i, 1);
    to.hand.push(card);
    return card;
  }

  ask(targetId, rank) {
    const v = this.validateAsk(targetId, rank);
    if (v.error) return v;
    if (v.matchCount > 0) return this.giveRank(targetId, rank);
    return this.goFish(rank);
  }

  scoreboard() {
    return this.players
      .map((p) => ({ id: p.id, name: p.name, books: p.books.length, cards: p.hand.length }))
      .sort((a, b) => b.books - a.books);
  }

  serialize() {
    return {
      players: this.players,
      deckCount: this.deck.length,
      turnIndex: this.turnIndex,
      finished: this.finished,
      winnerId: this.winnerId,
      totalSets: this.totalSets,
      categories: this.categories,
      activeRanks: this.activeRanks,
    };
  }
}
