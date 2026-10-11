# aws-stop.ps1
# Stops the EC2 instance to save costs

# TODO: update InstanceId when redeploying (value from provision-ec2.ps1 output)
$InstanceId = "i-xxxxxxxxxxxxxxxxx"
$Region = "us-east-1"

Write-Host "Stopping instance $InstanceId..." -ForegroundColor Cyan
aws ec2 stop-instances --instance-ids $InstanceId --region $Region | Out-Null

Write-Host "Waiting for instance to stop..." -ForegroundColor Yellow
aws ec2 wait instance-stopped --instance-ids $InstanceId --region $Region

Write-Host "`nInstance stopped. No compute charges while stopped." -ForegroundColor Green
Write-Host "  EBS storage cost: ~`$0.80/month" -ForegroundColor DarkGray
Write-Host "  Run .\aws-start.ps1 to start again." -ForegroundColor DarkGray
