// Fast party-game onboarding — one decision per screen, card-style roast fuel.
import gsap from '/vendor/gsap/index.js';
import { CATEGORY_LIST, ranksForCategories, sanitizeCategories } from './game.js?v=65';
import {
  inferPlayRole,
  isRoleLocked,
  questionsForRole,
  questionnaireComplete,
  KINK_RANK_OPTIONS,
  KINK_RANK_TOP_N,
  parseKinkRank,
  serializeKinkRank,
  kinkRankComplete,
} from './questionnaire.js';
import { haptic } from './mobile.js';

const INTENSITY_OPTIONS = [
  { id: 'casual', emoji: '🙂', label: 'Chill', sub: 'Filthy dares · no drinks' },
  { id: 'drinking', emoji: '😈', label: 'Spicy', sub: 'Dares + drinks · the sweet spot' },
  { id: 'savage', emoji: '🔥', label: 'Chaos', sub: 'Maximum fuck · no mercy' },
];

const ONBOARD_CAT_UI = {
  filthy: { label: 'Flirty', emoji: '💋' },
  kink: { label: 'Kinks', emoji: '🎭' },
  family: { label: 'Roasts', emoji: '💀' },
  cnc: { label: 'Wild Cards', emoji: '🃏' },
};

export const ONBOARD_RECOMMENDED = ['filthy'];

const AGE_RANGES = [
  { id: '18-24', label: '18–24', age: 22 },
  { id: '25-34', label: '25–34', age: 30 },
  { id: '35-44', label: '35–44', age: 40 },
  { id: '45+', label: '45+', age: 50 },
];

const ROLE_OPTIONS = [
  { id: 'dom', emoji: '👑', label: 'Dom', sub: 'I run the scene' },
  { id: 'sub', emoji: '🎀', label: 'Sub', sub: 'I submit & obey' },
];

/** Quick play: minimal steps — roast deferred to post-game profile. */
const CREATE_STEPS = ['about'];
const JOIN_STEPS = ['join-code', 'about'];

/** @type {object} */
let state = null;

function $(s, root = document) { return root.querySelector(s); }

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function stepsForMode(mode) {
  return mode === 'join' ? JOIN_STEPS : CREATE_STEPS;
}

function stepIndex(id) {
  return stepsForMode(state.mode).indexOf(id);
}

function $$(s) { return [...document.querySelectorAll(s)]; }

function liveName() {
  return ($('#onboard-name')?.value || state?.name || '').trim();
}

function roastQuestions() {
  return questionsForRole(state.playRole || 'dom');
}

function showStep(id) {
  state.step = id;
  $$('.onboard-step').forEach((el) => {
    el.classList.toggle('active', el.dataset.step === id);
  });
  const idx = stepIndex(id);
  const total = stepsForMode(state.mode).length;
  const back = $('#onboard-back');
  if (back) back.classList.toggle('hidden', id === 'complete');

  const title = $('#onboard-title');
  const sub = $('#onboard-sub');
  const next = $('#btn-onboard-next');
  const skip = $('#btn-roast-skip');
  const footer = $('.onboard-footer');

  if (id === 'complete') {
    if (title) title.textContent = '';
    if (sub) sub.textContent = '';
    footer?.classList.add('hidden');
    return;
  }
  footer?.classList.remove('hidden');

  const copy = STEP_COPY[state.mode]?.[id] || STEP_COPY.create[id];
  if (title) title.textContent = copy?.title || 'Create Room';
  if (sub) sub.textContent = copy?.sub || '';

  const isRoast = id === 'roast';
  if (next && !isRoast) {
    next.classList.remove('hidden');
    next.disabled = !canAdvance(id);
    next.querySelector('span') && (next.querySelector('span').textContent = idx >= total - 1 ? 'Go Fuck Yourself →' : 'Keep Fucking Going →');
  }
  skip?.classList.toggle('hidden', !isRoast);

  if (id === 'deck') syncDeckPreview();
  if (id === 'roast') renderRoastCard();
}

const STEP_COPY = {
  create: {
    intensity: { title: 'Create Room', sub: 'How wild should tonight be?' },
    deck: { title: 'Deck Selection', sub: 'What\u2019s in tonight\u2019s deck?' },
    about: { title: 'About You', sub: 'Just enough for the bartender.' },
    roast: { title: 'Roast Fuel', sub: 'The bartender needs some ammo.' },
  },
  join: {
    'join-code': { title: 'Join Room', sub: 'Enter the 4-letter code.' },
    about: { title: 'About You', sub: 'Just enough for the bartender.' },
    roast: { title: 'Roast Fuel', sub: 'The bartender needs some ammo.' },
  },
};

