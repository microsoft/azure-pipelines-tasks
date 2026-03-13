#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Publishes Azure Pipelines tasks to your organization using tfx-cli.

.DESCRIPTION
    This script helps you publish built tasks from the _build directory to your Azure DevOps organization.
    It will guide you through:
    - Installing tfx-cli if needed
    - Logging into your Azure DevOps organization
    - Listing available tasks and their versions
    - Publishing selected tasks

.PARAMETER Organization
    The Azure DevOps organization URL (e.g., https://dev.azure.com/myorg or https://myorg.visualstudio.com)

.PARAMETER Token
    Personal Access Token for authentication. If not provided, you'll be prompted.

.PARAMETER TaskName
    Specific task name to publish. If not provided, you'll be shown a list to choose from.

.EXAMPLE
    .\publishTasks.ps1
    Interactive mode - prompts for all inputs

.EXAMPLE
    .\publishTasks.ps1 -Organization "https://dev.azure.com/myorg" -TaskName "NuGetCommandV2"
    Publish a specific task to the specified organization
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Organization,

    [Parameter(Mandatory=$false)]
    [string]$Token,

    [Parameter(Mandatory=$false)]
    [string]$TaskName
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host $Message -ForegroundColor Red }

function Write-Header {
    param($Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

# Check if tfx-cli is installed
function Test-TfxInstalled {
    try {
        $version = tfx version 2>&1
        return $true
    }
    catch {
        return $false
    }
}

# Install tfx-cli
function Install-Tfx {
    Write-Header "Installing tfx-cli"
    Write-Info "tfx-cli is not installed. Installing globally via npm..."
    
    try {
        npm install -g tfx-cli
        Write-Success "[OK] tfx-cli installed successfully"
        return $true
    }
    catch {
        Write-Error "[ERROR] Failed to install tfx-cli: $_"
        Write-Info "Please install it manually: npm install -g tfx-cli"
        return $false
    }
}

# Get list of built tasks from _build directory
function Get-BuiltTasks {
    $buildDir = Join-Path (Join-Path $PSScriptRoot "_build") "Tasks"
    
    if (-not (Test-Path $buildDir)) {
        Write-Error "Build directory not found: $buildDir"
        Write-Info "Please run 'node make.js build' first to build tasks."
        return @()
    }

    $tasks = @()
    $taskDirs = Get-ChildItem -Path $buildDir -Directory

    foreach ($dir in $taskDirs) {
        $taskJsonPath = Join-Path $dir.FullName "task.json"
        
        if (Test-Path $taskJsonPath) {
            try {
                $taskJson = Get-Content $taskJsonPath -Raw | ConvertFrom-Json
                
                $tasks += [PSCustomObject]@{
                    Name = $taskJson.name
                    FriendlyName = $taskJson.friendlyName
                    Version = "$($taskJson.version.Major).$($taskJson.version.Minor).$($taskJson.version.Patch)"
                    Path = $dir.FullName
                    Id = $taskJson.id
                    DirectoryName = $dir.Name
                }
            }
            catch {
                Write-Warning "Failed to read task.json for $($dir.Name): $_"
            }
        }
    }

    return $tasks
}

# Create a temporary task clone for publishing as a new task definition
function New-PublishTaskClone {
    param(
        [PSCustomObject]$Task
    )

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "ado-task-publish"
    if (-not (Test-Path $tempRoot)) {
        New-Item -Path $tempRoot -ItemType Directory -Force | Out-Null
    }

    $clonePath = Join-Path $tempRoot ("{0}-{1}" -f $Task.DirectoryName, [Guid]::NewGuid().ToString())
    Copy-Item -Path $Task.Path -Destination $clonePath -Recurse -Force

    $taskJsonPath = Join-Path $clonePath "task.json"
    if (-not (Test-Path $taskJsonPath)) {
        throw "task.json not found in clone path: $clonePath"
    }

    $taskJson = Get-Content -Path $taskJsonPath -Raw | ConvertFrom-Json
    $newTaskId = [Guid]::NewGuid().ToString()
    $nameSuffix = "New{0}" -f ($newTaskId.Replace('-', '').Substring(0, 8))
    $baseName = ([string]$taskJson.name) -replace '[^A-Za-z0-9]', ''
    if ([string]::IsNullOrWhiteSpace($baseName)) {
        $baseName = "CustomTask"
    }
    $maxTaskNameLength = 60
    $maxBaseNameLength = $maxTaskNameLength - $nameSuffix.Length
    if ($maxBaseNameLength -lt 1) {
        $maxBaseNameLength = 1
    }
    if ($baseName.Length -gt $maxBaseNameLength) {
        $baseName = $baseName.Substring(0, $maxBaseNameLength)
    }
    $newTaskName = "$baseName$nameSuffix"

    $suffix = " [NEW]"
    $maxFriendlyNameLength = 40
    $baseFriendlyName = [string]$taskJson.friendlyName
    $maxBaseLength = $maxFriendlyNameLength - $suffix.Length
    if ($maxBaseLength -lt 1) {
        $maxBaseLength = 1
    }
    if ($baseFriendlyName.Length -gt $maxBaseLength) {
        $baseFriendlyName = $baseFriendlyName.Substring(0, $maxBaseLength)
    }
    $newFriendlyName = "$baseFriendlyName$suffix"

    $taskJson.id = $newTaskId
    $taskJson.name = $newTaskName
    $taskJson.friendlyName = $newFriendlyName
    $jsonContent = $taskJson | ConvertTo-Json -Depth 100
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($taskJsonPath, $jsonContent, $utf8NoBom)

    $taskLocJsonPath = Join-Path $clonePath "task.loc.json"
    if (Test-Path $taskLocJsonPath) {
        try {
            $taskLocJson = Get-Content -Path $taskLocJsonPath -Raw | ConvertFrom-Json
            $taskLocJson.id = $newTaskId
            if ($taskLocJson.PSObject.Properties.Name -contains 'name') {
                $taskLocJson.name = $newTaskName
            }
            if ($taskLocJson.PSObject.Properties.Name -contains 'friendlyName') {
                $taskLocJson.friendlyName = $newFriendlyName
            }
            $taskLocJsonContent = $taskLocJson | ConvertTo-Json -Depth 100
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($taskLocJsonPath, $taskLocJsonContent, $utf8NoBom)
        }
        catch {
            Write-Warning "Unable to update task.loc.json in clone: $_"
        }
    }

    $localizedStringFiles = Get-ChildItem -Path (Join-Path $clonePath "Strings\resources.resjson") -Recurse -Filter "resources.resjson" -ErrorAction SilentlyContinue
    foreach ($stringFile in $localizedStringFiles) {
        try {
            $resObj = Get-Content -Path $stringFile.FullName -Raw | ConvertFrom-Json
            if ($resObj.PSObject.Properties.Name -contains 'loc.friendlyName') {
                $localizedBaseFriendlyName = [string]$resObj.'loc.friendlyName'
                $localizedMaxBaseLength = $maxFriendlyNameLength - $suffix.Length
                if ($localizedMaxBaseLength -lt 1) {
                    $localizedMaxBaseLength = 1
                }
                if ($localizedBaseFriendlyName.Length -gt $localizedMaxBaseLength) {
                    $localizedBaseFriendlyName = $localizedBaseFriendlyName.Substring(0, $localizedMaxBaseLength)
                }
                $resObj.'loc.friendlyName' = "$localizedBaseFriendlyName$suffix"
                $resContent = $resObj | ConvertTo-Json -Depth 100
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::WriteAllText($stringFile.FullName, $resContent, $utf8NoBom)
            }
        }
        catch {
            Write-Warning "Unable to update localized string file $($stringFile.FullName): $_"
        }
    }

    return [PSCustomObject]@{
        ClonePath = $clonePath
        NewTaskId = $newTaskId
        NewTaskName = $newTaskName
        NewFriendlyName = $newFriendlyName
    }
}

# Login to Azure DevOps
function Connect-AzureDevOps {
    param(
        [string]$OrgUrl,
        [string]$Pat
    )

    Write-Header "Connecting to Azure DevOps"
    
    if (-not $OrgUrl) {
        Write-Info "Enter your Azure DevOps organization URL"
        Write-Info "Examples:"
        Write-Info "  - https://dev.azure.com/myorg"
        Write-Info "  - https://myorg.visualstudio.com"
        
        do {
            $OrgUrl = Read-Host "Organization URL"
            if ([string]::IsNullOrWhiteSpace($OrgUrl)) {
                Write-Warning "Organization URL cannot be empty. Please try again."
            }
        } while ([string]::IsNullOrWhiteSpace($OrgUrl))
    }

    $OrgUrl = $OrgUrl.Trim()

    # Normalize URL - ensure it ends with /DefaultCollection if needed
    if ($OrgUrl -like "*visualstudio.com*" -and $OrgUrl -notlike "*/DefaultCollection") {
        $OrgUrl = "$OrgUrl/DefaultCollection"
    }

    if (-not $Pat) {
        Write-Info "`nEnter your Personal Access Token (PAT)"
        Write-Info "The PAT needs 'Agent Pools (Read and Manage)' or 'Full Access' scope"
        Write-Info "Create one at: $($OrgUrl -replace '/DefaultCollection','')/_usersSettings/tokens"
        
        do {
            $secureToken = Read-Host "Personal Access Token" -AsSecureString
            $Pat = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken))
            if (-not [string]::IsNullOrWhiteSpace($Pat)) {
                $Pat = $Pat.Trim()
            }
            if ([string]::IsNullOrWhiteSpace($Pat)) {
                Write-Warning "Personal Access Token cannot be empty. Please try again."
            }
        } while ([string]::IsNullOrWhiteSpace($Pat))
    }
    else {
        $Pat = $Pat.Trim()
    }

    try {
        Write-Info "Logging in to $OrgUrl..."
        $previousNodeNoWarnings = $env:NODE_NO_WARNINGS
        $env:NODE_NO_WARNINGS = '1'
        try {
            $rawOutput = tfx login --service-url $OrgUrl --token $Pat 2>&1
            $loginExitCode = $LASTEXITCODE
        }
        finally {
            if ($null -eq $previousNodeNoWarnings) {
                Remove-Item Env:NODE_NO_WARNINGS -ErrorAction SilentlyContinue
            }
            else {
                $env:NODE_NO_WARNINGS = $previousNodeNoWarnings
            }
        }

        $output = @($rawOutput |
            ForEach-Object { $_.ToString() } |
            Where-Object {
                $_ -notmatch 'DEP0169|DeprecationWarning:.*url\.parse' -and
                $_ -notmatch 'WHATWG URL API' -and
                $_ -notmatch 'CVEs are not issued for.*url\.parse' -and
                $_ -notmatch '--trace-deprecation'
            })
        
        if ($loginExitCode -ne 0) {
            $errorMessage = $output | Out-String
            if ([string]::IsNullOrWhiteSpace($errorMessage)) {
                $errorMessage = "tfx login failed with exit code $loginExitCode. Verify organization URL and PAT scope."
            }
            
            if ($errorMessage -match "401|Unauthorized|authentication") {
                Write-Error "[ERROR] Authentication failed. Please check your Personal Access Token."
                Write-Info "Make sure your PAT:"
                Write-Info "  - Is not expired"
                Write-Info "  - Has 'Agent Pools (Read & Manage)' or 'Full Access' scope"
                Write-Info "  - Is copied correctly without extra spaces"
            }
            elseif ($errorMessage -match "404|Not Found") {
                Write-Error "[ERROR] Organization not found. Please check your organization URL."
            }
            else {
                Write-Error "[ERROR] Failed to connect: $errorMessage"
            }
            return $false
        }
        
        Write-Success "[OK] Successfully connected to Azure DevOps"
        return $true
    }
    catch {
        Write-Error "[ERROR] Failed to connect: $_"
        return $false
    }
}

