Set-StrictMode -Version 3.0

$tasksInfo = @()

# Pre-cache codeowners file
$codeowners = Get-Content (Join-Path  $PSScriptRoot .. .github CODEOWNERS)

## Get build configs of each task
$buildConfigsPerTask = @{}
$makeOptions = Get-Content (Join-Path $PSScriptRoot .. make-options.json) | ConvertFrom-Json -AsHashtable
$buildConfigs = $makeOptions.Keys | Where-Object { $_ -notin 'tasks', 'taskResources', 'LocalPackages' }
foreach ($buildConfig in $buildConfigs) {
    $tasks = $makeOptions[$buildConfig]
    foreach ($task in $tasks) {
        $buildConfigsPerTask[$task] += , $buildConfig
    }
}

$tasksDir = Join-Path $PSScriptRoot .. Tasks
foreach ($taskPath in (Get-ChildItem -Path $tasksDir)) {
    if (Test-Path -Path $taskPath -PathType Leaf) {
        Write-Verbose "Skipping $taskPath"
        continue
    }

    $taskDirName = Split-Path $taskPath -Leaf

    if ($taskDirName -in 'Common') {
        Write-Verbose "Skipping $taskPath"
        continue
    }

    try {
        $taskJson = Get-Content (Join-Path $taskPath task.json) | ConvertFrom-Json -AsHashtable

        $owners = @()
        $ownersLine = $codeowners
        | Where-Object { $_ -like "*Tasks/$($taskDirName)*" }
        | ForEach-Object { $_ -replace "Tasks/$($taskDirName)( |/)", '' }
        if ($null -ne $ownersLine) {
            $owners = ($ownersLine.Trim()) -split '\s+'
        }

        $buildConfigs = @()
        if ($buildConfigsPerTask.ContainsKey($taskDirName)) {
            $buildConfigs = $buildConfigsPerTask[$taskDirName]
        }

        $isDeprecated = $false
        if ($taskJson.ContainsKey('deprecated')) {
            $isDeprecated = $taskJson.deprecated
        }

        $taskInfo = [pscustomobject]@{
            DirName      = $taskDirName
            Name         = $taskJson.name
            Id           = $taskJson.id
            Version      = "$($taskJson.version.Major).$($taskJson.version.Minor).$($taskJson.version.Patch)"
            Owners       = $owners
            BuildConfigs = $buildConfigs
            IsDeprecated = $isDeprecated
        }

        $tasksInfo += , $taskInfo
    }
    catch {
        Write-Error "Error when processing task $($taskDirName)`:`n$_" -ErrorAction Stop
    }
}

return $tasksInfo
