function Download-TestAgentBootStrapper ($Uri) {
    Invoke-WebRequest -Uri $uri -OutFile "$PSScriptRoot\vs_TestAgent.exe"
}

function Create-OfflineCache ($language) {
    $p = Start-Process -FilePath "$PSScriptRoot\vs_TestAgent.exe" -ArgumentList "--layout $PSScriptRoot\TestAgent2017\ --lang $language" -PassThru -Wait
    $p.WaitForExit()
}

if($PSVersionTable.PSVersion.Major -gt 5){
    Write-Error "Please install Powershell 5 or more https://docs.microsoft.com/en-us/powershell/wmf/5.0/requirements"
}

# 1. Cleaning up the previous cache if exist
Write-Host "Cleaning up any previous installation cache"
Remove-Item "$PSScriptRoot\vs_TestAgent.exe" -Force -ErrorAction SilentlyContinue
Remove-Item "$PSScriptRoot\TestAgent2017" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$PSScriptRoot\TestAgent.zip" -Force -ErrorAction SilentlyContinue
Write-Host "Completed cleaning up installation cache"

# 2. First dowlnload the boot strapper
Write-Host "Downloading the Test agent bootstrapper"
Download-TestAgentBootStrapper -Uri "https://aka.ms/vs/15/release/vs_TestAgent.exe"
Write-Host "Completed downloading the Test agent bootstrapper"

# 3. Download the Offline Cache
Write-Host "Preparing the Test agent offline cache"
Create-OfflineCache -language "en-US"
Write-Host "Completed prepraring the offline cache"

# 4. Compress the archive
Write-Host "Archiving the Test agent offline cache"
Compress-Archive -Path "$PSScriptRoot\TestAgent2017\*" -CompressionLevel Fastest -DestinationPath "$PSScriptRoot\TestAgent.zip"
Write-Host "Completed archiving the Test agent offline.
            Please use this archive $PSScriptRoot\TestAgent.zip for offline Test agent installation.
            For more info: https://blogs.msdn.microsoft.com/devops/2017/05/05/using-visual-studio-agent-deployment-task-on-machines-not-connected-to-the-internet/"