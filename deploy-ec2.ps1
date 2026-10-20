# deploy-ec2.ps1
# Deploys backend code and/or DuckDB to EC2 instance
# Usage:
#   .\deploy-ec2.ps1 backend   - Deploy backend code only
#   .\deploy-ec2.ps1 db        - Deploy DuckDB only
#   .\deploy-ec2.ps1 all       - Deploy everything

param(
    [Parameter(Position=0)]
    [ValidateSet("backend", "db", "all")]
    [string]$Target = "all"
)

# TODO: update InstanceId when redeploying (value from provision-ec2.ps1 output)
$InstanceId = "i-xxxxxxxxxxxxxxxxx"
$Region = "us-east-1"
$KeyPath = "$PSScriptRoot\.kiro\poe2-explorer-key.pem"
$RemoteDir = "/opt/poe2-explorer"
$RemoteUser = "ec2-user"

# Get instance public IP
Write-Host "Getting instance IP..." -ForegroundColor Cyan
$IP = aws ec2 describe-instances --instance-ids $InstanceId --region $Region --query "Reservations[0].Instances[0].PublicIpAddress" --output text

if (-not $IP -or $IP -eq "None") {
    Write-Host "Instance is not running. Start it first with: npm run aws:start" -ForegroundColor Red
    exit 1
}

Write-Host "Instance IP: $IP" -ForegroundColor Green
$SshTarget = "$RemoteUser@$IP"
$SshOpts = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no")

function Deploy-Backend {
    Write-Host "`nBuilding backend..." -ForegroundColor Cyan
    npx tsc -p tsconfig.server.json
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Uploading backend code..." -ForegroundColor Cyan
    # Upload compiled JS
    scp @SshOpts -r dist/server/* "${SshTarget}:${RemoteDir}/server/"
    # Upload package.json and package-lock.json for npm install
    scp @SshOpts package.json package-lock.json "${SshTarget}:${RemoteDir}/"

    Write-Host "Installing dependencies on EC2..." -ForegroundColor Cyan
    ssh @SshOpts $SshTarget "cd $RemoteDir && npm ci --production"

    Write-Host "Restarting service..." -ForegroundColor Cyan
    ssh @SshOpts $SshTarget "sudo systemctl restart poe2-explorer"

    Write-Host "Backend deployed!" -ForegroundColor Green
}

function Deploy-Db {
    $DbPath = "$PSScriptRoot\explorer_v2.duckdb"
    if (-not (Test-Path $DbPath)) {
        Write-Host "explorer_v2.duckdb not found!" -ForegroundColor Red
        exit 1
    }

    $sizeMB = [math]::Round((Get-Item $DbPath).Length / 1MB, 1)
    Write-Host "`nStopping service before DB upload..." -ForegroundColor Cyan
    ssh @SshOpts $SshTarget "sudo systemctl stop poe2-explorer"

    Write-Host "Uploading DuckDB ($sizeMB MB)... This may take a few minutes." -ForegroundColor Cyan
    scp @SshOpts $DbPath "${SshTarget}:${RemoteDir}/explorer_v2.duckdb"

    # Remove any stale write-ahead log — a leftover .wal that doesn't match the
    # freshly uploaded DB makes DuckDB refuse the connection on startup.
    Write-Host "Removing stale WAL (if any)..." -ForegroundColor Cyan
    ssh @SshOpts $SshTarget "rm -f ${RemoteDir}/explorer_v2.duckdb.wal"

    Write-Host "Restarting service..." -ForegroundColor Cyan
    ssh @SshOpts $SshTarget "sudo systemctl start poe2-explorer"

    Write-Host "DuckDB deployed!" -ForegroundColor Green
}

switch ($Target) {
    "backend" { Deploy-Backend }
    "db" { Deploy-Db }
    "all" { Deploy-Backend; Deploy-Db }
}

Write-Host "`nDone! Service status:" -ForegroundColor Cyan
ssh @SshOpts $SshTarget "sudo systemctl status poe2-explorer --no-pager -l"
