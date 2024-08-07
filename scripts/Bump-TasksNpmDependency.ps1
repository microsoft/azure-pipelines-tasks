Param(
    [string]$Dependency,
    [string]$TasksFilePath = (Join-Path $PSScriptRoot TaskNames.txt),
    [switch]$BumpVersions
)

# You'll need to have txt file with task names line by line, e.g:
# TaskV1
# TaskV2
# ...
Write-Host "Getting target tasks names from $TasksFilePath" -ForegroundColor Cyan
$tasks = Get-Content $TasksFilePath

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
            Write-Error "Failed to install task lib for $taskName" -ErrorAction Stop
        }

        $buildConfigsDir = Get-ChildItem | Where-Object { $_.Name -eq '_buildConfigs' }
        if ($buildConfigsDir) {
            Write-Host "Bumping dependency in task $taskName build configs" -ForegroundColor Cyan
            $buildConfigs = Get-ChildItem (Join-Path $taskPath _buildConfigs)
            $buildConfigs | ForEach-Object {
                $buildConfig = $_
                $buildConfigPath = Join-Path $taskPath _buildConfigs $buildConfig.Name

                Write-Host "Installing task lib for task $taskName buidconfig $buildConfig" -ForegroundColor Cyan
                Set-Location $buildConfigPath
                npm i "$Dependency"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to install task lib for buildconfig $($buildConfig.Name) of task $taskName" -ErrorAction Stop
                }
            }
        }
    }

    if ($BumpVersions) {
        Write-Host "Bumping tasks $tasks" -ForegroundColor Cyan

        $tasksPattern = '@(' + ($tasks -join '|') + ')'
        Set-Location $repositoryRoot

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
