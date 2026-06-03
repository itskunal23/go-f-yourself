/** Official GFY drinking rule — "Cheers to You!" card */

import { rankName } from '../../frontend/js/game.js';

/** "CHEERS TO KEITH FOR HIS BONER RIGHT NOW!" */
export function cheersToastText(bankerName, cardLine) {
  const who = String(bankerName || 'THEM').split(' ')[0].toUpperCase();
  const what = String(cardLine || 'THAT SHIT').toUpperCase();
  return `CHEERS TO ${who} FOR THEIR ${what}!`;
}

export function cheersCardLine(rank) {
  return rankName(rank) || String(rank || '').toUpperCase();
}
