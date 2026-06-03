// ===========================================================================
//  UNO card faces — Mattel-style replica (Show 'Em No Mercy deck).
//  Classic layout: white inset border, corner pips, center oval / wild art.
// ===========================================================================

/** Official UNO palette (Mattel) */
const COLORS = {
  red: '#E40521',
  yellow: '#FFCD00',
  green: '#009246',
  blue: '#0081CD',
};

const INK = { red: '#fff', green: '#fff', blue: '#fff', yellow: '#1a1a1a', wild: '#fff' };
const WILD_BG = '#000000';

function isWildCard(c) {
  return c?.color === 'wild' || c?.type?.startsWith('wild');
}

function svgWrap(inner) {
  return `<svg class="uno-svg" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/** Four tilted color ellipses — classic Wild / Wild Draw card art */
function svgWildQuadrants() {
  return `
    <ellipse cx="30" cy="32" rx="16" ry="24" fill="${COLORS.red}" transform="rotate(-35 30 32)"/>
    <ellipse cx="70" cy="32" rx="16" ry="24" fill="${COLORS.yellow}" transform="rotate(35 70 32)"/>
    <ellipse cx="30" cy="68" rx="16" ry="24" fill="${COLORS.green}" transform="rotate(-35 30 68)"/>
    <ellipse cx="70" cy="68" rx="16" ry="24" fill="${COLORS.blue}" transform="rotate(35 70 68)"/>
  `;
}

/** Classic Skip — circle, stick figure, diagonal slash */
function svgSkip(ink) {
  return svgWrap(`
    <circle cx="50" cy="50" r="36" fill="none" stroke="${ink}" stroke-width="4.5"/>
    <circle cx="50" cy="28" r="7" fill="${ink}"/>
    <path d="M50 36 L42 62 M50 36 L58 62" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <line x1="24" y1="24" x2="76" y2="76" stroke="${ink}" stroke-width="5.5" stroke-linecap="round"/>
  `);
}

/** Classic Reverse — twin curved arrows */
function svgReverse(ink) {
  return svgWrap(`
    <path d="M26 58 C36 28, 64 28, 74 58" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>
    <path d="M74 58 L66 48 M74 58 L66 68" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
    <path d="M74 42 C64 72, 36 72, 26 42" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>
    <path d="M26 42 L34 32 M26 42 L34 52" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  `);
}

/** Classic Draw Two — fanned cards + +2 */
function svgDrawTwo(ink, cardBg) {
  return svgWrap(`
    <rect x="16" y="22" width="30" height="42" rx="4" fill="#fff" stroke="${cardBg}" stroke-width="2" transform="rotate(-14 31 43)"/>
    <rect x="24" y="18" width="30" height="42" rx="4" fill="#fff" stroke="${cardBg}" stroke-width="2" transform="rotate(8 39 39)"/>
    <text x="62" y="58" fill="${ink}" font-family="Arial Black, Arial, sans-serif" font-size="32" font-weight="900">+2</text>
  `);
}

/** Colored Draw Four (No Mercy) — fanned cards + +4 on color */
function svgDrawFourColored(ink, cardBg) {
  return svgWrap(`
    <rect x="14" y="20" width="28" height="40" rx="4" fill="#fff" stroke="${cardBg}" stroke-width="2" transform="rotate(-16 28 40)"/>
    <rect x="22" y="16" width="28" height="40" rx="4" fill="#fff" stroke="${cardBg}" stroke-width="2" transform="rotate(-4 36 36)"/>
    <rect x="30" y="14" width="28" height="40" rx="4" fill="#fff" stroke="${cardBg}" stroke-width="2" transform="rotate(10 44 34)"/>
    <text x="64" y="58" fill="${ink}" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="900">+4</text>
  `);
}

/** Wild — four quadrants only */
function svgWild() {
  return svgWrap(svgWildQuadrants());
}

/** Wild Draw Four / Six / Ten — quadrants + label */
function svgWildDraw(label) {
  return svgWrap(`
    ${svgWildQuadrants()}
    <text x="50" y="54" fill="#fff" font-family="Arial Black, Arial, sans-serif" font-size="${label.length > 2 ? 26 : 30}" font-weight="900" text-anchor="middle">${label}</text>
  `);
}

/** Skip Everyone — twin skip icons, no text */
function svgSkipEveryone(ink) {
  return svgWrap(`
    <circle cx="36" cy="44" r="18" fill="none" stroke="${ink}" stroke-width="3.5"/>
    <circle cx="36" cy="34" r="4.5" fill="${ink}"/>
    <path d="M36 40 L32 54 M36 40 L40 54" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <line x1="26" y1="30" x2="46" y2="50" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="64" cy="44" r="18" fill="none" stroke="${ink}" stroke-width="3.5"/>
    <circle cx="64" cy="34" r="4.5" fill="${ink}"/>
    <path d="M64 40 L60 54 M64 40 L68 54" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <line x1="54" y1="30" x2="74" y2="50" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
  `);
}

/** Discard All — stacked cards dropping */
function svgDiscardAll(ink) {
  return svgWrap(`
    <rect x="20" y="28" width="22" height="32" rx="3" fill="#fff" opacity="0.5" transform="rotate(-20 31 44)"/>
    <rect x="32" y="24" width="22" height="32" rx="3" fill="#fff" opacity="0.75" transform="rotate(0 43 40)"/>
    <rect x="44" y="28" width="22" height="32" rx="3" fill="#fff" transform="rotate(18 55 44)"/>
    <path d="M50 66 L50 80 M42 74 L50 82 L58 74" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
  `);
}

/** Color Roulette — wild quadrants + spinner */
function svgColorRoulette() {
  return svgWrap(`
    ${svgWildQuadrants()}
    <circle cx="50" cy="50" r="18" fill="none" stroke="#fff" stroke-width="2.5"/>
    <line x1="50" y1="50" x2="50" y2="32" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="3.5" fill="#fff"/>
  `);
}

/** Wild Reverse Draw Four */
function svgWildReverseDraw4() {
  return svgWrap(`
    ${svgWildQuadrants()}
    <path d="M30 54 C38 44, 62 44, 70 54" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M70 54 L64 48 M70 54 L64 60" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <text x="50" y="68" fill="#fff" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="900" text-anchor="middle">+4</text>
  `);
}

function centerArt(card, ink, cardBg) {
  const { type, value } = card;

  if (type === 'number') {
    const numColor = card.color === 'yellow' ? '#1a1a1a' : cardBg;
    return `<div class="uno-oval"><span class="uno-num" style="color:${numColor}">${value}</span></div>`;
  }

  const map = {
    skip: svgSkip(ink),
    reverse: svgReverse(ink),
    draw2: svgDrawTwo(ink, cardBg),
    draw4: svgDrawFourColored(ink, cardBg),
    skipEveryone: svgSkipEveryone(ink),
    discardAll: svgDiscardAll(ink),
    wild: svgWild(),
    wildDraw6: svgWildDraw('+6'),
    wildDraw10: svgWildDraw('+10'),
    wildColorRoulette: svgColorRoulette(),
    wildReverseDraw4: svgWildReverseDraw4(),
  };
  return map[type] || `<div class="uno-oval"><span class="uno-num">?</span></div>`;
}

function cornerSymbol(card) {
  if (card.type === 'number') return String(card.value);
  const labels = {
    skip: '⊘',
    reverse: '⇄',
    draw2: '+2',
    draw4: '+4',
    skipEveryone: '⏭',
    discardAll: '📤',
    wild: '◆',
    wildDraw6: '+6',
    wildDraw10: '+10',
    wildColorRoulette: '🎲',
    wildReverseDraw4: '⇄4',
  };
  return labels[card.type] || '?';
}

function cornerHtml(card, ink, position, cardBg) {
  const sym = cornerSymbol(card);
  const isNum = card.type === 'number';
  const wild = isWildCard(card);

  if (wild) {
    return `
      <div class="uno-corner uno-corner--${position} uno-corner--wild">
        <span class="uno-corner-sym">${sym}</span>
      </div>`;
  }

  if (isNum) {
    return `
      <div class="uno-corner uno-corner--${position}">
        <span class="uno-corner-sym">${sym}</span>
        <span class="uno-corner-dot" aria-hidden="true"></span>
      </div>`;
  }

  return `
    <div class="uno-corner uno-corner--${position} uno-corner--action">
      <span class="uno-corner-sym uno-corner-sym--action">${sym}</span>
    </div>`;
}

const CARD_HINTS = {
  skip: 'Skip the next player',
  reverse: 'Reverse turn order',
  draw2: 'Next player draws 2',
  draw4: 'Next player draws 4',
  skipEveryone: 'Skip everyone — you go again',
  discardAll: 'Discard all cards of this color',
  wild: 'Pick any color',
  wildDraw6: 'Next player draws 6',
  wildDraw10: 'Next player draws 10',
  wildColorRoulette: 'Draw until you hit a color',
  wildReverseDraw4: 'Reverse + draw 4',
};

export function cardHintText(card) {
  if (card.type === 'number') return `${card.color} ${card.value}`;
  return CARD_HINTS[card.type] || ariaLabel(card);
}

function ariaLabel(card) {
  const names = { red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue', wild: 'Wild' };
  const color = names[card.color] || card.color;
  if (card.type === 'number') return `${color} ${card.value}`;
  const types = {
    skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', draw4: 'Draw Four',
    skipEveryone: 'Skip Everyone', discardAll: 'Discard All', wild: 'Wild',
    wildDraw6: 'Wild Draw Six', wildDraw10: 'Wild Draw Ten',
    wildColorRoulette: 'Color Roulette', wildReverseDraw4: 'Wild Reverse Draw Four',
  };
  return `${color} ${types[card.type] || card.type}`;
}

/** Render a single UNO-style card face. */
export function renderUnoCard(card, { large = false } = {}) {
  if (!card) return '';

  const wild = isWildCard(card);
  const colorKey = wild ? 'wild' : card.color;
  const bg = wild ? WILD_BG : (COLORS[card.color] || '#333');
  const ink = INK[colorKey] || '#fff';
  const size = large ? ' uno-card--lg' : '';
  const typeCls = card.type === 'number' ? ' uno-card--number' : ` uno-card--${card.type}`;

  return `<article class="uno-card uno-card--${colorKey}${typeCls}${size}" style="--uno-bg:${bg};--uno-ink:${ink}" aria-label="${ariaLabel(card)}">
    ${cornerHtml(card, ink, 'tl', bg)}
    <div class="uno-art">${centerArt(card, ink, bg)}</div>
    ${cornerHtml(card, ink, 'br', bg)}
  </article>`;
}

/** Classic Mattel UNO card back */
export function renderUnoCardBack({ large = false, mini = false, stack = false } = {}) {
  const size = large ? ' uno-card--lg' : mini ? ' uno-card--mini' : '';
  const stackCls = stack ? ' uno-card--stack-layer' : '';
  return `<article class="uno-card uno-card--back${size}${stackCls}" aria-hidden="true">
    <div class="uno-back-pattern"></div>
    ${stack ? '' : `<div class="uno-back-oval"><span class="uno-back-logo">${mini ? '' : 'UNO'}</span></div>`}
  </article>`;
}

export function renderUnoPhysicalDeck(count) {
  if (!count) return '<div class="deck-empty">—</div>';
  const layers = Math.min(4, Math.max(2, Math.ceil(Math.log10(count + 1) * 1.5)));
  let html = '';
  for (let i = 0; i < layers; i++) {
    const off = i * 1.5;
    const isTop = i === layers - 1;
    html += `<div class="deck-layer" style="transform:translate(${off * 0.5}px, ${-off}px) rotate(${-1.5 + i * 0.8}deg)">${renderUnoCardBack({ stack: !isTop })}</div>`;
  }
  return html;
}

export function renderUnoOpponentHand(count, { maxShow = 9 } = {}) {
  if (!count) return '';
  const show = Math.min(count, maxShow);
  let html = '<div class="opp-hand-fan uno-opp-fan">';
  const mid = (show - 1) / 2;
  for (let i = 0; i < show; i++) {
    const rot = show > 1 && mid ? ((i - mid) / mid) * 14 : 0;
    html += `<span class="opp-mini-slot" style="--opp-rot:${rot}deg">${renderUnoCardBack({ mini: true, stack: true })}</span>`;
  }
  html += '</div>';
  return html;
}
