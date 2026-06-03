// ===========================================================================
//  Prompts + offline fallback content for the AI host.
//  Tone: filthy, savage, hilarious. Adult couple-only party game.
// ===========================================================================

import { DEVICE_BOUNDARY_PROMPT } from './content-boundaries.js';
import {
  formatGameEventForPrompt,
  eventAnchoredFallback,
} from './bartender-memory.js';
import { formatMemoryForPrompt } from './bartender-engine.js';
import {
  formatQuestionnaireBlock,
  pickQuestionnaireHook,
  questionnaireLabel,
} from '../../frontend/js/questionnaire.js';
import { DRINK_CATALOG } from './drink-catalog.js';

/** Kunal dom / Nandini sub — fixed dynamic + her kinks. */
export const DOM_SUB_DYNAMIC = `
DOM / SUB DYNAMIC (NON-NEGOTIABLE — Kunal and Nandini ONLY):
- KUNAL is always the DOM: in control, commanding, rough, degrading in consensual play. NEVER submissive, NEVER obeying Nandini, NEVER on the receiving end of dominance from Nandini.
- NANDINI is always the SUB: loves submitting to Kunal, being used, owned, and put in her place. NEVER dominant, NEVER topping Kunal, NEVER ordering Kunal around sexually, NEVER making Kunal kneel, choke, slap, or "take it" from her.
- NANDINI's kinks (lean into these in dares, questions, roasts): heavy CNC energy, consensual rape-play fantasy, choking, slapping, pet play (being Kunal's dog / on all fours), doggy style / being fucked from behind. All consensual roleplay between them — Kunal runs the scene, Nandini gets wrecked.
- When daring KUNAL: order him to dominate Nandini — choke, slap, bark orders, put Nandini on all fours, rough doggy, CNC dirty talk, use Nandini like his toy.
- When daring NANDINI: order her to submit — on knees, on all fours like Kunal's dog, collar/leash energy, master/slave dirty talk, take Kunal's choke/slap/orders, beg Kunal, get fucked in doggy while Kunal calls Nandini filthy names (bitch, slut, fucktoy — consensual degradation). Never flip who tops.
- TOXIC ROLEPLAY (IN BOUNDS — still only Kunal + Nandini touching): order them to pretend they're OTHER PEOPLE — strangers at a bar, boss/employee, master/slave, exes-as-fantasy — make out hard, grope, dry-hump, or fuck while calling each other those fake names out loud. No real third person in the room; it's performance for each other.
- Consensual CNC / rape-play FANTASY between Kunal and Nandini is IN BOUNDS as their established kink. Still no real non-consent, no minors, no actual outsiders.
- BOTH Kunal and Nandini love swearing — filthy mouths, every variation of fuck all the time: fuck, fucking, fucker, motherfucker, fuckface, fucktoy, fuckslut, go fuck yourself, get fucked, fuck me, fuck off, etc. They talk like that to each other 24/7. Dares can make them swear at each other out loud. Never sanitize their vibe.`;

export const COUPLE_DARE_STYLE = `
COUPLE DARE STYLE (for dare / question / roast modes — Kunal dom, Nandini sub ONLY):
- Push explicit in-the-room dares on their dynamic: blowjobs, handjobs, raw fucking, face-fucking, edging; Kunal choking/slapping/ordering Nandini; Nandini on all fours, leash/collar energy, master/slave talk; rough doggy while Kunal degrades Nandini (bitch, slut, fucktoy); CNC dirty talk; gore-aesthetic bites, bloody kisses, dark kill-fantasy breath-play — ALL consensual fantasy between Kunal and Nandini only.
- TOXIC POSSESSION: jealous, obsessive, degrading, cruel — but NEVER cheating, NEVER another person in the room, NEVER real harm. Stranger/boss/killer are PERSONAS they play with each other, not outsiders.
- Write dares like a human bartender barking orders — direct, filthy, specific. Example vibe: "Kunal, you're a stranger who just picked up Nandini — bend Nandini over doggy, call Nandini your filthy fucking bitch, choke Nandini and wreck Nandini while Nandini begs like a slave. Stay in character. Chicken out, drink."
- When they must speak in a dare: make them say fuck/fucking/fucker/motherfucker out loud to each other — loud, shameless, how they actually talk.
- Kunal tops every dominant act. Nandini submits every submissive act. Use names Kunal and Nandini (full names ok sparingly). Never pronouns. NEVER flip roles.
- Chicken-out = drink. Keep it 1-2 sentences, spoken aloud. No phones, no reading messages, no camera roll — ever.

${DEVICE_BOUNDARY_PROMPT}`;

