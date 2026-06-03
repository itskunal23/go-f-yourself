/**
 * Drink scanner — photo → NVIDIA NIM vision → logDrink with BAC inputs.
 */
import { detectDrink, fileToResizedDataUrl } from './api.js';
import { GameAudio } from './game-audio.js';
import { haptic } from './mobile.js';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function standardDrinksFor(d) {
  if (d.standardDrinks) return d.standardDrinks;
  const vol = Number(d.volumeMl) || 330;
  const abv = Number(d.abv) || 5;
  return +((vol * abv / 100 * 0.789) / 14).toFixed(2);
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount
 * @param {(payload: { drink: object, cheersToast?: string }) => void} opts.onConfirm
 * @param {object} [opts.cheers] — official "Cheers to You" round
 */
export function mountDrinkScanner(mount, { onConfirm, cheers = null, reason = '' } = {}) {
  if (!mount) return () => {};

  let scanResult = null;
  let scanning = false;

  const toastRequired = !!cheers?.requireToast;
  const defaultToast = cheers?.cheersToast || '';

  mount.innerHTML = `
    <div class="drink-scanner${cheers ? ' drink-scanner--cheers' : ''}">
      ${cheers ? `
        <div class="cheers-card">
          <h3 class="cheers-card__title">CHEERS TO YOU!</h3>
          <p class="cheers-card__rule">Someone banked a set. Say it out loud, then drink.</p>
          <blockquote class="cheers-card__toast">"${esc(defaultToast)}"</blockquote>
          <p class="cheers-card__sub">${esc(cheers.cheersBankerName || 'They')} officially has <strong>${esc(cheers.cheersCard || '')}</strong></p>
        </div>
        <label class="cheers-toast-field">
          <span>I said the toast</span>
          <input type="text" class="cheers-toast-input" value="${esc(defaultToast)}" maxlength="120" />
        </label>
      ` : `
        <p class="drink-scanner__reason">${esc(reason || 'Log what you drank — vision sizes it for your BAC bar.')}</p>
      `}
      <div class="drink-scanner__preview hidden" id="drink-scan-preview">
        <img class="drink-scan-thumb" alt="" />
        <div class="drink-scan-result"></div>
      </div>
      <div class="drink-scanner__actions">
        <label class="btn-primary big drink-scan-btn">
          <input type="file" accept="image/*" capture="environment" class="drink-scan-input" hidden />
          📷 Scan your drink
        </label>
        <button type="button" class="btn-secondary" id="drink-scan-manual">Pick drink manually</button>
      </div>
      <div class="drink-manual-pick hidden" id="drink-manual-pick"></div>
      <button type="button" class="btn-primary big hidden" id="drink-scan-confirm" disabled>I fucking drank it</button>
      <p class="drink-scanner__hint">Uses NVIDIA vision on the label — volume &amp; ABV feed your sober→drunk bar (height &amp; weight).</p>
    </div>`;

  const fileInput = mount.querySelector('.drink-scan-input');
  const preview = mount.querySelector('#drink-scan-preview');
  const thumb = preview?.querySelector('.drink-scan-thumb');
  const resultEl = preview?.querySelector('.drink-scan-result');
  const confirmBtn = mount.querySelector('#drink-scan-confirm');
  const manualWrap = mount.querySelector('#drink-manual-pick');
  const toastInput = mount.querySelector('.cheers-toast-input');

  const QUICK = [
    { name: 'Old Monk Rum', volumeMl: 180, abv: 42.8 },
    { name: 'Beer', volumeMl: 330, abv: 5 },
    { name: 'Wine', volumeMl: 150, abv: 12 },
    { name: 'Shot', volumeMl: 40, abv: 40 },
    { name: 'Cocktail', volumeMl: 200, abv: 12 },
  ];

  function setResult(drink, { guessed = false } = {}) {
    scanResult = {
      name: drink.name,
      volumeMl: drink.volumeMl,
      abv: drink.abv,
      scanned: true,
      visionSource: drink.source || 'nvidia',
      standardDrinks: standardDrinksFor(drink),
      lowConfidence: guessed,
    };
    if (resultEl) {
      resultEl.innerHTML = `
        <strong>${esc(drink.name)}</strong>
        <span>${drink.volumeMl}ml · ${drink.abv}% ABV · ~${scanResult.standardDrinks} std</span>
        ${guessed ? '<em class="drink-scan-guess">Low confidence — retake the label or tap confirm below</em>' : ''}
        ${drink.roast ? `<p class="drink-scan-roast">${esc(drink.roast)}</p>` : ''}`;
    }
    confirmBtn?.classList.remove('hidden');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = guessed ? 'Log this guess anyway' : 'I fucking drank it';
    }
    GameAudio.cardDraw?.();
    haptic('success');
  }

  async function runScan(file) {
    if (!file || scanning) return;
    scanning = true;
    confirmBtn.disabled = true;
    resultEl.innerHTML = '<span class="drink-scan-loading">Reading label…</span>';
    preview?.classList.remove('hidden');
    manualWrap?.classList.add('hidden');

    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (thumb) {
        thumb.src = dataUrl;
        thumb.classList.remove('hidden');
      }
      const drink = await detectDrink(dataUrl);
      const lowConf = drink.guessed || String(drink.confidence || '').startsWith('low');
      setResult(drink, { guessed: lowConf });
    } catch (err) {
      resultEl.innerHTML = `<span class="drink-scan-error">${esc(err.message || 'Scan failed')}</span>`;
      haptic('medium');
    } finally {
      scanning = false;
    }
  }

  fileInput?.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void runScan(f);
    fileInput.value = '';
  });

  mount.querySelector('#drink-scan-manual')?.addEventListener('click', () => {
    manualWrap?.classList.remove('hidden');
    manualWrap.innerHTML = QUICK.map((d, i) =>
      `<button type="button" class="ios-row drink-manual-btn" data-i="${i}">
        <span class="ios-row-label">${esc(d.name)}</span>
        <span class="d-sub">${d.volumeMl}ml · ${d.abv}%</span>
      </button>`,
    ).join('');
    manualWrap.querySelectorAll('.drink-manual-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = QUICK[+btn.dataset.i];
        setResult({ ...d, source: 'manual' });
        preview?.classList.remove('hidden');
        if (thumb) thumb.classList.add('hidden');
      });
    });
  });

  confirmBtn?.addEventListener('click', () => {
    if (!scanResult) return;
    const payload = { drink: scanResult };
    if (toastRequired && toastInput) {
      payload.cheersToast = String(toastInput.value || defaultToast).trim().slice(0, 120);
    }
    onConfirm?.(payload);
  });

  return () => {
    scanResult = null;
    mount.innerHTML = '';
  };
}
