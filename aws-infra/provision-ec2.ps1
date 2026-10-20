# provision-ec2.ps1
# Provisions a new EC2 instance for poe2-explorer from scratch.
# Run this when you're ready to bring the backend back online.
#
# Prerequisites:
#   - AWS CLI configured with your credentials
#   - Key pair "poe2-explorer-key" still exists in us-east-1 (it does - keys survive instance termination)
#   - Security group (poe2-explorer-sg) still exists (it does)
#
# TODO: update SecurityGroupId and SubnetId below when redeploying
# After running this script, run: .\deploy-ec2.ps1 all

param(
    [string]$InstanceType = "t3.micro",
    [string]$Region = "us-east-1"
)

$KeyName = "poe2-explorer-key"
$SecurityGroupId = "sg-xxxxxxxxxxxxxxxxx"
$SubnetId = "subnet-xxxxxxxxxxxxxxxxx"

# Use latest Amazon Linux 2023 AMI
Write-Host "Finding latest Amazon Linux 2023 AMI..." -ForegroundColor Cyan
$AmiId = aws ec2 describe-images `
    --region $Region `
    --owners amazon `
    --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" `
    --query "sort_by(Images, &CreationDate)[-1].ImageId" `
    --output text

if (-not $AmiId) {
    Write-Host "Could not find Amazon Linux 2023 AMI!" -ForegroundColor Red
    exit 1
}
Write-Host "  AMI: $AmiId" -ForegroundColor Green

# Launch instance
Write-Host "`nLaunching $InstanceType instance..." -ForegroundColor Cyan
$RunResult = aws ec2 run-instances `
    --region $Region `
    --image-id $AmiId `
    --instance-type $InstanceType `
    --key-name $KeyName `
    --security-group-ids $SecurityGroupId `
    --subnet-id $SubnetId `
    --associate-public-ip-address `
    --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=8,VolumeType=gp3,DeleteOnTermination=true}" `
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=poe2-explorer-backend}]" `
    --metadata-options "HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled" `
    --output json | ConvertFrom-Json

$InstanceId = $RunResult.Instances[0].InstanceId
Write-Host "  Instance ID: $InstanceId" -ForegroundColor Green

# Wait for running
Write-Host "Waiting for instance to be running..." -ForegroundColor Yellow
aws ec2 wait instance-running --instance-ids $InstanceId --region $Region

# Get public IP
$IP = aws ec2 describe-instances --instance-ids $InstanceId --region $Region `
    --query "Reservations[0].Instances[0].PublicIpAddress" --output text

Write-Host "`nInstance is running!" -ForegroundColor Green
Write-Host "  Public IP: $IP" -ForegroundColor White

# Wait a bit for SSH to become available
Write-Host "`nWaiting 30s for SSH to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Setup the instance
$KeyPath = "$PSScriptRoot\..\.kiro\poe2-explorer-key.pem"
$SshOpts = "-i", $KeyPath, "-o", "StrictHostKeyChecking=no"
$SshTarget = "ec2-user@$IP"

Write-Host "`nInstalling Node.js 20..." -ForegroundColor Cyan
ssh @SshOpts $SshTarget "curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo dnf install -y nodejs"

Write-Host "Creating application directory..." -ForegroundColor Cyan
ssh @SshOpts $SshTarget "sudo mkdir -p /opt/poe2-explorer && sudo chown ec2-user:ec2-user /opt/poe2-explorer"

Write-Host "Installing systemd service..." -ForegroundColor Cyan
$ServiceContent = Get-Content "$PSScriptRoot\poe2-explorer.service" -Raw
# Upload service file
$ServiceContent | ssh @SshOpts $SshTarget "sudo tee /etc/systemd/system/poe2-explorer.service > /dev/null"
ssh @SshOpts $SshTarget "sudo systemctl daemon-reload && sudo systemctl enable poe2-explorer"

Write-Host "`n=== Instance provisioned! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Update InstanceId in deploy-ec2.ps1, aws-start.ps1, aws-stop.ps1 to: $InstanceId"
Write-Host "  2. Run: .\deploy-ec2.ps1 all"
Write-Host "  3. Run: .\aws-start.ps1  (to update CloudFront origin with new DNS)"
Write-Host ""
Write-Host "Instance details:" -ForegroundColor White
Write-Host "  ID:  $InstanceId"
Write-Host "  IP:  $IP"
Write-Host "  SSH: ssh -i .kiro\poe2-explorer-key.pem ec2-user@$IP"
