# Go Fuck Yourself — Frontend (PWA)

Mobile-first Progressive Web App for **Go Fuck Yourself**: multiplayer Go Fish, drinking mechanics, AI bartender UI, and side games. Served by the Node server in [`../game/`](../game/) and documented in the [root README](../README.md) and [`../docs/`](../docs/).

## Run locally

From the backend package (serves this folder at `/`):

```bash
cd ../game
npm install
cp .env.example .env   # optional NVIDIA_API_KEY
npm start
```

Open `http://localhost:3000`.

## Layout

| Path | Role |
|------|------|
| `index.html` | App shell, screens, PWA meta, import map for Three.js |
| `manifest.webmanifest` | Installable PWA manifest |
| `sw.js` | Service worker (shell precache; never caches `/api` or `/ws`) |
| `css/` | Mobile-first styles (`styles.css`, `card-stacks.css`, `game-theatre.css`, `gfy-board.css`) |
| `js/app.js` | Client orchestration (lobby, game, host, drinks) |
| `js/api.js` | WebSocket + REST (`/ws`, `/api/host`, `/api/detect-drink`) |
| `js/game.js` | Go Fish rules, ranks, scenarios — **also imported by the server** |
| `js/bac.js` | BAC / drunk meter — shared with server |
| `js/cards.js`, `card-stacks.js`, `motion.js`, … | Card UI, physics, theatre |
| `js/sidegames/` | Fucking UNO, Bloody Fuck, hub UI |
| `assets/` | Icons and imagery |
| `spin-bottle/` | Built embed from `game/spin-bottle/` (Vite) |

## Official game workflow (rule sheet)

On **Start Game** / **Deal next round**, the client runs a table opening (`js/table-opening.js`):

1. **Shuffle** — animated riffle (server also shuffles in `game.js` when the room starts).
2. **Deal** — 5 cards each for 2–4 players, 4 each for 5–6 (matches server deal).
3. **Pond** — remaining deck becomes the face-down draw pile.
4. **Fan** — your hand fans in; play proceeds **clockwise**.

During play: ask for a situation you hold; on a miss the defender says **GO FUCK YOURSELF!** and you draw one; lucky draw continues your turn; four of a kind → **Sweet, I officially have [situation]** (bank set). Most sets wins.

## Architecture alignment

Product and UX specs live under [`../docs/requirements/`](../docs/requirements/) and [`../docs/architecture/`](../docs/architecture/):

- **Information architecture** — player profile, session, cards (`gfy_information_architecture.md`)
- **Interaction** — tap/hold/drag card patterns, 44pt targets (`gfy_interaction_architecture.md`)
- **Motion** — GSAP/card physics, no instant state jumps (`gfy_motion_system.md`)
- **Audio** — procedural/table sounds (`gfy_audio_system.md`)
- **Multiplayer** — authoritative server; this client only sees its own hand (`gfy_multiplayer_architecture.md`)

## Split deployment

If static files are on Vercel/Netlify and the API on Render/Railway, uncomment and set in `index.html`:

```html
<meta name="gfy-server" content="https://your-api.onrender.com" />
```

Live two-phone play still requires WebSocket on the backend (`game/server.js`).

## Build spin-the-bottle

```bash
cd ../game/spin-bottle
npm install
npx vite build
```

Output: `frontend/spin-bottle/`.

## License

MIT — same as the repository.
