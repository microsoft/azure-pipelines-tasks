[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $true)]
    $endpoint,

    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs
)

$endpointObject =  ConvertFrom-Json  $endpoint
$moduleName = "Az.Accounts"
$environmentName = $endpointObject.environment

$azureRMModulePath = "C:\Modules\azurerm_2.1.0"
$azureModulePath = "C:\Modules\azure_2.1.0"
$azPSModulePath = $env:PSModulePath

if ($azPSModulePath.split(";") -contains $azureRMModulePath) {
    $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
    write-host "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-host "$azureRMModulePath is not present in $azPSModulePath"
}

if ($azPSModulePath.split(";") -contains $azureModulePath) {
    $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
    write-host "$azureModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-host "$azureModulePath is not present in $azPSModulePath"
}

$env:PSModulePath = $azPSModulePath

Write-Host "InitializeAzWindows invoked"
. "$PSScriptRoot/Utility.ps1"
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs
