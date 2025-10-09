Write-Verbose "Import VstsAzureHelpers_ 1"
Import-Module "$PSScriptRoot\ps_modules\VstsAzureHelpers_"

Write-Verbose "Import VstsAzureHelpers_ 2"
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_

Write-Verbose "Import VstsAzureHelpers_ 3"
$moduleName = "$PSScriptRoot\ps_modules\VstsAzureHelpers_"
$module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

Write-Verbose "Import VstsAzureHelpers_ 4"
$moduleName2 = $PSScriptRoot\ps_modules\VstsAzureHelpers_
$module2 = Get-Module -Name $moduleName2 -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

. "$PSScriptRoot/Utility.ps1"
. "$PSScriptRoot/ps_modules/VstsAzureHelpers_/Utility.ps1"