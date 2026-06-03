/**
 * Diffed table UI — avoids innerHTML storms on WebSocket ticks.
 */
import { escapeHtml } from '../dom-utils.js';
import { renderOpponentHandVisual } from '../cards.js';
import { rankMeta } from '../game.js';

let lastOpponentSig = '';
let lastPromptSig = '';
let lastMetersSig = '';
let lastPrimarySig = '';
let lastTargetSig = '';

export function resetTableDiffCache() {
  lastOpponentSig = '';
  lastPromptSig = '';
  lastMetersSig = '';
  lastPrimarySig = '';
  lastTargetSig = '';
}

export function renderOpponentDiff(view, ctx) {
  const { $, opponentOf, setOpponentReaction, setOpponentTurnMode, S, showGameToast } = ctx;
  const opp = opponentOf(view);
  if (!opp) return;

  const sig = [
    opp.id,
    opp.handCount,
    view.turnId,
    view.prompt?.type || '',
    view.you,
  ].join('#');

  const avName = $('#opponent-avatar-name');
  const avStage = $('#opponent-avatar-stage');
  const isTurn = view.turnId === opp.id;
  const name = opp.name.split(' ')[0];

  if (avName) avName.textContent = name;
  avStage?.classList.toggle('opponent-avatar-stage--turn', isTurn);
  avStage?.classList.toggle('opponent-avatar-stage--set-pending', view.prompt?.type === 'createSetWait');

  if (sig === lastOpponentSig) {
    if (isTurn && view.turnId !== view.you && !view.prompt) setOpponentTurnMode(true, name);
    else if (view.turnId === view.you) setOpponentTurnMode(false);
    return;
  }
  lastOpponentSig = sig;

  const avHand = $('#opponent-avatar-hand');
  const handHtml = renderOpponentHandVisual(opp.handCount, { maxShow: 7 });
  if (avHand && avHand.innerHTML !== handHtml) {
    avHand.innerHTML = handHtml;
    avHand.querySelector('.opp-hand-fan')?.classList.add('opp-hand--alive');
  }

  const handVis = $('#opponent-hand-visual');
  if (handVis) {
    const visHtml = renderOpponentHandVisual(opp.handCount);
    if (handVis.innerHTML !== visHtml) handVis.innerHTML = visHtml;
    handVis.querySelector('.opp-hand-fan')?.classList.add('opp-hand--alive');
  }

  const bar = $('#opponent-bar');
  if (bar) {
    bar.className = `opponent-bar${isTurn ? ' turn' : ''}`;
    const mood = isTurn && !view.prompt ? 'Thinking…' : `${opp.handCount} card${opp.handCount === 1 ? '' : 's'}`;
    bar.innerHTML = `<span class="opp-name">${escapeHtml(name)}</span><span class="opp-mood">${mood}</span>`;
  }

  if (isTurn && !view.prompt) setOpponentReaction('think');
  if (isTurn && view.turnId !== view.you && !view.prompt) setOpponentTurnMode(true, name);
  else if (view.turnId === view.you) setOpponentTurnMode(false);

  if (isTurn && opp.isBot && !view.prompt && S.lastPlottingTurn !== view.turnId) {
    S.lastPlottingTurn = view.turnId;
    showGameToast(`${name} thinking…`);
  } else if (!isTurn) {
    S.lastPlottingTurn = null;
  }
}

