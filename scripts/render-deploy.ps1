# Trigger a Render manual deploy for go-f-yourself.
# Requires: $env:RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys
# Optional: $env:RENDER_SERVICE_ID (defaults to your web service)

param(
  [string]$ServiceId = $env:RENDER_SERVICE_ID,
  [switch]$ClearCache
)

if (-not $ServiceId) { $ServiceId = 'srv-d8edr1cm0tmc73eov2g0' }
if (-not $env:RENDER_API_KEY) {
  Write-Error 'Set RENDER_API_KEY (Render Dashboard → Account Settings → API Keys).'
  exit 1
}

$body = @{ }
if ($ClearCache) { $body.clearCache = 'clear' }

$json = if ($body.Count) { $body | ConvertTo-Json } else { '{}' }

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.render.com/v1/services/$ServiceId/deploys" `
  -Headers @{
    Authorization = "Bearer $($env:RENDER_API_KEY)"
    'Content-Type'  = 'application/json'
    Accept          = 'application/json'
  } `
  -Body $json

Write-Host "Deploy triggered for $ServiceId"
$response | ConvertTo-Json -Depth 5
