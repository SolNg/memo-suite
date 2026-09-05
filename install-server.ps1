# =============================================================================
#  install-server.ps1  -  Cai plugin may chu cho Windows
#  0-32 . San Khau Khong Bao Gio Ha Man (ban tieng Viet)
#  Kho ma: https://github.com/SolNg/memo-suite
# -----------------------------------------------------------------------------
#  CACH DUNG:
#    1. DONG SillyTavern truoc (dong cua so Start.bat).
#    2. Mo PowerShell, chay:
#         cd E:\SillyTavern\public\scripts\extensions\third-party\memo-suite
#         powershell -ExecutionPolicy Bypass -File .\install-server.ps1 E:\SillyTavern
#    3. Mo lai Start.bat.
# =============================================================================

param([string]$SillyTavernPath = "")

$ErrorActionPreference = "Stop"
function Fail($m) { Write-Host "[X] $m" -ForegroundColor Red; exit 1 }
function Ok($m)   { Write-Host "[v] $m" -ForegroundColor Green }
function Info($m) { Write-Host "[i] $m" -ForegroundColor Cyan }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Tim thu muc SillyTavern -------------------------------------------------
if (-not $SillyTavernPath) {
    # Tien ich nam o <ST>\public\scripts\extensions\third-party\<ten>, lui 5 cap.
    $guess = (Get-Item $here).Parent.Parent.Parent.Parent.Parent
    if ($guess -and (Test-Path (Join-Path $guess "server.js"))) { $SillyTavernPath = $guess.FullName }
}
if (-not $SillyTavernPath) { Fail "Hay chi ro thu muc SillyTavern, vi du: .\install-server.ps1 E:\SillyTavern" }
$ST = (Resolve-Path $SillyTavernPath).Path

if (-not (Test-Path (Join-Path $ST "server.js")))   { Fail "Khong thay server.js trong $ST - sai thu muc roi" }
if (-not (Test-Path (Join-Path $ST "config.yaml"))) { Fail "Khong thay config.yaml trong $ST - sai thu muc roi" }
Ok "Thu muc SillyTavern: $ST"

$src = Join-Path $here "server-plugin\vvv-theater-memory-server"
if (-not (Test-Path (Join-Path $src "index.mjs"))) { Fail "Kho ma thieu server-plugin\vvv-theater-memory-server\index.mjs" }

# --- Kiem tra SillyTavern con dang chay --------------------------------------
$busy = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path -and $_.Path.StartsWith($ST, [StringComparison]::OrdinalIgnoreCase) } catch { $false }
}
if ($busy) {
    Write-Host ""
    Write-Host "  !! SillyTavern DANG CHAY. Hay dong cua so Start.bat roi chay lai script nay." -ForegroundColor Yellow
    Write-Host "     (Neu khong dong, Windows se bao loi EBUSY vi tep dang bi khoa.)" -ForegroundColor Yellow
    Write-Host ""
    Fail "Dung lai de tranh hong tep."
}

# --- Sao luu plugin cu -------------------------------------------------------
$dst = Join-Path $ST "plugins\vvv-theater-memory-server"
if (Test-Path $dst) {
    $stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = Join-Path (Split-Path -Parent $ST) "VVV_SERVER_BACKUP_$stamp"
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    Copy-Item -Recurse -Force $dst $backup
    Ok "Da sao luu plugin cu: $backup"
    Remove-Item -Recurse -Force $dst
}

# --- Chep plugin -------------------------------------------------------------
New-Item -ItemType Directory -Force -Path (Join-Path $ST "plugins") | Out-Null
Copy-Item -Recurse -Force $src (Join-Path $ST "plugins")
if (-not (Test-Path (Join-Path $dst "index.mjs"))) { Fail "Chep plugin that bai" }
Ok "Da cai plugin: $dst"

# --- Bat enableServerPlugins trong config.yaml -------------------------------
$cfg = Join-Path $ST "config.yaml"
Copy-Item $cfg "$cfg.backup" -Force
Ok "Da sao luu config.yaml -> config.yaml.backup"

$text = Get-Content $cfg -Raw
if ($text -match '(?m)^\s*enableServerPlugins\s*:') {
    $text = [System.Text.RegularExpressions.Regex]::Replace(
        $text, '(?m)^\s*enableServerPlugins\s*:.*$', 'enableServerPlugins: true')
    Info "Da doi enableServerPlugins thanh true"
} else {
    $text = $text.TrimEnd() + "`r`n" + "enableServerPlugins: true" + "`r`n"
    Info "Da them dong enableServerPlugins: true"
}
[System.IO.File]::WriteAllText($cfg, $text, (New-Object System.Text.UTF8Encoding $false))

$check = Select-String -Path $cfg -Pattern '^\s*enableServerPlugins' | ForEach-Object { $_.Line.Trim() }
Ok "config.yaml: $check"

# --- Xong --------------------------------------------------------------------
Write-Host ""
Write-Host "  XONG. Con 2 viec nua:" -ForegroundColor Green
Write-Host "    1. Mo lai SillyTavern (chay Start.bat)."
Write-Host "    2. Mo dia chi nay trong trinh duyet dang dang nhap SillyTavern:"
Write-Host "       http://127.0.0.1:8000/api/plugins/vvv-theater-memory-server/health" -ForegroundColor Cyan
Write-Host "       Hien chu JSON = dung roi. Hien trang 404 = chua duoc, xem lai."
Write-Host ""
Write-Host "  Du lieu ky uc vinh vien khong bi xoa; van nam o dataRoot\vvv\vvv-theater-memory"
Write-Host ""
