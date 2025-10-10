Import-Module "$PSScriptRoot\ps_modules\VstsTaskSdk" -ArgumentList @{ NonInteractive = $true }
Import-Module $PSScriptRoot\ps_modules\VstsTaskSdk -ArgumentList @{ NonInteractive = $true }

. "$PSScriptRoot/Utility.ps1"
. "$PSScriptRoot/ps_modules/VstsAzureHelpers_/Utility.ps1"