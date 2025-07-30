# Setup test environment for courtesy-push.js

Write-Host "Setting up test environment for courtesy-push.js..." -ForegroundColor Green

# Create the test directory structure
Write-Host "Creating test directory structure..." -ForegroundColor Yellow
New-Item -Path "./test-azure-folder" -ItemType Directory -Force | Out-Null
New-Item -Path "./test-azure-folder/Tfs/Service/Deploy/components" -ItemType Directory -Force | Out-Null

# Create Directory.Packages.props
Write-Host "Creating Directory.Packages.props..." -ForegroundColor Yellow
@"
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1" Version="1.0.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV2" Version="2.0.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.PowerShellV1" Version="1.5.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.PowerShellV2" Version="2.5.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.DockerV2" Version="2.0.0" />
"@ | Out-File -FilePath "./test-azure-folder/Directory.Packages.props" -Encoding utf8

# Create TfsServer.hosted.xml
Write-Host "Creating TfsServer.hosted.xml..." -ForegroundColor Yellow
@"
<?xml version="1.0" encoding="utf-8"?>
<Component>
  <Directory Path="[ServicingDir]Tasks\Individual\AzureCLIV1\">
    <File Origin="nuget://Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1/content/*" />
  </Directory>
  <Directory Path="[ServicingDir]Tasks\Individual\PowerShellV1\">
    <File Origin="nuget://Mseng.MS.TF.DistributedTask.Tasks.PowerShellV1/content/*" />
  </Directory>
</Component>
"@ | Out-File -FilePath "./test-azure-folder/Tfs/Service/Deploy/components/TfsServer.hosted.xml" -Encoding utf8

# Create test-deps.xml
Write-Host "Creating test-deps.xml..." -ForegroundColor Yellow
@"
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1" Version="1.1.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1_Node16" Version="1.1.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.AzureCLIV1_Node20" Version="1.1.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.DockerV2" Version="3.0.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.DockerV2_Node16" Version="3.0.0" />
    <PackageVersion Include="Mseng.MS.TF.DistributedTask.Tasks.DockerV2_Node20" Version="3.0.0" />
"@ | Out-File -FilePath "./test-deps.xml" -Encoding utf8

# Install npm dependencies
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
npm install

# Set environment variables for testing
Write-Host "Setting environment variables..." -ForegroundColor Yellow
$env:PAT = "dummy-token-for-testing"
$env:DRYRUN = "true"

Write-Host "Test environment setup complete!" -ForegroundColor Green
Write-Host "Running courtesy-push.js..." -ForegroundColor Cyan

# Run the script
node courtesy-push.js ./test-azure-folder ./test-deps.xml

Write-Host "Test execution completed!" -ForegroundColor Green