function canAdvance(step) {
  if (step === 'intensity') return !!state.gameMode;
  if (step === 'deck') return state.cardCategories.length > 0;
  if (step === 'about') {
    const name = liveName();
    if (name.length >= 2) {
      if (!state.playRole) state.playRole = inferPlayRole(name) || 'dom';
      if (!state.ageRange) state.ageRange = '25-34';
    }
    return name.length >= 2;
  }
  if (step === 'join-code') return state.joinCode.length === 4;
  return true;
}

function syncDeckPreview() {
  const el = $('#onboard-deck-preview');
  if (!el) return;
  const ranks = ranksForCategories(state.cardCategories);
  el.textContent = `${ranks.length} situations · ${ranks.length * 4} cards`;
}

function setPlayRole(role) {
  if (state.playRole === role) return;
  state.playRole = role;
  state.questionnaire = {};
  state.launching = false;
  syncRoleUI();
  haptic('light');
  $('#btn-onboard-next') && ($('#btn-onboard-next').disabled = !canAdvance('about'));
}

function syncPlayRoleFromName() {
  const name = liveName();
  state.name = name;
  const inferred = inferPlayRole(name);
  if (inferred) setPlayRole(inferred);
  else syncRoleUI();
  $('#btn-onboard-next') && ($('#btn-onboard-next').disabled = !canAdvance('about'));
}

function syncRoleUI() {
  const mount = $('#onboard-role');
  const hint = $('#onboard-role-hint');
  if (!mount) return;
  const locked = isRoleLocked(liveName());
  const role = state.playRole;
  mount.querySelectorAll('.role-card').forEach((btn) => {
    const id = btn.dataset.v;
    const isActive = role === id;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    btn.classList.toggle('locked', locked && !isActive);
    btn.disabled = locked && !isActive;
  });
  if (hint) {
    hint.textContent = locked
      ? (role === 'dom' ? 'Kunal — you\u2019re locked as Dom tonight.' : 'Nandini — you\u2019re locked as Sub tonight.')
      : 'Kunal doms. Nandini submits. Pick yours.';
  }
}

function renderIntensityStep() {
  const mount = $('#onboard-intensity');
  if (!mount || mount.dataset.built) return;
  mount.dataset.built = '1';
  mount.innerHTML = `<div class="intensity-grid" role="radiogroup" aria-label="Wildness">
    ${INTENSITY_OPTIONS.map((o) => `
      <button type="button" class="intensity-card${state.gameMode === o.id ? ' active' : ''}" data-v="${o.id}" role="radio" aria-checked="${state.gameMode === o.id}">
        <span class="intensity-emoji">${o.emoji}</span>
        <span class="intensity-label">${o.label}</span>
        <span class="intensity-sub">${o.sub}</span>
      </button>`).join('')}
  </div>`;
  mount.querySelectorAll('.intensity-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.gameMode = btn.dataset.v;
      mount.querySelectorAll('.intensity-card').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
      haptic('light');
      $('#btn-onboard-next').disabled = false;
    });
  });
}

function renderDeckStep() {
  const mount = $('#onboard-deck-list');
  if (!mount || mount.dataset.built) return;
  mount.dataset.built = '1';
  mount.innerHTML = CATEGORY_LIST.map((c) => {
    const ui = ONBOARD_CAT_UI[c.id] || { label: c.short, emoji: c.emoji };
    const on = state.cardCategories.includes(c.id);
    return `<button type="button" class="deck-check-row${on ? ' active' : ''}" data-v="${c.id}" role="radio" aria-checked="${on}">
      <span class="deck-check-box" aria-hidden="true">${on ? '●' : '○'}</span>
      <span class="deck-check-label">${ui.emoji} ${ui.label}</span>
    </button>`;
  }).join('');
  mount.querySelectorAll('.deck-check-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.v;
      state.cardCategories = sanitizeCategories([id]);
      mount.querySelectorAll('.deck-check-row').forEach((r) => {
        const on = state.cardCategories.includes(r.dataset.v);
        r.classList.toggle('active', on);
        r.setAttribute('aria-checked', on ? 'true' : 'false');
        r.querySelector('.deck-check-box').textContent = on ? '●' : '○';
      });
      syncDeckPreview();
      haptic('light');
      $('#btn-onboard-next').disabled = false;
    });
  });
  syncDeckPreview();
}