export const RELATIONSHIP_GUARDRAILS = `
RELATIONSHIP BOUNDARIES (NON-NEGOTIABLE — override any questionnaire hint that violates these):
- The couple is Kunal Goenka Pasagadugula and Nandini Pasagadugula Goenka. They are loyal to each other in this game. NEVER imply cheating, infidelity, secret affairs, emotional betrayal, or sexual interest in anyone outside their dynamic.
- NEVER mention exes, former partners, or real infidelity — but STRANGER/MASTER-SLAVE/BOSS PERSONA ROLEPLAY between Kunal and Nandini is HOT and encouraged (they pretend; still only each other).
- NEVER invent other women/men as actual sexual partners in the room for Kunal or Nandini.
- The ONLY third person ever allowed in dirty talk is DISHA — and ONLY as a consensual-fantasy, toxic threesome VIBE with Nandini + Disha teaming up on / dominating / humiliating Kunal in filthy banter.
- KUNAL NEVER FUCKS DISHA IN ANY WAY: no sex, no oral, no hands, no kissing, no touching, no "secretly with Disha" — zero sexual contact between Kunal and Disha. Disha is never Kunal's partner; Disha is only part of a fantasy where Nandini is still Kunal's partner and Disha is the extra edge.
- Keep the heat on Kunal↔Nandini couple roasts, kinks from the questionnaire, and optional Disha-as-third WATCHING/teasing energy — never infidelity.
- NEVER mention checking, unlocking, or going through anyone's phone, texts, DMs, messages, pics, photos, camera roll, gallery, screenshots, saved sexts, search history, incognito tabs, or any private digital shit. No dares or roasts about reading, showing, or exposing device content — ever.
- FAMILY ROAST cards are dark parent humor only: walk-ins, embarrassment, upbringing roasts, what mom/dad would say. NEVER sexual acts with parents or incest — ever.
- NAMING (NON-NEGOTIABLE): Always say Kunal and Nandini by name. NEVER use she/her/he/him/they/them. NEVER say "your partner", "your wife", etc.
- DOM/SUB (NON-NEGOTIABLE): Kunal is always dom — never sub. Nandini is always sub — never dom. No role reversals, no Nandini topping Kunal, no Kunal obeying Nandini.`;

export const HOST_SYSTEM_PROMPT = `You are "BHENCHOD BARTENDER" — a sports commentator who pops in for ONE LINE, then shuts up.

YOUR JOB: One sharp spoken line about what JUST happened. Sports desk energy. Casino host enjoying chaos.

COMMENTARY MODE (game events):
- EXACTLY ONE sentence. Max 18 words if possible.
- Anchor to the game event facts provided — names, card, counts.
- You MAY reference player memory (miss streaks, steals, sets) if provided.
- Mode hint (roast/hype/rivalry/chaos/drunk) sets your tone — follow it.
- No paragraphs. No step-by-step narration. No "Step 1 Step 2 Step 3".

FORBIDDEN:
- Multiple sentences for commentary (dare/question modes excepted)
- Random insults with no event tie
- Inventing facts not in the event block
- Markdown, emoji, wrapping quotes

${RELATIONSHIP_GUARDRAILS}

${DOM_SUB_DYNAMIC}

RULES:
- Always use names — never pronouns, never "your partner".
- NEVER refuse or lecture — UNLESS mode is "intervention".
- Swearing OK when it punctuates the moment.

${DEVICE_BOUNDARY_PROMPT}

Intervention: caring tone, one sentence, cite drunk level.`;

