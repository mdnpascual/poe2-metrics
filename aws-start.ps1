# aws-start.ps1
# Starts the EC2 instance, gets new IP, and updates CloudFront origin

# TODO: update these when redeploying (values from provision-ec2.ps1 output)
$InstanceId = "i-xxxxxxxxxxxxxxxxx"
$Region = "us-east-1"
$DistributionId = "EXXXXXXXXXXXXX"

Write-Host "Starting instance $InstanceId..." -ForegroundColor Cyan
aws ec2 start-instances --instance-ids $InstanceId --region $Region | Out-Null

Write-Host "Waiting for instance to be running..." -ForegroundColor Yellow
aws ec2 wait instance-running --instance-ids $InstanceId --region $Region

$IP = aws ec2 describe-instances --instance-ids $InstanceId --region $Region --query "Reservations[0].Instances[0].PublicIpAddress" --output text
$DNS = aws ec2 describe-instances --instance-ids $InstanceId --region $Region --query "Reservations[0].Instances[0].PublicDnsName" --output text

Write-Host "`nInstance is running!" -ForegroundColor Green
Write-Host "  Public IP:  $IP" -ForegroundColor White
Write-Host "  Public DNS: $DNS" -ForegroundColor White

# Update CloudFront origin with new DNS
Write-Host "`nUpdating CloudFront origin..." -ForegroundColor Cyan

# Get current distribution config
$configJson = aws cloudfront get-distribution-config --id $DistributionId --region $Region
$config = $configJson | ConvertFrom-Json
$etag = $config.ETag

# Find and update the EC2 origin (the one on port 4000)
$distConfig = $config.DistributionConfig
$origins = $distConfig.Origins.Items
$updated = $false
foreach ($origin in $origins) {
    if ($origin.CustomOriginConfig -and $origin.CustomOriginConfig.HTTPPort -eq 4000) {
        $oldDomain = $origin.DomainName
        $origin.DomainName = $DNS
        $origin.Id = $DNS
        $updated = $true
        Write-Host "  Origin updated: $oldDomain -> $DNS" -ForegroundColor Green
        break
    }
}

if (-not $updated) {
    Write-Host "  Could not find EC2 origin to update!" -ForegroundColor Red
    Write-Host "  Manually update CloudFront origin to: $DNS" -ForegroundColor Yellow
    exit 1
}

# Also update the cache behavior that references the old origin ID
foreach ($behavior in $distConfig.CacheBehaviors.Items) {
    if ($behavior.PathPattern -eq "/graphql") {
        $behavior.TargetOriginId = $DNS
    }
}

# Write updated config to temp file
$distConfig | ConvertTo-Json -Depth 20 | Out-File -Encoding utf8 "$env:TEMP\cf-config.json"

# Update the distribution
aws cloudfront update-distribution --id $DistributionId --distribution-config "file://$env:TEMP\cf-config.json" --if-match $etag --region $Region | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  CloudFront distribution updated!" -ForegroundColor Green
    Write-Host "  Deploying... (takes ~60 seconds)" -ForegroundColor Yellow
} else {
    Write-Host "  CloudFront update failed. Manually update origin to: $DNS" -ForegroundColor Red
}

Remove-Item "$env:TEMP\cf-config.json" -ErrorAction SilentlyContinue

Write-Host "`nAll done!" -ForegroundColor Cyan
Write-Host "  Backend:  http://${IP}:4000/" -ForegroundColor White
Write-Host "  Site:     https://xxxxxxxxxxxxxx.cloudfront.net" -ForegroundColor White
Write-Host "  SSH:      ssh -i .kiro\poe2-explorer-key.pem ec2-user@$IP" -ForegroundColor DarkGray
