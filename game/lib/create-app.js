// Express app factory — shared by server.js (local/Render) and Vercel serverless.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOST_SYSTEM_PROMPT,
  VISION_IDENTIFY_PROMPT,
  VISION_RUM_LABEL_PROMPT,
  buildHostUserPrompt,
  fallbackHostLine,
  unidentifiedDrink,
} from './prompts.js';
import {
  applyCatalogSnap,
  drinkNeedsRumRetry,
  drinkLooksLikeBeerMisparse,
  looksLikeBottleSpirit,
  calcStandardDrinks,
  catalogToDrink,
  DRINK_CATALOG,
} from './drink-catalog.js';
import {
  shouldUseNIM,
  pickCachedLine,
  splitBartenderCopy,
} from './bartender-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ publicDir, vendorDir, env = process.env } = {}) {
  const {
    NVIDIA_API_KEY,
    NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1',
    HOST_MODEL = 'meta/llama-3.3-70b-instruct',
    VISION_MODEL = 'meta/llama-3.2-90b-vision-instruct',
  } = env;

  const hasKey = Boolean(NVIDIA_API_KEY && NVIDIA_API_KEY.startsWith('nvapi-'));
  const pub = publicDir || path.join(__dirname, '..', '..', 'frontend');
  const vend = vendorDir || path.join(__dirname, '..', 'node_modules');

  const app = express();
  app.use(express.json({ limit: '12mb' }));

  async function nvidiaChat({ model, messages, temperature = 1.0, maxTokens = 320 }) {
    const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p: 0.95,
        max_tokens: maxTokens,
        stream: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NVIDIA API ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? '';
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiEnabled: hasKey,
      hostModel: HOST_MODEL,
      visionModel: VISION_MODEL,
      transport: 'websocket',
    });
  });

  async function getHostLine(ctx = {}) {
    const gameEvent = ctx.gameEvent;
    const mode = ctx.bartenderMode || 'roast';

    if (gameEvent && !shouldUseNIM(gameEvent, mode, ctx.roomSnapshot)) {
      return pickCachedLine(mode, gameEvent, ctx.roomSnapshot || {});
    }

    if (!hasKey) return fallbackHostLine(ctx);

    try {
      const isManual = String(ctx.mode || '').startsWith('manual_');
      const text = await nvidiaChat({
        model: HOST_MODEL,
        temperature: ctx.mode === 'intervention' ? 0.7 : 0.92,
        maxTokens: isManual ? 120 : gameEvent ? 48 : 80,
        messages: [
          { role: 'system', content: HOST_SYSTEM_PROMPT },
          { role: 'user', content: buildHostUserPrompt(ctx) },
        ],
      });
      const raw = text || fallbackHostLine(ctx);
      return splitBartenderCopy(raw).line;
    } catch (err) {
      console.error('[host]', err.message);
      return gameEvent ? pickCachedLine(mode, gameEvent, ctx.roomSnapshot || {}) : fallbackHostLine(ctx);
    }
  }

  app.post('/api/host', async (req, res) => {
    const text = await getHostLine(req.body || {});
    res.json({ text, source: hasKey ? 'nvidia' : 'offline' });
  });

  async function visionIdentifyDrink(dataUrl, { labelFocus = false, rumFocus = false } = {}) {
    const system = rumFocus ? VISION_RUM_LABEL_PROMPT : VISION_IDENTIFY_PROMPT;
    const userText = rumFocus
      ? 'Read the label. If this is Old Monk rum, say so. JSON only.'
      : labelFocus
        ? 'Read the label on this bottle/can. Name the exact brand from printed text. JSON only.'
        : 'Identify this drink. Read visible label text. JSON only.';
    return nvidiaChat({
      model: VISION_MODEL,
      temperature: 0.05,
      maxTokens: 480,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });
  }

  async function visionParseDrink(dataUrl) {
    const runs = [
      () => visionIdentifyDrink(dataUrl, {}),
      () => visionIdentifyDrink(dataUrl, { labelFocus: true }),
      () => visionIdentifyDrink(dataUrl, { rumFocus: true }),
    ];
    const candidates = [];
    for (const run of runs) {
      try {
        const parsed = extractJson(await run());
        if (parsed) candidates.push(parsed);
      } catch (err) {
        console.warn('[detect-drink] vision attempt:', err.message);
      }
    }
    if (!candidates.length) return null;

    for (const parsed of candidates) {
      const snapped = applyCatalogSnap(parsed);
      if (snapped?.name === 'Old Monk Rum') return snapped;
    }
    for (const parsed of candidates) {
      const snapped = applyCatalogSnap(parsed);
      if (snapped) return snapped;
    }
    const spirit = candidates.find((p) => String(p.category || '').toLowerCase() === 'spirit');
    if (spirit) return spirit;

    const bottleSpirit = candidates.find((p) => looksLikeBottleSpirit(p));
    if (bottleSpirit) {
      const monk = applyCatalogSnap({
        ...bottleSpirit,
        name: bottleSpirit.name || 'Rum',
        category: 'spirit',
        facts: [...(bottleSpirit.facts || []), 'rum bottle'],
      });
      if (monk) return monk;
    }

    const suspicious = candidates.find((p) => drinkLooksLikeBeerMisparse(p) || drinkNeedsRumRetry(p));
    if (suspicious) {
      const monk = applyCatalogSnap({ name: 'Old Monk Rum', category: 'spirit', facts: ['old monk'] });
      if (monk) return monk;
    }

    const last = candidates[candidates.length - 1];
    const cat = String(last.category || '').toLowerCase();
    if (cat === 'shot' && !/\bvodka\b/i.test(`${last.name} ${(last.facts || []).join(' ')}`)) {
      return catalogToDrink(DRINK_CATALOG[0], 180);
    }
    return last;
  }

  async function drinkScanRoast(name) {
    try {
      const text = await getHostLine({
        mode: 'roast',
        extra: `Player just scanned and is drinking: ${name}. One savage line about that specific drink.`,
      });
      return text?.slice(0, 240) || '';
    } catch {
      return '';
    }
  }

  app.post('/api/detect-drink', async (req, res) => {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'no image' });
    if (!hasKey) {
      return res.status(503).json({
        ...unidentifiedDrink(),
        source: 'offline',
        error: 'NVIDIA_API_KEY not set — use manual drink pick.',
      });
    }

    try {
      const dataUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      const parsed = await visionParseDrink(dataUrl);
      if (!parsed) {
        console.warn('[detect-drink] all vision attempts failed to parse JSON');
        return res.status(422).json({ ...unidentifiedDrink(), source: 'parse-failed' });
      }
      let drink = normalizeDrink(parsed);
      const snapped = applyCatalogSnap(parsed);
      if (snapped) {
        drink = { ...drink, ...snapped, volumeMl: snapped.volumeMl, abv: snapped.abv, name: snapped.name };
      }
      if (!drink.standardDrinks) {
        drink.standardDrinks = calcStandardDrinks(drink.volumeMl, drink.abv);
      }
      const guessed = drink.confidence === 'low' || drinkNeedsRumRetry(parsed);
      if (!drink.roast) {
        if (snapped?.roast) drink.roast = snapped.roast;
        else if (hasKey) drink.roast = await drinkScanRoast(drink.name);
      }
      if (!drink.roast) drink.roast = `You're pounding ${drink.name}? Bold fucking choice.`;
      res.json({ ...drink, source: 'nvidia', guessed });
    } catch (err) {
      console.error('[detect-drink]', err.message);
      res.status(502).json({ ...unidentifiedDrink(), source: 'error', error: err.message });
    }
  });

  const assetPath = /\.(css|js|mjs|json|png|jpe?g|gif|webp|svg|ico|woff2?|webmanifest|map|txt)$/i;

  app.use(express.static(pub, {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.css')) res.type('text/css');
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) res.type('application/javascript');
    },
  }));
  app.use('/vendor/three', express.static(path.join(vend, 'three/build'), { immutable: true, maxAge: '30d' }));
  app.use('/vendor/three/addons', express.static(path.join(vend, 'three/examples/jsm'), { immutable: true, maxAge: '30d' }));
  app.use('/vendor/gsap', express.static(path.join(vend, 'gsap'), { immutable: true, maxAge: '30d' }));
  app.use('/vendor/matter-js', express.static(path.join(vend, 'matter-js/build'), { immutable: true, maxAge: '30d' }));

  app.get('*', (req, res) => {
    if (assetPath.test(req.path)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.sendFile(path.join(pub, 'index.html'));
  });

  return { app, getHostLine, hasKey };
}

function extractJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeDrink(d) {
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  const cat = String(d.category || 'mixed').toLowerCase();
  const defaultAbv = cat === 'spirit' || cat === 'shot' ? 40 : 5;
  const defaultVol = cat === 'spirit' ? 180 : cat === 'shot' ? 40 : 330;
  return {
    name: String(d.name || d.drink || 'Unknown booze').slice(0, 80),
    category: String(d.category || 'mixed').slice(0, 40),
    abv: Math.min(96, num(d.abv ?? d.alcohol_percent, defaultAbv)),
    volumeMl: Math.min(2000, num(d.volume_ml ?? d.volumeMl ?? d.volume, defaultVol)),
    standardDrinks: num(d.standard_drinks ?? d.standardDrinks, 0) || undefined,
    facts: Array.isArray(d.facts) ? d.facts.slice(0, 4).map((f) => String(f).slice(0, 200)) : [],
    confidence: String(d.confidence || 'medium').replace(/\s*\(.*\)$/, '').slice(0, 24),
    roast: String(d.roast || '').slice(0, 240),
  };
}
