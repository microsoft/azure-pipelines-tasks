Write-Verbose "Import VstsAzureHelpers_ 1c"
Import-Module "$PSScriptRoot\ps_modules\VstsAzureHelpers_"

Write-Verbose "Import VstsAzureHelpers_ 2c"
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_

Write-Verbose "Import VstsAzureHelpers_ 3c"
$moduleName = "$PSScriptRoot\ps_modules\VstsAzureHelpers_"
$module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

Write-Verbose "Import VstsAzureHelpers_ 4c"
$moduleName2 = $PSScriptRoot\ps_modules\VstsAzureHelpers_
$module2 = Get-Module -Name $moduleName2 -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

. "$PSScriptRoot/Utility.ps1"
. "$PSScriptRoot/ps_modules/VstsAzureHelpers_/Utility.ps1"

Update-PSModulePathForHostedAgentLinux
Disconnect-AzureAndClearContext -restrictContext 'True'

if ($env:AZURESUBSCRIPTION_SERVICE_CONNECTION_ID) {
    $env:AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = ""
    $env:AZURESUBSCRIPTION_CLIENT_ID = ""
    $env:AZURESUBSCRIPTION_TENANT_ID = ""
}