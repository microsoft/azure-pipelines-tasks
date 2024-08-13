Param(
    [Parameter(Mandatory = $true)]
    [string]$Dependency,
    [string]$TasksListFilePath = (Join-Path $PSScriptRoot TaskNames.txt),
    [switch]$BumpTasks
)

Set-StrictMode -Version 3.0

class TaskInfo {
    [string]$Name
    [bool]$IsBuildConfigPresent

    TaskInfo([string]$Name) {
        $this.Name = $Name
        $this.IsBuildConfigPresent = $false
    }

    [string] ToString() {
        return "( Name: $($this.Name), IsBuildConfigPresent: $($this.IsBuildConfigPresent) )"
    }
}

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
[TaskInfo[]]$tasks = Get-Content $TasksListFilePath | ForEach-Object { [TaskInfo]::new($_) }

$currentLocation = Get-Location
$repositoryRoot = Join-Path $PSScriptRoot ..

try {
    foreach ($task in $tasks) {
        $taskName = $task.Name

        Write-Host "Bumping dependency in task $taskName" -ForegroundColor Cyan

        $taskPath = Join-Path $repositoryRoot Tasks $taskName

        Set-Location $taskPath
        npm i "$Dependency"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install $Dependency for $taskName" -ErrorAction Stop
        }

        ## Updating target dependency in build configs
        $buildConfigsDir = Get-ChildItem | Where-Object { $_.Name -eq '_buildConfigs' }
        if ($buildConfigsDir) {
            Write-Host "Bumping dependency in task $taskName build configs" -ForegroundColor Cyan
            $buildConfigs = Get-ChildItem (Join-Path $taskPath _buildConfigs) | ForEach-Object { $_.Name }
            $buildConfigsCount = $buildConfigs | Measure-Object | Select-Object -ExpandProperty Count
            if ($buildConfigsCount -eq 0) {
                Write-Host "No build configs found for task $taskName" -ForegroundColor Cyan
                continue
            }

            $task.IsBuildConfigPresent = $true

            foreach ($buildConfigName in $buildConfigs) {
                $buildConfigPath = Join-Path $taskPath _buildConfigs $buildConfigName

                Write-Host "Installing $Dependency for task $taskName buidconfig $buildConfigName" -ForegroundColor Cyan
                Set-Location $buildConfigPath
                npm i "$Dependency"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to install $Dependency for buildconfig $buildConfigName of task $taskName" -ErrorAction Stop
                }
            }
        }
    }

    if ($BumpTasks) {
        Set-Location $repositoryRoot
        [TaskInfo[]]$tasksToBump = @()
        $changes = git ls-files --modified --full-name
        for ($i = 0; $i -lt $changes.Length; $i++) {
            $changes[$i] = Resolve-Path (Join-Path $repositoryRoot $changes[$i]) -Relative
        }

        foreach ($task in $tasks) {
            $taskName = $task.Name
            $taskPath = Join-Path $repositoryRoot Tasks $taskName
            $taskPackageJsonPath = Resolve-Path (Join-Path $taskPath package.json) -Relative
            if ($changes -contains $taskPackageJsonPath) {
                $taskJsonPath = Resolve-Path (Join-Path $taskPath task.json) -Relative
                if (-not (Confirm-TaskVersionBumped -TaskJsonPath $taskJsonPath)) {
                    $tasksToBump += , $task
                }
                else {
                    Write-Host "Task $taskName is already bumped. Skipping bump of version" -ForegroundColor Cyan
                }
            }
            else {
                Write-Host "Dependency $Dependency in task $taskName is not modified. Skipping bump of version" -ForegroundColor Cyan
            }
        }

        if ($tasksToBump.Count -gt 0) {
            $bumpTasksNames = $tasksToBump | ForEach-Object { $_.Name }
            Write-Host "Bumping tasks $bumpTasksNames" -ForegroundColor Cyan
            $tasksPattern = '@(' + ($bumpTasksNames -join '|') + ')'

            node make bump --task "$tasksPattern"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to Bump tasks $bumpTasksNames" -ErrorAction Stop
            }

            # Bump the second time as build config forces patch versions should be current + 2
            $tasksToBumpWithBuildConfigs = $tasksToBump | Where-Object { $_.IsBuildConfigPresent }
            if ($tasksToBumpWithBuildConfigs.Count -gt 0) {
                $tasksWithBuildConfigsNames = $tasksToBumpWithBuildConfigs | ForEach-Object { $_.Name }
                Write-Host "Re-bumping tasks $tasksWithBuildConfigsNames with build configs" -ForegroundColor Cyan

                $tasksWithBuildConfigsPattern = '@(' + ($tasksWithBuildConfigsNames -join '|') + ')'
                node make bump --task "$tasksWithBuildConfigsPattern"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to Bump tasks $tasksToBumpWithBuildConfigs" -ErrorAction Stop
                }
            }
        }
        else {
            Write-Host "No tasks to bump" -ForegroundColor Cyan
        }
    }

    Write-Host "Building tasks $tasks" -ForegroundColor Cyan
    $tasksPattern = '@(' + (($tasks | ForEach-Object { $_.Name } ) -join '|') + ')'
    node make build --task "$tasksPattern"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to Bump tasks $tasks" -ErrorAction Stop
    }
}
finally {
    Set-Location $currentLocation
}