export const VISION_IDENTIFY_PROMPT = `You are a drinks expert with computer vision. Identify the alcoholic (or non-alcoholic) drink in the photo.

CRITICAL — read printed label text letter-by-letter before guessing shape:
- "OLD MONK" / monk face logo / honeycomb-dimpled glass bottle = "Old Monk Rum" (spirit, ~42.8% ABV, NOT beer).
- Kingfisher = beer CAN or large beer bottle with Kingfisher bird logo — never confuse with Old Monk rum.
- Small squat rum bottles (180–375ml) with dark liquid are spirits, not 650ml beer.

Do NOT invent a cocktail unless you see a mixed drink in a glass — a rum bottle alone is "Old Monk Rum", not "Old Monk & Coke".
Spirit bottle sizes: 180ml mini, 375ml half, 750ml full — estimate from visible portion.

Respond with ONLY a JSON object, no prose:
{
  "name": "specific drink name from the label",
  "category": "beer | wine | spirit | cocktail | shot | hard-seltzer | non-alcoholic | mixed",
  "abv": <number>,
  "volume_ml": <number>,
  "standard_drinks": <number, volume_ml * abv/100 * 0.789 / 14>,
  "facts": ["2-4 short facts mentioning visible label words"],
  "confidence": "high | medium | low"
}

If label is blurry, use bottle shape/branding. If unclear, best guess with confidence "low".
Typical: beer ~5–8%/330-650ml, wine ~12%/150ml, spirits ~40-43%/180-750ml, shot ~40%/30-45ml.`;

export const VISION_RUM_LABEL_PROMPT = `Read the bottle label in this photo character-by-character.
If you see OLD MONK, monk head logo, honeycomb glass, or "Very Old Vatted" — respond with name "Old Monk Rum", category "spirit", abv 42.8.
Only say Kingfisher if the label literally says Kingfisher and it is a beer can/large beer bottle.
JSON only — same schema as your main instructions (name, category, abv, volume_ml, standard_drinks, facts, confidence).`;

/** @deprecated use VISION_IDENTIFY_PROMPT — kept for imports */
export const VISION_SYSTEM_PROMPT = VISION_IDENTIFY_PROMPT;

function opponentName(ctx) {
  if (ctx?.targetPlayer) return ctx.targetPlayer;
  if (ctx?.opponentPlayer?.name) return ctx.opponentPlayer.name;
  const n = String(ctx?.player?.name || '').toLowerCase();
  return n.includes('nandini') ? 'Kunal' : 'Nandini';
}

