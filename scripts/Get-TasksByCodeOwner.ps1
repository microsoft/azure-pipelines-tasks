Param(
    [Parameter(Position = 0, mandatory = $true)]
    [string]$OwnerName
)

$tasksDir = Join-Path $PSScriptRoot .. Tasks

$tasks = $()

$codeowners = Get-Content (Join-Path  $PSScriptRoot .. .github CODEOWNERS)
$codeowners | ForEach-Object {
    if ($_ -notlike "* $($OwnerName)*") {
        return
    }
    if ($_ -notlike '*Tasks/*') {
        return
    }

    $taskName = $_ -replace 'Tasks/', '' -replace '/.*', ''
    $taskJson = Get-Content (Join-Path $tasksDir $taskName task.json) | ConvertFrom-Json -AsHashtable
    $task = [pscustomobject]@{
        Name = $taskName
        Id   = $taskJson.id
    }

    $tasks += , $task
}

if ($tasks.Count -eq 0) {
    Write-Error "No tasks found for owner $OwnerName" -ErrorAction Stop
}

return $tasks
