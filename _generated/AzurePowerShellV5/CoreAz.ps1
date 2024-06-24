[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $true)]
    $endpoint,

    [String] [Parameter(Mandatory = $false)]
    $connectedServiceNameARM,

    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [bool] [Parameter(Mandatory = $false)]
    $isPSCore,

    [String] [Parameter(Mandatory = $false)]
    $vstsAccessToken
)

Import-Module "$PSScriptRoot\ps_modules\VstsTaskSdk" -ArgumentList @{ NonInteractive = $true }
Import-VstsLocStrings -LiteralPath "$PSScriptRoot\task.json"

# Update PSModulePath for hosted agent
. "$PSScriptRoot\Utility.ps1"
CleanUp-PSModulePathForHostedAgent
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs

$endpointObject =  ConvertFrom-Json  $endpoint
Import-Module "$PSScriptRoot\ps_modules\VstsAzureHelpers_"
$encryptedToken = ConvertTo-SecureString $vstsAccessToken -AsPlainText -Force
Initialize-AzModule -Endpoint $endpointObject -connectedServiceNameARM $connectedServiceNameARM `
    -azVersion $targetAzurePs -isPSCore $isPSCore -encryptedToken $encryptedToken

if ($vstsAccessToken) {
    $env:AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = $connectedServiceNameARM
    $env:AZURESUBSCRIPTION_CLIENT_ID = $endpointObject.servicePrincipalClientID
    $env:AZURESUBSCRIPTION_TENANT_ID = $endpointObject.tenantId
}