# Publish a task
function Publish-Task {
    param(
        [PSCustomObject]$Task,
        [string]$OrgUrl,
        [string]$Pat
    )

    Write-Header "Publishing Task: $($Task.FriendlyName)"
    Write-Info "Task: $($Task.Name)"
    Write-Info "Version: $($Task.Version)"
    Write-Info "Path: $($Task.Path)"
    
    $confirm = Read-Host "`nDo you want to publish this task? (y/n)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Warning "Skipped"
        return
    }

    $taskPathToPublish = $Task.Path
    $clonedTask = $null

    $publishAsNew = Read-Host "Publish as NEW task (new task id + updated friendlyName)? (y/n)"
    if ($publishAsNew -eq 'y' -or $publishAsNew -eq 'Y') {
        try {
            $clonedTask = New-PublishTaskClone -Task $Task
            $taskPathToPublish = $clonedTask.ClonePath
            Write-Info "Publishing NEW task clone"
            Write-Info "  New Id: $($clonedTask.NewTaskId)"
            Write-Info "  New Name: $($clonedTask.NewTaskName)"
            Write-Info "  New FriendlyName: $($clonedTask.NewFriendlyName)"
        }
        catch {
            Write-Error "[ERROR] Failed to prepare new task clone: $_"
            return
        }
    }

    try {
        Write-Info "Uploading task..."
        $previousNodeNoWarnings = $env:NODE_NO_WARNINGS
        $env:NODE_NO_WARNINGS = '1'
        try {
            if ($OrgUrl -and $Pat) {
                $rawOutput = tfx build tasks upload --task-path $taskPathToPublish --service-url $OrgUrl --token $Pat 2>&1
            }
            else {
                $rawOutput = tfx build tasks upload --task-path $taskPathToPublish 2>&1
            }
            $uploadExitCode = $LASTEXITCODE
        }
        finally {
            if ($null -eq $previousNodeNoWarnings) {
                Remove-Item Env:NODE_NO_WARNINGS -ErrorAction SilentlyContinue
            }
            else {
                $env:NODE_NO_WARNINGS = $previousNodeNoWarnings
            }
        }

        $output = @($rawOutput |
            ForEach-Object { $_.ToString() } |
            Where-Object {
                $_ -notmatch 'DEP0169|DeprecationWarning:.*url\.parse' -and
                $_ -notmatch 'WHATWG URL API' -and
                $_ -notmatch 'CVEs are not issued for.*url\.parse' -and
                $_ -notmatch '--trace-deprecation'
            })
        
        if ($uploadExitCode -ne 0) {
            $errorMessage = $output | Out-String
            if ([string]::IsNullOrWhiteSpace($errorMessage)) {
                $errorMessage = "tfx task upload failed with exit code $uploadExitCode."
            }
            
            if ($errorMessage -match "401|Unauthorized") {
                Write-Error "[ERROR] Authentication failed. Your session may have expired."
                Write-Info "Please run the script again to re-authenticate."
            }
            elseif ($errorMessage -match "TF400813|already exists") {
                Write-Error "[ERROR] Task already exists with this version."
                Write-Info "You may need to increment the version in task.json"
            }
            elseif ($errorMessage -match "TF400898|TF400864") {
                Write-Error "[ERROR] Invalid task manifest."
                Write-Info "Please check the task.json file for errors."
            }
            else {
                Write-Error "[ERROR] Failed to publish task: $errorMessage"
            }
            return
        }
        
        Write-Success "[OK] Successfully published $($Task.Name) v$($Task.Version)"
        if ($clonedTask) {
            Write-Success "[OK] Published as NEW task id $($clonedTask.NewTaskId)"
        }
    }
    catch {
        Write-Error "[ERROR] Failed to publish task: $_"
    }
    finally {
        if ($clonedTask -and $clonedTask.ClonePath -and (Test-Path $clonedTask.ClonePath)) {
            Remove-Item -Path $clonedTask.ClonePath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Main script
function Main {
    Write-Header "Azure Pipelines Task Publisher"
    
    # Check if tfx-cli is installed
    if (-not (Test-TfxInstalled)) {
        $install = Read-Host "tfx-cli is not installed. Install it now? (y/n)"
        if ($install -eq 'y' -or $install -eq 'Y') {
            if (-not (Install-Tfx)) {
                return
            }
        }
        else {
            Write-Error "tfx-cli is required. Exiting."
            return
        }
    }
    else {
        Write-Success "[OK] tfx-cli is installed"
    }

    # Get built tasks
    Write-Info "`nScanning for built tasks..."
    $tasks = Get-BuiltTasks
    
    if ($tasks.Count -eq 0) {
        Write-Error "No tasks found in _build directory."
        Write-Info "Run 'node make.js build --task <TaskName>' to build tasks first."
        return
    }

    Write-Success "[OK] Found $($tasks.Count) built tasks"

    # Login to Azure DevOps
    if (-not (Connect-AzureDevOps -OrgUrl $Organization -Pat $Token)) {
        return
    }

    # Select tasks to publish
    Write-Header "Available Tasks"
    
    if ($TaskName) {
        $selectedTask = $tasks | Where-Object { $_.Name -eq $TaskName }
        if (-not $selectedTask) {
            Write-Error "Task '$TaskName' not found in built tasks."
            return
        }
        $tasksToPublish = @($selectedTask)
    }
    else {
        # Display task list
        for ($i = 0; $i -lt $tasks.Count; $i++) {
            Write-Host "[$($i + 1)] $($tasks[$i].DirectoryName)/$($tasks[$i].Name) - v$($tasks[$i].Version)"
        }
        Write-Host "[A] Publish all tasks"
        Write-Host "[Q] Quit"

        $selection = Read-Host "`nSelect task number (or A for all, Q to quit)"
        
        if ($selection -eq 'Q' -or $selection -eq 'q') {
            Write-Info "Exiting..."
            return
        }
        elseif ($selection -eq 'A' -or $selection -eq 'a') {
            $tasksToPublish = $tasks
        }
        else {
            try {
                $index = [int]$selection - 1
                if ($index -ge 0 -and $index -lt $tasks.Count) {
                    $tasksToPublish = @($tasks[$index])
                }
                else {
                    Write-Error "Invalid selection"
                    return
                }
            }
            catch {
                Write-Error "Invalid selection"
                return
            }
        }
    }

    # Publish selected tasks
    foreach ($task in $tasksToPublish) {
        Publish-Task -Task $task -OrgUrl $Organization -Pat $Token
    }

    Write-Header "Done!"
    Write-Success "Task publishing complete"
}

# Run the script
Main
