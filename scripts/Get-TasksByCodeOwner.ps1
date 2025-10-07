Param(
    [Parameter(Mandatory = $true)]
    [string]$OwnerName
)

$tasks = (& "$(Join-Path $PSScriptRoot Get-TasksInfo.ps1)")

$tasksByOwner = @()
foreach ($task in $tasks) {
    if ($task.Owners -contains $OwnerName) {
        $tasksByOwner += , $task
    }
}

return $tasksByOwner
