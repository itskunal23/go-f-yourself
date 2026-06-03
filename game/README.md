# Go Fuck Yourself

Real-time, two-device party card game with an AI host, computer-vision drink logging, and BAC-aware safety prompts. Delivered as a mobile-first Progressive Web App (PWA) optimized for iOS.

| | |
|---|---|
| **Stack** | Node.js, Express, WebSocket (`ws`), vanilla ES modules |
| **AI** | NVIDIA Build API (LLM + vision), server-side proxy |
| **Clients** | Two phones (or browser tabs) per room |
| **License** | MIT |

---

## Disclaimer

**21+ only. Drink responsibly.** This application is entertainment software, not medical or safety advice. BAC estimates are approximate. Never drive after drinking. Hosts are responsible for player safety and local laws.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [API reference](#api-reference)
- [Mobile and PWA](#mobile-and-pwa)
- [Project structure](#project-structure)
- [Security](#security)
- [Repository](#repository)

---

## Overview

**Go Fuck Yourself** extends classic Go Fish into a synchronized, server-authoritative multiplayer session. Each player uses their own device; the server holds deck state, validates turns, generates shared AI host dialogue, and broadcasts personalized snapshots over WebSocket.

Primary use cases:

- Two-player sessions with a shared room code
- Single-device play with an automated mock opponent when no second player joins
- Optional side games (e.g. UNO variant) integrated with drink logging and the AI host

---

## Features

### Session and multiplayer

| Capability | Description |
|------------|-------------|
| Room codes | Four-letter codes; ambiguous characters (I, O, 0, 1) excluded |
| Authoritative server | Deck and game state on server; each client receives only its own hand |
| WebSocket sync | Real-time snapshots on `/ws` with auto-reconnect and session tokens |
| Host controls | Host starts games and can restart after a win |
| Solo mode | Mock bot partner joins when only one human is present |
| Room lifecycle | Idle rooms expire after six hours; heartbeat drops dead connections |

### Core card game

- Standard Go Fish flow: seven-card deal, ask for ranks, collect sets of four
- Thirteen scenario ranks (A–K) with dares, card types, and themed art
- Server-side turn validation (turn order, rank held, pending drinks resolved)
- Animated card UI (GSAP), procedural audio, full-screen “miss” feedback

### AI host

| Item | Detail |
|------|--------|
| Provider | NVIDIA Build (`integrate.api.nvidia.com`) |
| Text model | Default `meta/llama-3.3-70b-instruct` |
| Vision model | Default `meta/llama-3.2-90b-vision-instruct` |
| Proxy | All inference server-side; API key never sent to browsers |
| Fallback | Offline line bank when `NVIDIA_API_KEY` is unset |
| Personalization | Player profile, questionnaire answers, game events |
| Modes | Roast, question, dare; triggered by UI and game events |

### Drinking and safety

- Drink logging with presets and optional vision-based identification
- BAC estimation (Watson body water + Widmark elimination) mapped to a 0–10 scale
- Intervention prompts at high levels; shared logic in `frontend/js/bac.js`
- Pending drink queue with skip (“chicken out”) support

### Side games

Launch from lobby or in-game hub. Pass-and-play helpers reuse room player names. **Fucking UNO** includes LLM-generated scenarios with offline fallbacks.

### Client experience

- Installable PWA (`manifest.webmanifest`, service worker)
- iOS-oriented UI: safe-area insets, 44px touch targets, bottom sheets, HIG-aligned controls
- Static vendor bundles (Three.js, GSAP, Matter.js) served from the Node app

---

## Architecture

```text
┌─────────────┐     HTTPS/WSS      ┌──────────────────────────────────┐
│  Phone A    │ ◄────────────────► │  server.js                       │
│  (PWA)      │                    │  Express (HTTP) + WebSocket /ws    │
└─────────────┘                    │  lib/rooms.js — game state       │
┌─────────────┐                    │  lib/create-app.js — API + static  │
│  Phone B    │ ◄────────────────► │  NVIDIA proxy (/api/host, etc.)  │
│  (PWA)      │                    └──────────────────────────────────┘
└─────────────┘
```

**Data flow**

1. Clients send intents over WebSocket (`create`, `join`, `ask`, `logDrink`, …).
2. Server validates, updates room state, optionally calls NVIDIA for host lines.
3. Server pushes per-player snapshots (own hand, opponent hand count, books, prompts, host text).

**Split deployment (optional)**  
Static hosting on Vercel/Netlify is supported only with a separate backend that exposes WebSocket. Set `<meta name="gfy-server" content="https://your-api-host" />` in `frontend/index.html`. See [Deployment](#deployment).

---

## Requirements

- **Node.js** 18+ (ES modules)
- **npm**
- **NVIDIA API key** (recommended for production AI; optional for offline fallback)
- **HTTPS** for production PWA install and camera access on iOS

---

## Quick start

```bash
git clone https://github.com/itskunal23/go-f-yourself.git
cd go-f-yourself
npm install
cp .env.example .env
# Edit .env — set NVIDIA_API_KEY (see Configuration)
npm start
```

Open `http://localhost:3000`.

**Local two-device test (same network)**

1. Note the host machine LAN IP (e.g. `192.168.1.42`).
2. On both devices: `http://<lan-ip>:3000`
3. Device A: create room → share code. Device B: join. Host starts the game.

**Single device**  
Create a room; mock bot joins if no second player connects. Two browser tabs also work for development.

Verify AI status: `GET http://localhost:3000/api/health` → `"aiEnabled": true` when the key is valid.

---

## Configuration

Copy `.env.example` to `.env`. **Never commit `.env`.**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NVIDIA_API_KEY` | Recommended | — | NVIDIA Build key (`nvapi-…`) |
| `NVIDIA_BASE_URL` | No | `https://integrate.api.nvidia.com/v1` | API base URL |
| `HOST_MODEL` | No | `meta/llama-3.3-70b-instruct` | Text / host model |
| `VISION_MODEL` | No | `meta/llama-3.2-90b-vision-instruct` | Drink vision model |
| `PORT` | No | `3000` | HTTP listen port |

Obtain a key at [build.nvidia.com](https://build.nvidia.com) (developer tier; rate limits apply).

---

## Deployment

### Recommended: Render (full stack)

WebSocket and in-memory rooms require a long-running Node process. Use the **repository root** `render.yaml` and `package.json` on [Render](https://render.com).

1. Connect the GitHub repository.
2. **New → Blueprint**, or Web Service: **Root Directory** empty, **Build** `npm install`, **Start** `npm start` (root `postinstall` installs `game/` dependencies). Or set **Root Directory** = `game` with the same build/start commands.
3. Set `NVIDIA_API_KEY` in environment variables (Dashboard → Environment).
4. Confirm health: `https://go-f-yourself.onrender.com/api/health`
5. On each phone: open **https://go-f-yourself.onrender.com** → **Share → Add to Home Screen**.

**Production URL (canonical):** [https://go-f-yourself.onrender.com](https://go-f-yourself.onrender.com) — older `*-8ljg.onrender.com` URLs may not serve CSS and will show unstyled HTML.

| Render plan | Multiplayer | AI | Notes |
|-------------|-------------|-----|-------|
| Free | Yes | Yes | Cold start after ~15 min idle; 750 instance hours/month |
| Paid | Yes | Yes | No spin-down; suitable for frequent use |

### Vercel / Netlify

| Setup | Multiplayer | Notes |
|-------|-------------|-------|
| Render only | Yes | Preferred |
| CDN + Render backend | Yes | Set `gfy-server` meta to API origin |
| Vercel/Netlify only | No | No WebSocket on serverless; `/api` partial only |

`vercel.json` and `api/index.js` support serverless HTTP routes; **live two-phone play still requires `server.js` on Render, Railway, or Fly.io.**

### Production checklist

- [ ] `NVIDIA_API_KEY` set on host (not in git)
- [ ] `/api/health` returns `aiEnabled: true`
- [ ] Both clients use **https://go-f-yourself.onrender.com** (same origin)
- [ ] `/css/styles.css` returns `200` with `Content-Type: text/css` (not HTML)
- [ ] PWA installed from home screen on iOS for best UX

---

## API reference

### HTTP

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Service health, `aiEnabled`, model IDs |
| `POST` | `/api/host` | Generate host line (JSON body: mode, player context) |
| `POST` | `/api/detect-drink` | Vision drink identification (base64 image) |

### WebSocket (`/ws`)

Intents include: `create`, `join`, `rejoin`, `start`, `ask`, `logDrink`, `skipDrink`, `hostAction`, `playAgain`, `leave`.

Clients implement reconnection and `rejoin` using a token stored in `localStorage`.

---

## Mobile and PWA

Designed for portrait mobile browsers and installed PWAs:

- `viewport-fit=cover`, safe-area CSS variables
- Minimum 44px touch targets, 16px+ inputs (avoids iOS focus zoom)
- Service worker caches static shell; does not cache `/api` or `/ws`
- Wake lock, haptics, and keyboard viewport handling via `frontend/js/mobile.js`

Apple HIG alignment is documented in stylesheet headers and deployment notes above.

---

## Project structure

```text
game/
  server.js               HTTP server + WebSocket entry
  render.yaml             Render Blueprint (optional)
  api/index.js            Vercel serverless adapter (HTTP only)
  lib/                    Express, rooms, NVIDIA proxy (imports ../frontend/js)
  spin-bottle/            Vite source → ../frontend/spin-bottle/
frontend/                 PWA client — see ../frontend/README.md
docs/                     Product requirements and architecture
```

---

## Security

- API keys and `.env` must remain server-side only.
- `.env` is listed in `.gitignore`; use `.env.example` for documentation.
- Rotate keys immediately if exposed in logs, commits, or screenshots.
- All NVIDIA requests are proxied; clients never receive the raw key.
- Drink vision payloads are resized client-side before upload.

---

## Repository

**https://github.com/itskunal23/go-f-yourself**

Issues and contributions: use GitHub Issues and pull requests against `main`.

---

## License

MIT — see repository license file. Use at your own risk; authors are not liable for misuse or harm resulting from alcohol consumption.
