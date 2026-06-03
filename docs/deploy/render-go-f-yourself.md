# Render: go-f-yourself (manual deploy)

| Field | Value |
|-------|--------|
| Service | go-f-yourself |
| Service ID | `srv-d8edr1cm0tmc73eov2g0` |
| URL | https://go-f-yourself.onrender.com |
| Repo | https://github.com/itskunal23/go-f-yourself (`main`) |
| Plan | Free (Blueprint-managed) |

## Dashboard: Manual Deploy

1. Open [Service dashboard](https://dashboard.render.com/web/srv-d8edr1cm0tmc73eov2g0) (sign in with GitHub).
2. Confirm **Settings → Build & Deploy**:

   | Setting | Value |
   |---------|--------|
   | Root Directory | *(empty — repository root)* |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |

3. **Environment** → set `NVIDIA_API_KEY` (`nvapi-…`) for AI host + drink vision.
4. Top right: **Manual Deploy** → **Deploy latest commit** (or **Clear build cache & deploy** if a build failed earlier).

## CLI deploy (from your machine)

```powershell
$env:RENDER_API_KEY = "rnd_..."   # from Render → Account Settings → API Keys
.\scripts\render-deploy.ps1
# or clear cache after config changes:
.\scripts\render-deploy.ps1 -ClearCache
```

## Deploy hook (no API key)

1. Service → **Settings** → **Deploy Hook** → copy URL.
2. Trigger: `curl "<deploy-hook-url>"`

## Verify after deploy

```bash
curl https://go-f-yourself.onrender.com/api/health
```

Expect: `"ok":true` and `"aiEnabled":true` when `NVIDIA_API_KEY` is set.

## Blueprint

Root `render.yaml` matches the table above. After changing it, use **Blueprint → Sync** or redeploy from the service page.