export function renderGamePromptDiff(view, ctx) {
  const { $, opponentOf, opponentsOf, S } = ctx;
  const el = $('#game-prompt');
  if (!el || view.finished) {
    el?.classList.add('hidden');
    return;
  }

  const myTurn = view.turnId === view.you;
  const blocked = !!view.prompt || !!view.waitingOn;
  const opponents = opponentsOf(view);
  const opp = opponentOf(view);
  const sig = [
    myTurn,
    blocked,
    view.prompt?.type,
    view.prompt?.rank,
    view.prompt?.playerName,
    view.prompt?.defenderName,
    view.prompt?.text,
    view.waitingOn,
    S.selectedTarget,
    opponents.length,
    view.turnId,
  ].join('#');

  if (sig === lastPromptSig) return;
  lastPromptSig = sig;

  if (view.prompt?.type === 'createSet') {
    el.className = 'game-prompt prompt-set show';
    el.innerHTML = '<span>CREATE SET</span>';
    return;
  }
  if (view.prompt?.type === 'createSetWait') {
    el.className = 'game-prompt prompt-wait show';
    el.innerHTML = `<span>${escapeHtml(view.prompt.playerName)} creating set…</span>`;
    return;
  }
  if (view.prompt?.type === 'bluff') {
    el.className = 'game-prompt prompt-bluff show';
    el.innerHTML = '<span>Truth or lie?</span>';
    return;
  }
  if (view.prompt?.type === 'bluffWait') {
    el.className = 'game-prompt prompt-wait show';
    el.innerHTML = `<span>${escapeHtml(view.prompt.defenderName)} deciding…</span>`;
    return;
  }
  if (view.prompt?.type === 'chaos') {
    el.className = 'game-prompt prompt-chaos show';
    el.innerHTML = `<span>${escapeHtml(view.prompt.text || view.prompt.hint || 'Complete it')}</span>`;
    return;
  }
  if (view.prompt?.type === 'drink') {
    el.className = 'game-prompt prompt-gfy show';
    el.innerHTML = `<span>Draw${view.gameMode !== 'casual' ? ' · drink' : ''}</span>`;
    return;
  }
  if (view.waitingOn) {
    el.className = 'game-prompt prompt-wait show';
    el.innerHTML = '<span>Waiting…</span>';
    return;
  }
  if (!myTurn) {
    const turnPlayer = view.players.find((p) => p.id === view.turnId);
    const waitName = turnPlayer?.name.split(' ')[0] || 'Them';
    el.className = 'game-prompt prompt-wait prompt-hero show';
    el.innerHTML = `<div class="turn-hero-divider" aria-hidden="true"></div>
      <strong class="turn-hero-title turn-hero-title--wait">WAITING FOR ${escapeHtml(waitName.toUpperCase())}</strong>
      <div class="turn-hero-divider" aria-hidden="true"></div>
      <span class="turn-hero-sub turn-hero-sub--muted">Their move</span>`;
    return;
  }
  if (blocked) {
    el.classList.add('hidden');
    return;
  }
  if (opponents.length > 1 && !S.selectedTarget) {
    el.className = 'game-prompt prompt-turn prompt-hero show';
    el.innerHTML = `<div class="turn-hero-divider" aria-hidden="true"></div>
      <strong class="turn-hero-title">YOUR TURN</strong>
      <div class="turn-hero-divider" aria-hidden="true"></div>
      <span class="turn-hero-sub">Pick who to ask</span>`;
    return;
  }
  el.className = 'game-prompt prompt-turn prompt-hero show';
  el.innerHTML = `<strong class="turn-hero-title turn-hero-title--fish">Fish for secrets</strong>
    <span class="turn-hero-sub">Tap a card · Ask below</span>`;
}

export function renderTurnPanelsDiff(view, ctx) {
  const { $, opponentsOf, S, renderHand } = ctx;
  const myTurn = view.turnId === view.you;
  const blocked = !!view.prompt || !!view.waitingOn;
  const targetPanel = $('#target-pick');
  const opponents = opponentsOf(view);

  if (!myTurn || blocked) {
    targetPanel?.classList.add('hidden');
    return;
  }
  if (opponents.length === 1) {
    S.selectedTarget = opponents[0].id;
    targetPanel?.classList.add('hidden');
    return;
  }

  const sig = opponents.map((p) => `${p.id}:${p.handCount}:${S.selectedTarget === p.id}`).join('|');
  if (sig === lastTargetSig) return;
  lastTargetSig = sig;

  targetPanel?.classList.remove('hidden');
  const list = $('#target-list');
  if (!list) return;
  list.innerHTML = opponents.map((p) => `
    <button type="button" class="target-btn ${S.selectedTarget === p.id ? 'selected' : ''}" data-id="${p.id}">
      ${escapeHtml(p.name.split(' ')[0])} · ${p.handCount} cards
    </button>`).join('');
  list.querySelectorAll('.target-btn').forEach((btn) => {
    btn.onclick = () => {
      S.selectedTarget = btn.dataset.id;
      renderTurnPanelsDiff(view, ctx);
      renderHand(view, true);
    };
  });
}

export function primaryActionSignature(view, focusedRank) {
  const myTurn = view.turnId === view.you;
  const blocked = !!view.prompt || !!view.waitingOn;
  return [myTurn, blocked, view.prompt?.type, view.prompt?.rank, focusedRank].join('#');
}
