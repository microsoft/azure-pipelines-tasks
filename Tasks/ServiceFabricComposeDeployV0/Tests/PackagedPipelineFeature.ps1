[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
# A Node-launched Windows PowerShell can inherit PowerShell 7 module paths.
Import-Module "$PSHOME\Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1"
Import-Module "$PSScriptRoot\..\ps_modules\VstsTaskSdk\VstsTaskSdk.psd1" -ArgumentList @{ NonInteractive = $true }

$featureVariable = 'DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS'
foreach ($value in @($null, 'false', 'true')) {
    if ($null -eq $value) {
        Remove-Item -LiteralPath "Env:$featureVariable" -ErrorAction SilentlyContinue
    } else {
        Set-Item -LiteralPath "Env:$featureVariable" -Value $value
    }

    $actual = Get-VstsTaskVariable -Name 'DistributedTask.Tasks.EnableVsoCommandBlockingRMTasks' -AsBool
    if ($actual -ne ($value -eq 'true')) {
        throw "Unexpected packaged pipeline feature value for '$value': $actual"
    }
}
Write-Host 'packaged-pipeline-feature-verified'
