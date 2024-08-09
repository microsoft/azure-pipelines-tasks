Param(
    [string]$OwnerName
)

$codeowners = Get-Content (Join-Path  $PSScriptRoot .. .github CODEOWNERS)

$tasks = $()
$codeowners | ForEach-Object {
    if ($_ -notlike "* $($OwnerName)*") {
        return
    }
    if ($_ -notlike '*Tasks/*') {
        return
    }

    $taskName = $_ -replace 'Tasks/', '' -replace '/.*', ''
    $tasks += , $taskName
}

if ($tasks.Count -eq 0) {
    Write-Error "No tasks found for owner $OwnerName" -ErrorAction Stop
}

$tasks | Out-File -FilePath (Join-Path $PSScriptRoot "TaskNames_$($OwnerName -replace '(\\|\/)', '_').txt")
