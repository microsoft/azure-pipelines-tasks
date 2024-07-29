Param(
    [switch]$WithNames
)

$taskIdsSet = New-Object System.Collections.Generic.HashSet[string]

foreach ($task in (Get-ChildItem -Path (Join-Path $PSScriptRoot Tasks))) {
    if (Test-Path -Path $task -PathType Leaf) {
        Write-Host "Skipping $task"
        continue
    }

    if ((Split-Path $task -Leaf) -in 'Common') {
        Write-Host "Skipping $task"
        continue
    }

    try {
        $taskJson = Get-Content (Join-Path $task task.json) | ConvertFrom-Json -AsHashtable
        if ($WithNames) {
            $null = $taskIdsSet.Add("$($taskJson.id) // $($taskJson.name)")
        }
        else {
            $null = $taskIdsSet.Add($taskJson.id)
        }
    }
    catch {
        Write-Error "Error in $($task)`:`n$_"
        continue
    }
}

$taskIdsSet | Out-File -FilePath (Join-Path $PSScriptRoot TaskIds.txt)
