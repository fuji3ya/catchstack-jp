# Catchstack JP Legal Site - Cloudflare Pages deploy
#
# Prereq:
#   - wrangler login done
#
# Usage (run from this app's directory):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-legal.ps1

param(
    [string]$LegalDir = "$PSScriptRoot/../legal"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $LegalDir)) {
    Write-Host "Legal directory not found: $LegalDir" -ForegroundColor Red
    exit 1
}

Push-Location $LegalDir
try {
    Write-Host "==> Deploying Catchstack JP legal site to Cloudflare Pages" -ForegroundColor Cyan

    # Pre-flight: sweep placeholder strings
    $stale = Select-String -Path *.html -Pattern "TODO|FIXME|lorem|example\.com|placeholder" -CaseSensitive:$false -SimpleMatch:$false
    if ($stale) {
        Write-Host "Placeholder strings still present:" -ForegroundColor Red
        $stale | ForEach-Object { Write-Host "  $($_.Path):$($_.LineNumber):$($_.Line)" }
        Write-Host "Aborting deploy" -ForegroundColor Red
        exit 1
    }

    & npx wrangler pages deploy . `
        --project-name=catchstack-jp-legal `
        --branch=main `
        --commit-dirty=true
    if ($LASTEXITCODE -ne 0) {
        Write-Host "deploy failed" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "==> Deploy succeeded" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps (Cloudflare dashboard, manual one-time setup):"
    Write-Host "  1. Pages -> catchstack-legal -> Custom domains"
    Write-Host "  2. Add Custom Domain: starving-effort.com (already attached to other apps' projects via _redirects)"
    Write-Host "     OR add: catchstack-legal.pages.dev as the canonical URL"
    Write-Host "  3. _redirects maps /catchstack/* path to the right page if shared domain is used"
    Write-Host ""
    Write-Host "Verify (return 200):"
    Write-Host "  curl -I https://catchstack-legal.pages.dev/privacy"
    Write-Host "  curl -I https://catchstack-legal.pages.dev/terms"
    Write-Host "  curl -I https://catchstack-legal.pages.dev/support"
    Write-Host "  curl -I https://catchstack-legal.pages.dev/"
    Write-Host ""
    Write-Host "ASC submission requires HTTPS Privacy Policy URL — use whichever URL you confirmed above."
}
finally {
    Pop-Location
}
