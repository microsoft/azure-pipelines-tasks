Param(
    [Parameter(Mandatory = $False)]
    [string]$language = "en-US",
    [Parameter(Mandatory = $False)]
    [string]$sharedFolder
)

function Download-TestAgentBootStrapper ($Uri) {
    Invoke-WebRequest -Uri $uri -OutFile "$PSScriptRoot\vs_TestAgent.exe"
}

function Download-TestExecutionEngine ($Uri) {
    Invoke-WebRequest -Uri $uri -OutFile "$PSScriptRoot\TestExecution.zip"
}

function Create-OfflineCache ($language) {
    $p = Start-Process -FilePath "$PSScriptRoot\vs_TestAgent.exe" -ArgumentList "--layout $PSScriptRoot\TestAgent2017\ --lang $language" -PassThru -Wait
    $p.WaitForExit()
}

function Create-Archive ($sourcePath, $destPath) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
    [System.IO.Compression.ZipFile]::CreateFromDirectory($sourcePath, $destPath, $compressionLevel, $False)
}

function Start-OfflineProcess([string]$language, [string]$sharedFolder) {
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
    Write-Host "Preparing the Test agent $language offline cache"
    Create-OfflineCache -language $language
    Write-Host "Completed prepraring the offline cache"

    # 4. Compress the archive
    Write-Host "Archiving the Test agent offline cache"
    Create-Archive -sourcePath "$PSScriptRoot\TestAgent2017\" -destPath "$PSScriptRoot\TestAgent.zip"
    Write-Host "Completed archiving the Test agent offline."

    # 5. Download the Test Execution engine
    if (Test-Path "$PSScriptRoot\TestExecution.zip") {
        Write-Host "Skipping downloading of Test execution as it's already available."
    }
    else {
        Write-Host "Downloading the Test execution engine"
        Download-TestExecutionEngine -Uri "https://testexecution.blob.core.windows.net/testexecution/4334139/TestExecution.zip"
        Write-Host "Completed downloading the Test execution engine"
    }

    $dest = "$PSScriptRoot"

    if ($sharedFolder) {
        Write-Host "Copying $PSScriptRoot\TestAgent.zip to $sharedFolder"
        Copy-Item -Path "$PSScriptRoot\TestAgent.zip" -Destination $sharedFolder -Force
        Write-Host "Copying $PSScriptRoot\TestExecution.zip to $sharedFolder"
        Copy-Item -Path "$PSScriptRoot\TestExecution.zip" -Destination $sharedFolder -Force
        $dest = $sharedFolder
    }
    Write-Host "------------------------------------------------------------------------------------------------------------------------------------------
    Please use these archive(s) $dest\TestAgent.zip and $dest\TestExecution.zip for offline Test agent installation.
    For more info: https://blogs.msdn.microsoft.com/devops/2017/05/05/using-visual-studio-agent-deployment-task-on-machines-not-connected-to-the-internet/
                ------------------------------------------------------------------------------------------------------------------------------------------"
}

Start-OfflineProcess -language $language -sharedFolder $sharedFolder

