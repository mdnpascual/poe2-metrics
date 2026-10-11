# run-localtonet.ps1
# Starts backend, frontend, and localtonet tunnel

$explorerDir = $PSScriptRoot
$localtonetExe = 'C:\Users\MDuh\Desktop\Projects\localtonet\localtonet.exe'
$authToken = $env:LOCALTONET_TOKEN
if (-not $authToken) {
    Write-Host "ERROR: Set the LOCALTONET_TOKEN environment variable before running." -ForegroundColor Red
    Write-Host '  $env:LOCALTONET_TOKEN = "<your-token>"' -ForegroundColor DarkGray
    exit 1
}

Write-Host "Starting PoE2 Build Explorer + LocalToNet..." -ForegroundColor Cyan

# Start backend
Write-Host "$(Get-Date -Format 'HH:mm:ss') Starting backend (port 4000)..." -ForegroundColor Green
$backendProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c cd /d `"$explorerDir`" && npx tsx server/index.ts" `
    -PassThru

Start-Sleep -Seconds 6

# Start frontend
Write-Host "$(Get-Date -Format 'HH:mm:ss') Starting frontend (port 5173)..." -ForegroundColor Green
$frontendProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c cd /d `"$explorerDir`" && npx vite" `
    -PassThru

Start-Sleep -Seconds 5

# Start localtonet
Write-Host "$(Get-Date -Format 'HH:mm:ss') Starting LocalToNet tunnel..." -ForegroundColor Green
$tunnelProc = Start-Process -FilePath $localtonetExe `
    -ArgumentList "--authtoken $authToken" `
    -PassThru

Write-Host ""
Write-Host "All services running!" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:4000" -ForegroundColor DarkGray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor DarkGray
Write-Host "  Tunnel:   https://mduh-dev.localto.net" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Enter to stop all services." -ForegroundColor Yellow

Read-Host

Write-Host "Stopping..." -ForegroundColor Yellow
foreach ($proc in @($tunnelProc, $frontendProc, $backendProc)) {
    if ($proc -and -not $proc.HasExited) {
        taskkill /PID $proc.Id /T /F 2>$null
    }
}
Write-Host "Done." -ForegroundColor Green
