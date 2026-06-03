import { randomUUID } from 'node:crypto';
import { rankName } from '../../frontend/js/game.js';

const BOT_TAUNTS = [  (n, r) => `Got any fucking ${r}? Hand it over, loser.`,
  (n, r) => `${r} — now. Or I'll tell everyone what a pussy you are.`,
  (n, r) => `You hiding ${r}? Pathetic. Give it up.`,
  (n, r) => `I want your ${r}. Don't make me ask twice, fuckface.`,
];

/** @param {object} room @param {object} [hostProfile] */
export function createMockPartner(room, hostProfile = {}) {
  const hostName = String(hostProfile.name || '').toLowerCase();
  const botName = hostName.includes('nandini') ? 'Kunal Goenka Pasagadugula' : 'Nandini Pasagadugula Goenka';
  const botSex = hostName.includes('nandini') ? 'male' : 'female';
  const player = {
    id: randomUUID().slice(0, 8),
    token: null,
    name: botName,
    sex: botSex,
    age: 26 + (Math.random() * 8 | 0),
    heightCm: botSex === 'male' ? 178 : 165,
    weightKg: botSex === 'male' ? 78 : 62,
    questionnaire: {
      kink: 'Choke the fuck out of me',
      turnOn: 'When they beg to be fucked',
      ick: 'Dead-fish, no fucking effort',
      dateNight: 'Hotel, handcuffs & hard fucking',
      friskyDrink: 'Whiskey reckless rough fuck',
      initiator: 'They beg I decide who gets fucked',
    },
    drinks: [],
    ws: null,
    connected: true,
    isHost: false,
    isBot: true,
  };
  room.players.push(player);
  return player;
}

/** @param {import('../../frontend/js/game.js').GoFishGame} game @param {string} botId */
export function pickBotAskRank(game, botId) {
  const ranks = game.askableRanks(botId);
  if (!ranks.length) return null;
  const hand = game.player(botId)?.hand || [];
  const counts = {};
  for (const c of hand) counts[c.rank] = (counts[c] || 0) + 1;
  ranks.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  if (Math.random() < 0.65) return ranks[0];
  return ranks[Math.floor(Math.random() * ranks.length)];
}

/** @param {string} rank */
export function botAskLine(rank) {
  const r = rankName(rank);
  const fn = BOT_TAUNTS[Math.floor(Math.random() * BOT_TAUNTS.length)];
  return fn('', r);
}

export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
