import './styles/main.css';
import { launchSpinBottle } from './core/game.js';

/** Standalone entry — also exported for side-game embedding. */
export { launchSpinBottle } from './core/game.js';

function bootStandalone() {
  const app = document.getElementById('stb-app');
  if (!app) return;
  launchSpinBottle(app, {
    onClose: () => {
      window.location.href = '/';
    },
  });
}

if (document.getElementById('stb-app')) {
  bootStandalone();
}
