# run.ps1
# Starts backend and frontend for the PoE2 Build Explorer

$explorerDir = $PSScriptRoot

Write-Host "Starting PoE2 Build Explorer..." -ForegroundColor Cyan

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

Write-Host ""
Write-Host "Running!" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:4000" -ForegroundColor DarkGray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Enter to stop all services." -ForegroundColor Yellow

Read-Host

Write-Host "Stopping..." -ForegroundColor Yellow
foreach ($proc in @($frontendProc, $backendProc)) {
    if ($proc -and -not $proc.HasExited) {
        taskkill /PID $proc.Id /T /F 2>$null
    }
}
Write-Host "Done." -ForegroundColor Green
