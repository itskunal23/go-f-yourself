// Drink Debt UI — choices, tokens, debt ledger display.
import { haptic } from './mobile.js';

let choiceOpen = false;
let choiceKey = '';

function $(s, root = document) { return root.querySelector(s); }
function $$(s) { return [...document.querySelectorAll(s)]; }

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function closeChoice() {
  choiceOpen = false;
  choiceKey = '';
  const overlay = $('#modal-root')?.querySelector('.drink-choice-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => overlay.remove(), 220);
}

function openChoiceSheet(html, key) {
  if (choiceKey === key && choiceOpen) {
    return $('#modal-root')?.querySelector('.drink-choice-overlay') || null;
  }
  const root = $('#modal-root');
  if (!root) return null;
  closeChoice();
  choiceKey = key;
  choiceOpen = true;
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay drink-choice-overlay';
  overlay.innerHTML = `<div class="sheet drink-choice-sheet">${html}</div>`;
  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return overlay;
}

function parseDebtContext(reason = '') {
  const raw = String(reason || '').trim();
  const lower = raw.toLowerCase();
  let what = raw;
  let why = 'You owe the bar a drink.';
  let penalty = '+1 Drink Owed';

  if (lower.includes('go fuck yourself') || lower.includes('go fish')) {
    what = 'You were denied and had to Go Fish.';
    why = raw.includes('—') ? raw.split('—').slice(1).join('—').trim() : 'They didn\'t have your card — draw from the pond.';
  } else if (lower.includes('chicken')) {
    what = 'You chickened out on a dare.';
    why = raw;
  } else if (lower.includes('liar') || lower.includes('bullshit') || lower.includes('caught')) {
    what = 'You got caught lying.';
    why = raw;
  } else if (lower.includes('lost') || lower.includes('side game')) {
    what = 'You lost a side game.';
    why = raw;
  } else if (raw.includes('—')) {
    const parts = raw.split('—').map((s) => s.trim()).filter(Boolean);
    what = parts[0] || raw;
    why = parts.slice(1).join(' — ') || why;
  }

  return { what, why, penalty };
}

function debtChoiceHtml(p) {
  const ctx = parseDebtContext(p.reason);
  const added = p.added ?? 1;
  const total = p.totalDebt ?? added;
  ctx.penalty = `+${added} Drink${added !== 1 ? 's' : ''} Owed`;

  return `
    <div class="grab"></div>
    <div class="debt-choice-header">
      <span class="debt-choice-icon">🍺</span>
      <h3>Drink Debt</h3>
    </div>
    <div class="debt-context">
      <p class="debt-what">${esc(ctx.what)}</p>
      <p class="debt-why">${esc(ctx.why)}</p>
    </div>
    <div class="debt-summary">
      <div class="debt-summary-row">
        <span class="debt-summary-label">Penalty</span>
        <span class="debt-summary-value debt-summary-penalty">${esc(ctx.penalty)}</span>
      </div>
      <div class="debt-summary-row">
        <span class="debt-summary-label">Current Debt</span>
        <span class="debt-summary-value">${total} Drink${total !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <p class="debt-choice-prompt">Choose Your Move</p>
    <div class="sheet-actions debt-choice-actions">
      <button type="button" class="debt-choice-btn btn-primary" id="dc-pay">
        <span class="debt-choice-btn-icon">💧</span>
        <span class="debt-choice-btn-body">
          <strong>Pay Now</strong>
          <small>Clear the debt immediately.</small>
        </span>
      </button>
      <button type="button" class="debt-choice-btn btn-secondary" id="dc-save">
        <span class="debt-choice-btn-icon">⏳</span>
        <span class="debt-choice-btn-body">
          <strong>Save For Later</strong>
          <small>Keep the debt and risk stacking penalties.</small>
        </span>
      </button>
      <button type="button" class="debt-choice-btn btn-risk" id="dc-double">
        <span class="debt-choice-btn-icon">🎲</span>
        <span class="debt-choice-btn-body">
          <strong>Double Down</strong>
          <small>Risk doubling the debt for a larger reward if successful.</small>
        </span>
      </button>
    </div>`;
}

export function renderDrinkEconomyHud(_view, _socket) {
  const bar = $('#player-status-bar');
  if (!bar) return;
  bar.classList.add('hidden');
  $('#drink-token-actions')?.classList.add('hidden');
}

export function openGiftSheet(socket, view) {
  const opp = view.players.find((p) => p.id !== view.you);
  const ov = openChoiceSheet(`
    <div class="grab"></div>
    <h3>🎁 Gift A Drink</h3>
    <p>Take one yourself — or stick it on ${esc(opp?.name.split(' ')[0] || 'them')}.</p>
    <div class="sheet-actions btn-set">
      <button type="button" class="btn-primary" id="gift-self">I'll drink (+1 owed)</button>
      <button type="button" class="btn-secondary" id="gift-give">Give to ${esc(opp?.name.split(' ')[0] || 'them')}</button>
    </div>
  `, 'gift');
  ov?.querySelector('#gift-self')?.addEventListener('click', () => {
    socket.send({ t: 'giftDrink', action: 'self' });
    finishChoice();
  });
  ov?.querySelector('#gift-give')?.addEventListener('click', () => {
    socket.send({ t: 'giftDrink', action: 'give' });
    finishChoice();
  });
}

export function syncDrinkChoiceSheet(view, socket) {
  const p = view.prompt;
  if (!p || view.finished) {
    if (choiceOpen && choiceKey !== 'gift') closeChoice();
    return;
  }

  const choiceTypes = ['debtChoice', 'splitOrTake', 'lastCall', 'dealOffer', 'setReward'];
  if (!choiceTypes.includes(p.type)) return;

  const key = `${p.type}:${JSON.stringify(p)}`;
  if (choiceKey === key) return;

  if (p.type === 'debtChoice') {
    const ov = openChoiceSheet(debtChoiceHtml(p), key);
    ov?.querySelector('#dc-pay')?.addEventListener('click', () => { socket.send({ t: 'debtChoice', action: 'pay' }); finishChoice(); });
    ov?.querySelector('#dc-save')?.addEventListener('click', () => { socket.send({ t: 'debtChoice', action: 'save' }); finishChoice(); });
    ov?.querySelector('#dc-double')?.addEventListener('click', () => { socket.send({ t: 'debtChoice', action: 'double' }); finishChoice(); });
    return;
  }

  if (p.type === 'splitOrTake') {
    const opp = view.players.find((x) => x.id === p.opponentId);
    const ov = openChoiceSheet(`
      <div class="grab"></div>
      <h3>Split Or Take</h3>
      <p>${esc(p.reason || 'Penalty')}</p>
      <div class="sheet-actions btn-set">
        <button type="button" class="btn-destructive" id="st-take">Take ${p.takeAmount} drinks</button>
        <button type="button" class="btn-secondary" id="st-give">Give ${p.giveAmount} to ${esc(opp?.name.split(' ')[0] || 'them')}</button>
      </div>
    `, key);
    ov?.querySelector('#st-take')?.addEventListener('click', () => { socket.send({ t: 'splitOrTake', action: 'take' }); finishChoice(); });
    ov?.querySelector('#st-give')?.addEventListener('click', () => { socket.send({ t: 'splitOrTake', action: 'give' }); finishChoice(); });
    return;
  }

  if (p.type === 'lastCall') {
    const ov = openChoiceSheet(`
      <div class="grab"></div>
      <h3>🍸 Last Call — Danger Zone</h3>
      <p>You're at 8+/10. Choose your poison.</p>
      <div class="sheet-actions btn-set">
        <button type="button" class="btn-primary" id="lc-drink">Drink ${p.amount}</button>
        <button type="button" class="btn-destructive" id="lc-punish">They pick your punishment</button>
      </div>
    `, key);
    ov?.querySelector('#lc-drink')?.addEventListener('click', () => { socket.send({ t: 'lastCall', action: 'drink' }); finishChoice(); });
    ov?.querySelector('#lc-punish')?.addEventListener('click', () => { socket.send({ t: 'lastCall', action: 'punish' }); finishChoice(); });
    return;
  }

  if (p.type === 'dealOffer') {
    const ov = openChoiceSheet(`
      <div class="grab"></div>
      <h3>🍸 Bartender Deal</h3>
      <p>Take ${p.nowAmount} drink now — or risk ${p.riskAmount} next turn.</p>
      <div class="sheet-actions btn-set">
        <button type="button" class="btn-primary" id="deal-now">Take ${p.nowAmount} now</button>
        <button type="button" class="btn-destructive" id="deal-risk">Risk ${p.riskAmount}</button>
      </div>
    `, key);
    ov?.querySelector('#deal-now')?.addEventListener('click', () => { socket.send({ t: 'dealOffer', action: 'now' }); finishChoice(); });
    ov?.querySelector('#deal-risk')?.addEventListener('click', () => { socket.send({ t: 'dealOffer', action: 'risk' }); finishChoice(); });
    return;
  }

  if (p.type === 'setReward') {
    const opts = (p.options || []).map((o) =>
      `<button type="button" class="btn-secondary set-reward-btn" data-id="${o.id}">${esc(o.label)}</button>`,
    ).join('');
    const ov = openChoiceSheet(`
      <div class="grab"></div>
      <h3>🏆 Set Complete — Pick Your Reward</h3>
      <p>You locked a set. Weaponize it.</p>
      <div class="sheet-actions btn-set set-reward-grid">${opts}</div>
    `, key);
    ov?.querySelectorAll('.set-reward-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        socket.send({ t: 'setReward', rewardId: btn.dataset.id });
        finishChoice();
      });
    });
  }
}

function finishChoice() {
  choiceOpen = false;
  choiceKey = '';
  closeChoice();
}

export function resetDrinkEconomyUi() {
  choiceOpen = false;
  choiceKey = '';
}
