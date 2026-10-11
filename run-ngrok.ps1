# run-explorer-ngrok.ps1
# Starts backend, frontend, and ngrok tunnel for the PoE2 Build Explorer

$explorerDir = $PSScriptRoot

Write-Host "Starting PoE2 Build Explorer..." -ForegroundColor Cyan

# Start backend in a new window
Write-Host "$(Get-Date -Format 'HH:mm:ss') Starting backend (port 4000)..." -ForegroundColor Green
$backendProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c cd /d `"$explorerDir`" && npx tsx server/index.ts" `
    -PassThru

Start-Sleep -Seconds 6

# Start frontend in a new window
Write-Host "$(Get-Date -Format 'HH:mm:ss') Starting frontend (port 5173)..." -ForegroundColor Green
$frontendProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c cd /d `"$explorerDir`" && npx vite" `
    -PassThru

Start-Sleep -Seconds 8

# Start ngrok
Write-Host "$(Get-Date -Format 'HH:mm:ss') Starting ngrok tunnel..." -ForegroundColor Green
$ngrokProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c ngrok http 127.0.0.1:5173" `
    -PassThru

Write-Host ""
Write-Host "All services running!" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:4000" -ForegroundColor DarkGray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor DarkGray
Write-Host "  ngrok:    Check http://127.0.0.1:4040 for public URL" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Enter to stop all services." -ForegroundColor Yellow

Read-Host

Write-Host "Stopping all services..." -ForegroundColor Yellow

# Kill process trees (cmd.exe + child node/ngrok processes)
foreach ($proc in @($ngrokProc, $frontendProc, $backendProc)) {
    if ($proc -and -not $proc.HasExited) {
        taskkill /PID $proc.Id /T /F 2>$null
    }
}

Write-Host "Done." -ForegroundColor Green