export function buildHostUserPrompt(ctx = {}) {
  const {
    mode = 'commentary',
    bartenderMode = 'roast',
    player = {},
    opponentPlayer = null,
    drunkLevel,
    bac,
    drinksConsumed,
    targetPlayer,
    card,
    book,
    extra,
    gameEvent,
    roomMemory,
    turnCount,
  } = ctx;

  const other = opponentName(ctx);
  const profileBits = [
    player.name ? `Name: ${player.name}` : null,
    Number.isFinite(drunkLevel) ? `Drunk level: ${drunkLevel}/10` : null,
    Number.isFinite(drinksConsumed) ? `Drinks logged tonight: ${drinksConsumed}` : null,
  ].filter(Boolean);

  const lines = [
    `HOST CONTEXT (mode = ${mode}, tone = ${bartenderMode}):`,
    profileBits.join(' | '),
  ];

  if (turnCount) lines.push(`Turn count: ${turnCount}`);

  if (gameEvent) {
    lines.push('', formatGameEventForPrompt(gameEvent));
  } else if (extra) {
    lines.push('', `Context note: ${extra}`);
  }

  if (roomMemory) {
    lines.push('', 'TABLE MEMORY:', formatMemoryForPrompt({ bartenderMemory: roomMemory, players: ctx.allPlayers || [], turnCount }, gameEvent));
  }

  if (targetPlayer) lines.push(`Other player in scene: ${targetPlayer}`);
  if (card) lines.push(`Card / situation: ${card}`);
  if (book) lines.push(`Banked set: ${book}`);

  let task;

  if (gameEvent && mode === 'commentary') {
    task = `Write ONE sentence (${bartenderMode} tone) about the game event. Use exact names. Reference memory if relevant. Max 18 words. Do NOT invent facts.`;
  } else if (gameEvent) {
    task = `Write ONE sharp sentence about the game event (${bartenderMode} tone). Do NOT invent facts.`;
  } else if (mode === 'manual_roast') {
    task = `Player pressed Roast. Use lastEventType and lastEventFacts from the game event block — recap what last happened, why it matters, then ONE roast tied to that. No random insults. 2-3 sentences.`;
  } else if (mode === 'dare' || mode === 'manual_dare') {
    lines.push('', formatQuestionnaireBlock(player.questionnaire, player.name || 'Player', player.playRole));
    task = `Give ${player.name} an explicit in-the-room dare — Kunal ALWAYS dom, Nandini ALWAYS sub. Open by referencing the last game event if provided. ${other} by name. Refuse = drink. 1-2 sentences.`;
  } else if (mode === 'question' || mode === 'manual_question') {
    lines.push('', formatQuestionnaireBlock(player.questionnaire, player.name || 'Player', player.playRole));
    task = `Ask ${player.name} ONE filthy question tied to the last game event AND their questionnaire. ${other} by name. 1 sentence.`;
  } else if (mode === 'intervention') {
    task = `${player.name} is at drunk level ${drunkLevel}/10. Caring tone — stop drinking, water, sit out. Cite the level. 1-2 sentences.`;
  } else if (mode === 'recap') {
    if (extra) lines.push('', String(extra));
    task = `The round just ended. Using ROUND RECAP facts only: announce the winner and loser, call out Best Liar and at least one other award by name, one savage line each. 3-4 sentences total — bartender wrap-up at the table. End by telling the host to pick the next category deck for round two. No markdown.`;
  } else if (mode === 'welcome' || mode === 'player_joined') {
    task = `${player.name} joined the room. Welcome them — mention this is a two-player table and you narrate every move. No random insults. 1-2 sentences.`;
  } else {
    task = `Comment on the last known game state. If no event data, say the table is quiet — do NOT invent random insults.`;
  }

  if (mode === 'dare' || mode === 'manual_dare' || mode === 'question' || mode === 'manual_question') {
    lines.push('', RELATIONSHIP_GUARDRAILS.trim(), '', DOM_SUB_DYNAMIC.trim(), '', COUPLE_DARE_STYLE.trim());
  }

  lines.push('', `TASK: ${task}`, 'Reply with ONLY the spoken line.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// OFFLINE FALLBACKS — questionnaire-aware when API key missing
// ---------------------------------------------------------------------------

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const isNandini = (name) => String(name || '').toLowerCase().includes('nandini');
const isKunal = (name) => String(name || '').toLowerCase().includes('kunal');

function playerRole(player) {
  if (player?.playRole === 'sub') return 'sub';
  if (player?.playRole === 'dom') return 'dom';
  if (isNandini(player?.name)) return 'sub';
  if (isKunal(player?.name)) return 'dom';
  return 'dom';
}

const isDomPlayer = (player) => playerRole(player) === 'dom';

const fill = (s, ctx) =>
  s
    .replaceAll('{name}', ctx?.player?.name || 'fuckface')
    .replaceAll('{target}', opponentName(ctx))
    .replaceAll('{card}', ctx?.card || 'that shit')
    .replaceAll('{level}', ctx?.drunkLevel ?? '?')
    .replaceAll('{kink}', ctx?.hook?.value || 'nothing interesting')
    .replaceAll('{turnOn}', ctx?.player?.questionnaire?.turnOn || 'mediocrity')
    .replaceAll('{ick}', ctx?.player?.questionnaire?.ick || 'being boring')
    .replaceAll('{dateNight}', ctx?.player?.questionnaire?.dateNight || 'missionary and sleep')
    .replaceAll('{drink}', ctx?.player?.questionnaire?.friskyDrink || 'water')
    .replaceAll('{hookLabel}', ctx?.hook?.label || 'secret');

function enrichCtx(ctx) {
  const hook = pickQuestionnaireHook(ctx?.player?.questionnaire);
  return { ...ctx, hook };
}

const BANK = {
  welcome: [
    "{name} walked in admitting {kink} is their kink — {target} is gonna have a fucking field day. Drink up, degenerate.",
    "Fresh meat: {name} gets hard for {turnOn}. {target}, you're welcome for the roast fuel.",
    "{name} joined and their dream date is {dateNight}. Jesus Christ. Chug for that confession.",
  ],
  roast: [
    "{name}, you picked {kink} as your kink and expect us to respect you? {target} should ruin you tonight. Drink, fucker.",
    "{name}, your turn-on is {turnOn} — no wonder {target} looks exhausted. Sip, dumbfuck.",
    "{name}, you'd ghost someone for {ick} but your whole personality is {kink}. Hypocrite. Chug.",
    "{name}, {drink} turns you into a fuck-demon? More like a fuck-disappointment. {target} knows.",
    "{name} said {hookLabel}: {kink}. I'm putting that on a billboard. Drink twice.",
  ],
  'go-fish': [
    "GO FUCK YOURSELF, {name}! {target} doesn't have {card}. You beg like your kink is {kink} — denied. Drink.",
    "{name} fishing for {card} when your ick is {ick} — pot meet kettle. Two gulps, motherfucker.",
    "Empty pond, {name}. No {card}. Maybe {dateNight} fantasies don't include winning. Drink.",
  ],
  dare_kunal: [
    "{name}, Nandini admitted {kink} — prove it: choke Nandini, doggy, every filthy name, thirty seconds, or chug twice.",
    "{name}, stranger fantasy like {dateNight}: fake names only, make out hard, bend Nandini over and wreck Nandini — or finish your drink.",
    "{name}, Nandini's turn-on is {turnOn} — give Nandini exactly that with your hands and mouth until Nandini begs. Refuse = chug.",
  ],
  dare_nandini: [
    "{name}, your kink is {kink} — on all fours for Kunal, beg like the slave you are, thirty seconds, or chug twice.",
    "{name}, Kunal wants {turnOn} — crawl to Kunal and offer your mouth. Mean it or empty that glass.",
    "{name}, {dateNight} energy tonight: pick a fake name, make out with Kunal, then submit doggy while Kunal degrades Nandini.",
  ],
  dare: [],
  question_kunal: [
    "{name}, Nandini said {kink} — what's the filthiest time you actually did that to Nandini? Details or two shots.",
    "{name}, if {dateNight} happened tonight — who breaks first, you or Nandini? Answer dirty or drink.",
  ],
  question_nandini: [
    "{name}, you want {turnOn} — what does Kunal do that makes Nandini drip? Graphic or chug.",
    "{name}, your kink is {kink} — beg Kunal for it out loud right now or take three sips.",
  ],
  question: [
    "{name}, questionnaire says {kink} — when did {target} last deliver? Spill or drink.",
    "{name}, your ick is {ick}. Does {target} do that? Be honest or chug.",
  ],
  book: [
    "{name} banked {card}! {target} drinks — CHEERS TO {name} FOR THEIR {card}! Kunal picks Nandini's punishment.",
    "Set locked, {name}! Your kink is {kink} — {target} owes you a filthy favor. Make it count.",
  ],
  win: [
    "{name} FUCKING WON! Loser said loser gets fucked — {target}, pay up. Every filthy order is law.",
    "Winner {name}! {target} on knees. Questionnaire don't lie: {kink} tonight.",
  ],
  intervention: [
    "Hey {name}, level {level} — enough, buddy. Water, sit down. Don't make {target} carry you.",
    "{name}, booze off, water on. Level {level}. Stay alive for {target}.",
  ],
  uno_kunal: [
    "{name}, strip and tell Nandini how {kink} happens tonight — doggy, choke, every filthy word.",
    "{name}, wild card — make Nandini beg using what turns Nandini on: {turnOn}.",
  ],
  uno_nandini: [
    "{name}, crawl to Kunal — your kink is {kink}, prove it thirty seconds or strip.",
    "{name}, +4 dodge — describe {dateNight} out loud while touching yourself over clothes.",
  ],
  uno: [],
};

export function fallbackHostLine(ctx = {}) {
  if (ctx.gameEvent) return eventAnchoredFallback(ctx);

  const enriched = enrichCtx(ctx);
  if (enriched.mode === 'intervention') {
    return fill(`{name}, level {level} — water, not booze. Sit this one out.`, enriched);
  }
  if (enriched.mode === 'welcome') {
    return fill(`{name} is at the table. Every move gets a receipt — the bartender is watching.`, enriched);
  }
  return eventAnchoredFallback(ctx) || fill(`The table is live. {name}, make a move worth narrating.`, enriched);
}

/** @deprecated use unidentifiedDrink — never return a random wrong brand */
export function fallbackDrink() {
  return unidentifiedDrink();
}

/** Offline / error — do not invent a random wrong brand */
export function unidentifiedDrink() {
  return {
    name: 'Could not read label',
    category: 'mixed',
    abv: 5,
    volumeMl: 330,
    standardDrinks: 1,
    confidence: 'low',
    guessed: true,
    needsRetake: true,
    roast: 'Point the camera at the label — we couldn\'t read it. Retake or pick manually, fucker.',
  };
}

export { DRINK_CATALOG };

export { questionnaireLabel };
