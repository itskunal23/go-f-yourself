// ===========================================================================
//  SIDE GAMES HUB — lazy-loaded so cold start stays fast.
// ===========================================================================
import { gameShell, esc } from './ui.js';

export const SIDE_GAMES_META = [
  { id: 'fuckinguno', name: 'Fucking UNO', emoji: '🃏', tagline: 'Pass & play chaos' },
];

export const SIDE_GAMES = SIDE_GAMES_META;

async function loadGame(id) {
  if (id === 'fuckinguno') {
    const mod = await import('./fuckinguno.js');
    return mod.default;
  }
  return null;
}

export async function launchSideGame(id, ctx) {
  const game = await loadGame(id);
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
      ${SIDE_GAMES_META.map(
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