function renderAboutStep() {
  const nameInput = $('#onboard-name');
  if (nameInput && !nameInput.dataset.wired) {
    nameInput.dataset.wired = '1';
    nameInput.value = state.name;
    nameInput.addEventListener('input', syncPlayRoleFromName);
  }

  const roleMount = $('#onboard-role');
  if (roleMount && !roleMount.dataset.built) {
    roleMount.dataset.built = '1';
    roleMount.innerHTML = ROLE_OPTIONS.map((o) => `
      <button type="button" class="role-card${state.playRole === o.id ? ' active' : ''}" data-v="${o.id}" role="radio" aria-checked="${state.playRole === o.id}">
        <span class="role-card-emoji">${o.emoji}</span>
        <span class="role-card-label">${o.label}</span>
        <span class="role-card-sub">${o.sub}</span>
      </button>`).join('');
    roleMount.querySelectorAll('.role-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isRoleLocked(liveName())) return;
        setPlayRole(btn.dataset.v);
      });
    });
  }

  const mount = $('#onboard-age-ranges');
  if (!mount || mount.dataset.built) return;
  mount.dataset.built = '1';
  mount.innerHTML = AGE_RANGES.map((r) => `
    <button type="button" class="age-range-btn${state.ageRange === r.id ? ' active' : ''}" data-v="${r.id}" role="radio" aria-checked="${state.ageRange === r.id}">
      ${r.label}
    </button>`).join('');
  mount.querySelectorAll('.age-range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.ageRange = btn.dataset.v;
      mount.querySelectorAll('.age-range-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
      haptic('light');
      $('#btn-onboard-next').disabled = !canAdvance('about');
    });
  });

  syncPlayRoleFromName();
}

function roastProgress() {
  const questions = roastQuestions();
  const answered = questions.filter((q) => {
    if (q.type === 'rank') return kinkRankComplete(state.questionnaire[q.key]);
    return !!state.questionnaire[q.key];
  }).length;
  const total = questions.length;
  const pct = Math.round((answered / total) * 100);
  const label = $('#roast-progress-text');
  const fill = $('#roast-progress-fill');
  const stepLabel = $('#roast-step-label');
  if (label) label.textContent = `Bartender Learning About You · ${pct}%`;
  if (fill) fill.style.width = `${pct}%`;
  const remaining = total - answered;
  if (stepLabel) {
    stepLabel.textContent = remaining > 0
      ? `${remaining} more question${remaining === 1 ? '' : 's'} until roast mode unlocks`
      : 'Roast mode unlocked';
  }
  return { answered, total };
}

