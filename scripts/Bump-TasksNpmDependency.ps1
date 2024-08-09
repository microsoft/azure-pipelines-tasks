Param(
    [Parameter(Mandatory = $true)]
    [string]$Dependency,
    [string]$TasksListFilePath = (Join-Path $PSScriptRoot TaskNames.txt),
    [switch]$BumpTasks
)

function Confirm-TaskVersionBumped([string]$TaskJsonPath) {
    $diffScriptPath = Join-Path $PSScriptRoot Get-FileGitDiffAsJson.ps1

    $diffJson = (& "$diffScriptPath" -FilePath "$TaskJsonPath") | ConvertFrom-Json

    foreach ($diff in $diffJson) {
        if ($diff.Change -eq 'Added' -and $diff.Content -match '"(Minor|Patch)":\s*\d+') {
            return $true
        }
    }

    return $false
}

# You'll need to have txt file with task names line by line, e.g:
# TaskV1
# TaskV2
# ...
Write-Host "Getting target tasks names from $TasksListFilePath" -ForegroundColor Cyan
$tasks = Get-Content $TasksListFilePath

$currentLocation = Get-Location
$repositoryRoot = Join-Path $PSScriptRoot ..

try {
    $tasks | ForEach-Object {
        $taskName = $_
        Write-Host "Bumping dependency in task $taskName" -ForegroundColor Cyan

        $taskPath = Join-Path $repositoryRoot Tasks $taskName

        Set-Location $taskPath
        npm i "$Dependency"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install $Dependency for $taskName" -ErrorAction Stop
        }

        $buildConfigsDir = Get-ChildItem | Where-Object { $_.Name -eq '_buildConfigs' }
        if ($buildConfigsDir) {
            Write-Host "Bumping dependency in task $taskName build configs" -ForegroundColor Cyan
            $buildConfigs = Get-ChildItem (Join-Path $taskPath _buildConfigs)
            $buildConfigs | ForEach-Object {
                $buildConfig = $_
                $buildConfigPath = Join-Path $taskPath _buildConfigs $buildConfig.Name

                Write-Host "Installing $Dependency for task $taskName buidconfig $buildConfig" -ForegroundColor Cyan
                Set-Location $buildConfigPath
                npm i "$Dependency"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to install $Dependency for buildconfig $($buildConfig.Name) of task $taskName" -ErrorAction Stop
                }
            }
        }
    }

    if ($BumpTasks) {
        Set-Location $repositoryRoot
        $tasksToBump = @()
        $changes = git ls-files --modified --full-name
        for ($i = 0; $i -lt $changes.Length; $i++) {
            $changes[$i] = Resolve-Path (Join-Path $repositoryRoot $changes[$i]) -Relative
        }

        foreach ($task in $tasks) {
            $taskPath = Join-Path $repositoryRoot Tasks $task
            $taskPackageJsonPath = Resolve-Path (Join-Path $taskPath package.json) -Relative
            if ($changes -contains $taskPackageJsonPath) {
                $taskJsonPath = Resolve-Path (Join-Path $taskPath task.json) -Relative
                if (-not (Confirm-TaskVersionBumped -TaskJsonPath $taskJsonPath)) {
                    $tasksToBump += , $task
                }
                else {
                    Write-Host "Task $task is already bumped. Skipping bump of version" -ForegroundColor Cyan
                }
            }
            else {
                Write-Host "Dependency $Dependency in task $task is not modified. Skipping bump of version" -ForegroundColor Cyan
            }
        }

        if ($tasksToBump.Count -eq 0) {
            Write-Host "No tasks to bump" -ForegroundColor Cyan
            return
        }

        Write-Host "Bumping tasks $tasksToBump" -ForegroundColor Cyan
        $tasksPattern = '@(' + ($tasksToBump -join '|') + ')'

        # Bump twice as build config forces patch versions should be current + 2
        node make bump --task "$tasksPattern"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to Bump tasks $tasks" -ErrorAction Stop
        }
        node make bump --task "$tasksPattern"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to Bump tasks $tasks" -ErrorAction Stop
        }

        Write-Host "Building tasks $tasks" -ForegroundColor Cyan
        node make build --task "$tasksPattern"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to Bump tasks $tasks" -ErrorAction Stop
        }
    }
}
finally {
    Set-Location $currentLocation
}
