# This is a script that will add the new authenticate tasks to Azure DevOps Server.
# This is what this script does:
# - install tfx-cli
# - git clone azure-pipelines-tasks to a temporary location
# - npm install and run build on preferred tasks
# - upload task(s) to your Azure DevOps Server instance
# - remove the azure-pipelines-tasks repo
# - uninstall tfx-cli

# IMPORTANT! Read this if you're running this script behind a proxy.
# This script is running 'npm install' and 'git clone'. 
# To make this script work behind a proxy you may need to run the following two commands before running this script to set up proxy configurations:
# git config --global http.proxy http://<username>:<password>@<proxy-server-url>:<port>
# npm config set http://<username>:<password>@<proxy-server-url>:<port>
# We do not want to set these up for you because we want to make sure 

param(
    # The URL of Azure DevOps Server, e.g. https://fabrikam.visualstudio.com/DefaultCollection
    [Parameter(Mandatory=$true)]
    [string]$ServiceURL,
    # Personal Access Token - manually created using Azure DevOps Server
    [Parameter(Mandatory=$true)]
    [string]$PAT,
    # The task to add to Azure DevOps Server
    # If task is not provided, the script will automatically install NuGetAuthenticateV0, MavenAuthenticateV0, PipAuthenticateV1 and TwineAuthenticateV1
    [Parameter(Mandatory=$false)]
    [string]$Task
)

$script:ErrorActionPreference='Stop'

$uninstallTfxCli = 0
$originalDirectory = Get-Location
$tempPath = [System.IO.Path]::Combine($originalDirectory, "Pipelines"); 
$pipelineRepoURL = "https://github.com/microsoft/azure-pipelines-tasks.git"

# Make it work when TLS 1.0/1.1 is disabled
if ([Net.ServicePointManager]::SecurityProtocol.ToString().Split(',').Trim() -notcontains 'Tls12') {
    [Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12
}

# Verify all required software is installed
Write-Host "Checking for required software"
try {
    Write-Host "node --version"
    node --version
} catch {
    Write-Error "Failed to run 'node --version'. Make sure you have node and npm installed."
    exit
}

try {
    Write-Host "git --version"
    git --version
} catch {
    Write-Error "Failed to run 'git --version'. Make sure you have git installed."
    exit
}

try {
    Write-Host "tfx --version"
    tfx --version
} catch {
    $uninstallTfxCli = 1;
    try {
        Write-Host "npm installing tfx-cli"
        npm install -g tfx-cli --registry=https://registry.npmjs.org/
    } catch {
        Write-Error "Failed to run 'npm install -g tfx-cli --registry=https://registry.npmjs.org/'. You may have to manually install tfx-cli to run this script."
    }
}

# git clone pipeline tasks
try {
    Write-Verbose "Cloning the task repo to a temp location"
    git clone $pipelineRepoURL $tempPath
} catch {
    Write-Error "Failed to run 'git clone $pipelineRepoURL $tempPath'"
}

# go to temp path and install
Write-Host "Go to $tempPath and npm install"
Set-Location -Path $tempPath
npm install

# Create an array of tasks
if (!$Task) {
    $taskArray = @("NuGetAuthenticateV0", "MavenAuthenticateV0", "PipAuthenticateV1", "TwineAuthenticateV1")
} else {
    $taskArray = @($task)
}

# build and upload auth task(s)
forEach($taskItem in $taskArray) {
    try {
        Write-Host "Building $taskItem"
        node make.js build --task $taskItem
    } catch {
        Write-Error "Failed to build $taskItem"
        exit
    }
    try {
        Write-Host "Attempting to upload $taskItem to Azure DevOps Server"
        tfx build tasks upload --task-path _build\Tasks\$taskItem --service-url $ServiceURL --token $PAT
    } catch {
        Write-Error "Failed to run 'tfx build tasks upload'"
    }
}

Write-Host "Going back to $originalDirectory"
Set-Location -Path $originalDirectory

# clean up - remove pipeline tasks repo
Write-Host "Removing $tempPath"
Remove-Item $tempPath -Force -Recurse
if ($uninstallTfxCli -eq 1) {
    Write-Host "Uninstalling tfx-cli"
    npm uninstall -g tfx-cli
}

Write-Host "Done!"