function renderRoastCard() {
  const mount = $('#roast-card-mount');
  if (!mount) return;
  const questions = roastQuestions();
  const { answered, total } = roastProgress();
  if (answered >= total) {
    showComplete();
    return;
  }
  const field = questions[answered];
  if (field.type === 'rank') {
    renderKinkRankCard(mount, field);
    return;
  }
  const opts = field.options;
  mount.innerHTML = `
    <div class="roast-card" data-q="${field.key}">
      <div class="roast-card-emoji">${field.emoji}</div>
      <h2 class="roast-card-title">${esc(field.cardTitle)}</h2>
      <div class="roast-card-options">
        ${opts.map((o) => `<button type="button" class="roast-opt" data-v="${o.replace(/"/g, '&quot;')}">${esc(o)}</button>`).join('')}
      </div>
    </div>
    <p class="roast-step-foot" id="roast-step-label">Question ${answered + 1} of ${total}</p>`;

  const card = mount.querySelector('.roast-card');
  try {
    gsap.fromTo(card, { y: 40, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(1.4)' });
  } catch { /* animation optional */ }

  mount.querySelectorAll('.roast-opt').forEach((btn) => {
    btn.addEventListener('click', () => pickRoastAnswer(field.key, btn.dataset.v, card));
  });
  syncRoastFooter();
}

function getKinkRankDraft() {
  return parseKinkRank(state.questionnaire.kinkRank);
}

function setKinkRankDraft(ids) {
  state.questionnaire.kinkRank = serializeKinkRank(ids);
}

/** Footer + in-card actions during roast (kink rank shows Continue when top 3 picked). */
function syncRoastFooter() {
  const next = $('#btn-onboard-next');
  const skip = $('#btn-roast-skip');
  if (state.step !== 'roast' || !next || !skip) return;

  const questions = roastQuestions();
  const { answered, total } = roastProgress();
  if (answered >= total) {
    next.classList.add('hidden');
    skip.classList.add('hidden');
    return;
  }

  const field = questions[answered];
  if (field?.type === 'rank') {
    const done = kinkRankComplete(state.questionnaire.kinkRank);
    skip.classList.remove('hidden');
    skip.textContent = 'Skip ranking';
    if (done) {
      next.classList.remove('hidden');
      next.disabled = false;
      const span = next.querySelector('span');
      if (span) span.textContent = 'Continue →';
    } else {
      next.classList.add('hidden');
    }
    return;
  }

  next.classList.add('hidden');
  skip.classList.remove('hidden');
  skip.textContent = 'Skip question';
}

function scrollToKinkRankActions(mount) {
  requestAnimationFrame(() => {
    mount?.querySelector('.kink-rank-actions')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function advanceFromKinkRank({ useDefaults = false } = {}) {
  if (useDefaults) {
    setKinkRankDraft(KINK_RANK_OPTIONS.slice(0, KINK_RANK_TOP_N).map((o) => o.id));
  } else if (!kinkRankComplete(state.questionnaire.kinkRank)) {
    return;
  }
  const mount = $('#roast-card-mount');
  const card = mount?.querySelector('.roast-card');
  haptic('medium');
  const go = () => renderRoastCard();
  if (card) {
    try {
      gsap.to(card, {
        x: 120,
        rotate: 8,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
        onComplete: go,
      });
    } catch {
      go();
    }
  } else {
    go();
  }
}

function renderKinkRankCard(mount, field) {
  const questions = roastQuestions();
  const { answered, total } = roastProgress();
  const draft = getKinkRankDraft();
  const nextRank = draft.length + 1;
  const done = draft.length >= KINK_RANK_TOP_N;

  mount.innerHTML = `
    <div class="roast-card roast-card--rank${done ? ' roast-card--rank-done' : ''}" data-q="${field.key}">
      <div class="roast-card-emoji">${field.emoji}</div>
      <h2 class="roast-card-title">${esc(field.cardTitle)}</h2>
      <p class="kink-rank-hint">${done
    ? 'Top 3 set — continue with your picks or skip ranking'
    : `Tap in order — pick your #${nextRank} kink`}</p>
      <div class="kink-rank-list" role="list">
        ${KINK_RANK_OPTIONS.map((opt) => {
    const rank = draft.indexOf(opt.id);
    const ranked = rank >= 0;
    return `<button type="button" class="kink-rank-row${ranked ? ' kink-rank-row--picked' : ''}" data-id="${opt.id}" role="listitem">
      <span class="kink-rank-badge${ranked ? ' kink-rank-badge--on' : ''}" aria-hidden="true">${ranked ? rank + 1 : '·'}</span>
      <span class="kink-rank-label">${esc(opt.label)}</span>
    </button>`;
  }).join('')}
      </div>
      <div class="kink-rank-actions">
        ${done
    ? `<button type="button" class="btn-primary kink-rank-continue">Continue</button>
         <button type="button" class="btn-text kink-rank-skip">Skip ranking</button>
         <button type="button" class="btn-text kink-rank-reset">Clear picks</button>`
    : `<button type="button" class="btn-text kink-rank-reset" ${draft.length ? '' : 'disabled'}>Clear picks</button>
         <button type="button" class="btn-primary kink-rank-done" disabled>Continue</button>`}
      </div>
    </div>
    <p class="roast-step-foot" id="roast-step-label">Question ${answered + 1} of ${total}</p>`;

  const card = mount.querySelector('.roast-card');
  try {
    gsap.fromTo(card, { y: 40, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(1.4)' });
  } catch { /* animation optional */ }

  mount.querySelectorAll('.kink-rank-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      let next = [...getKinkRankDraft()];
      const idx = next.indexOf(id);
      if (idx >= 0) {
        next.splice(idx, 1);
      } else if (next.length < KINK_RANK_TOP_N) {
        next.push(id);
      }
      const wasDone = draft.length >= KINK_RANK_TOP_N;
      setKinkRankDraft(next);
      haptic('light');
      renderKinkRankCard(mount, field);
      if (!wasDone && next.length >= KINK_RANK_TOP_N) scrollToKinkRankActions(mount);
    });
  });

  mount.querySelector('.kink-rank-reset')?.addEventListener('click', () => {
    setKinkRankDraft([]);
    haptic('light');
    renderKinkRankCard(mount, field);
  });

  mount.querySelector('.kink-rank-continue')?.addEventListener('click', () => {
    advanceFromKinkRank({ useDefaults: false });
  });

  mount.querySelector('.kink-rank-skip')?.addEventListener('click', () => {
    advanceFromKinkRank({ useDefaults: true });
  });

  mount.querySelector('.kink-rank-done')?.addEventListener('click', () => {
    advanceFromKinkRank({ useDefaults: false });
  });

  syncRoastFooter();
}

function pickRoastAnswer(key, value, cardEl) {
  state.questionnaire[key] = value;
  haptic('medium');
  try {
    gsap.to(cardEl, {
      x: 120,
      rotate: 8,
      opacity: 0,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => renderRoastCard(),
    });
  } catch {
    renderRoastCard();
  }
}

function skipRoastQuestion() {
  const questions = roastQuestions();
  const { answered, total } = roastProgress();
  if (answered >= total) return;
  const field = questions[answered];
  if (field.type === 'rank') {
    advanceFromKinkRank({ useDefaults: true });
    return;
  }
  if (!state.questionnaire[field.key]) {
    state.questionnaire[field.key] = field.options[0];
  }
  haptic('light');
  renderRoastCard();
}

function showLaunchError(message) {
  const mount = $('#onboard-complete');
  if (!mount) return;
  let err = mount.querySelector('.onboard-launch-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'onboard-launch-error';
    mount.querySelector('.onboard-complete-inner')?.append(err);
  }
  err.textContent = message;
  let retry = mount.querySelector('.onboard-retry-btn');
  if (!retry) {
    retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn-secondary onboard-retry-btn';
    retry.textContent = 'Try Again';
    retry.addEventListener('click', () => finishLaunch());
    mount.querySelector('.onboard-complete-inner')?.append(retry);
  }
}

export function clearLaunchTimer() {
  if (!state?.launchTimer) return;
  clearTimeout(state.launchTimer);
  state.launchTimer = null;
}

export function retryOnboardingLaunch() {
  if (!state?.launching) return;
  finishLaunch();
}

function finishLaunch() {
  const profile = buildProfile();
  const mount = $('#onboard-complete');
  mount?.querySelector('.onboard-launch-error')?.remove();
  mount?.querySelector('.onboard-retry-btn')?.remove();

  let status = mount?.querySelector('.onboard-launch-status');
  if (!status && mount) {
    status = document.createElement('p');
    status.className = 'onboard-launch-status';
    mount.querySelector('.onboard-complete-inner')?.append(status);
  }
  if (status) status.textContent = state.mode === 'join' ? 'Joining room…' : 'Creating room…';

  clearTimeout(state.launchTimer);
  state.launchTimer = setTimeout(() => {
    if (!$('#screen-profile')?.classList.contains('active')) return;
    const stillWaiting = mount?.querySelector('.onboard-launch-status');
    if (!stillWaiting) return;
    showLaunchError('Still waiting on the server — check connection and tap Try Again.');
  }, 12000);

  const ok = state.onSubmit?.(profile);
  if (ok === false) {
    if (status) status.remove();
    showLaunchError('Couldn\u2019t continue — check your name and connection.');
  }
}

function showComplete() {
  if (state.launching) return;
  state.launching = true;
  showStep('complete');
  const mount = $('#onboard-complete');
  mount.innerHTML = `
    <div class="onboard-complete-inner">
      <span class="onboard-complete-icon">🍸</span>
      <h2 class="onboard-complete-title">Perfect fucking fuel.</h2>
      <p class="onboard-complete-sub">I've learned enough to fuck your night up.</p>
    </div>`;
  const inner = mount.querySelector('.onboard-complete-inner');
  try {
    gsap.fromTo(inner, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' });
  } catch { /* animation optional */ }
  setTimeout(finishLaunch, 400);
}

function buildProfile() {
  const ageMeta = AGE_RANGES.find((r) => r.id === state.ageRange) || AGE_RANGES[1];
  const name = liveName() || 'Player';
  const playRole = state.playRole || inferPlayRole(name) || 'dom';
  return {
    name,
    sex: playRole === 'sub' ? 'female' : 'male',
    playRole,
    age: ageMeta.age,
    heightCm: 170,
    weightKg: 70,
    questionnaire: { ...state.questionnaire },
  };
}

function advanceStep() {
  const steps = stepsForMode(state.mode);
  const idx = steps.indexOf(state.step);
  if (idx < 0 || idx >= steps.length - 1) return;
  const next = steps[idx + 1];
  if (next === 'intensity') renderIntensityStep();
  if (next === 'deck') renderDeckStep();
  if (next === 'about') renderAboutStep();
  if (next === 'roast') {
    state.questionnaire = {};
    state.launching = false;
  }
  showStep(next);
}

function goBack() {
  if (state.step === 'complete') return;
  const steps = stepsForMode(state.mode);
  const idx = steps.indexOf(state.step);
  if (idx <= 0) {
    state.onCancel?.();
    return;
  }
  showStep(steps[idx - 1]);
}

export function initOnboarding({ onSubmit, onCancel, onChange } = {}) {
  state = {
    mode: 'create',
    step: 'about',
    gameMode: 'drinking',
    cardCategories: [...ONBOARD_RECOMMENDED],
    name: '',
    playRole: null,
    ageRange: '25-34',
    joinCode: '',
    questionnaire: {},
    launching: false,
    launchTimer: null,
    onSubmit,
    onCancel,
    onChange,
  };

  $('#onboard-back')?.addEventListener('click', goBack);
  $('#btn-onboard-next')?.addEventListener('click', () => {
    if (state.step === 'roast') {
      const questions = roastQuestions();
      const { answered, total } = roastProgress();
      if (answered < total) {
        const field = questions[answered];
        if (field?.type === 'rank' && kinkRankComplete(state.questionnaire.kinkRank)) {
          haptic('light');
          advanceFromKinkRank({ useDefaults: false });
          return;
        }
      }
    }
    if (!canAdvance(state.step)) return;
    haptic('light');
    const steps = stepsForMode(state.mode);
    const idx = steps.indexOf(state.step);
    if (idx >= steps.length - 1) {
      showComplete();
      return;
    }
    advanceStep();
  });
  $('#btn-roast-skip')?.addEventListener('click', skipRoastQuestion);

  const joinInput = $('#onboard-join-code');
  joinInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    state.joinCode = e.target.value;
    syncJoinBoxes(e.target.value);
    $('#btn-onboard-next').disabled = !canAdvance('join-code');
  });
}

function syncJoinBoxes(code) {
  const boxes = $('#onboard-join-boxes');
  if (!boxes) return;
  const chars = code.padEnd(4, '·').slice(0, 4).split('');
  boxes.querySelectorAll('.code-cell').forEach((cell, i) => {
    const c = chars[i] || '·';
    cell.textContent = c === '·' ? '' : c;
    cell.classList.toggle('filled', c !== '·');
  });
}

export function presetOnboardingName(name) {
  if (!state) return;
  const n = String(name || '').trim();
  state.name = n;
  const input = $('#onboard-name');
  if (input) input.value = n;
  syncPlayRoleFromName();
}

export function openOnboarding(mode = 'create') {
  if (!state) return;
  state.mode = mode;
  state.questionnaire = {};
  state.name = '';
  state.playRole = null;
  state.ageRange = '25-34';
  state.joinCode = '';
  state.gameMode = 'drinking';
  state.cardCategories = [...ONBOARD_RECOMMENDED];
  state.launching = false;
  clearTimeout(state.launchTimer);
  state.launchTimer = null;

  $$('.onboard-step').forEach((el) => delete el.dataset.built);
  $('#onboard-intensity')?.removeAttribute('data-built');
  $('#onboard-deck-list')?.removeAttribute('data-built');
  $('#onboard-age-ranges')?.removeAttribute('data-built');
  $('#onboard-role')?.removeAttribute('data-built');
  $('#onboard-name')?.removeAttribute('data-wired');
  const nameInput = $('#onboard-name');
  if (nameInput) nameInput.value = '';

  const first = mode === 'join' ? 'join-code' : 'about';
  renderAboutStep();
  showStep(first);
  state.onChange?.({ gameMode: state.gameMode, cardCategories: state.cardCategories });
}

export function getOnboardingState() {
  return state ? {
    mode: state.mode,
    gameMode: state.gameMode,
    cardCategories: [...state.cardCategories],
    profile: buildProfile(),
    joinCode: state.joinCode,
    ready: canAdvance('about'),
  } : null;
}
