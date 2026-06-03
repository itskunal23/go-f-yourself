// ===========================================================================
//  SIDE GAMES HUB
//  A launcher that lets the two degenerates break away from Go Fish for a
//  filthy mini-game, then come back. Each game plugs into the same drink +
//  AI-host systems via the shared `ctx`.
// ===========================================================================
import { gameShell, esc } from './ui.js';
import fuckingUno from './fuckinguno.js';

export const SIDE_GAMES = [fuckingUno];

// ctx = { players, current, drink(player, reason), host(mode, player, extra), toast }
export async function launchSideGame(id, ctx) {
  const game = SIDE_GAMES.find((g) => g.id === id);
  if (!game) return ctx.toast?.('Unknown game, fucker.');
  const min = game.minPlayers || 1;
  const count = (ctx.players || []).filter((p) => p).length;
  if (count < min) {
    return ctx.toast?.(`Need ${min} player${min > 1 ? 's' : ''} for ${game.name}.`);
  }
  try {
    await game.launch(ctx);
  } catch (err) {
    console.error('[sidegame]', game.id, err);
    ctx.toast?.('That game shat itself. Try another, fucker.');
  }
}

export function openGamesHub(ctx) {
  const shell = gameShell({
    title: 'Side games',
    emoji: '🎮',
    subtitle: '',
    onHome: ctx.goHome,
  });

  shell.body.innerHTML = `
    <div class="sg-hub-grid">
      ${SIDE_GAMES.map(
        (g) => `
        <button class="sg-hub-card" data-id="${esc(g.id)}">
          <span class="sg-hub-emoji">${g.emoji}</span>
          <span class="sg-hub-name">${esc(g.name)}</span>
          <span class="sg-hub-tag">${esc(g.tagline)}</span>
        </button>`
      ).join('')}
    </div>`;

  shell.body.querySelectorAll('.sg-hub-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      shell.close();
      launchSideGame(btn.dataset.id, ctx);
    });
  });

  return shell;
}
