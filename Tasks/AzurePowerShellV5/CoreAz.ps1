[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $true)]
    $endpoint,

#if WORKLOADIDENTITYFEDERATION
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs
#else
    [String] [Parameter(Mandatory = $false)]
    $connectedServiceNameARM,

    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] [Parameter(Mandatory = $false)]
    $vstsAccessToken
#endif
)

Import-Module "$PSScriptRoot\ps_modules\VstsTaskSdk" -ArgumentList @{ NonInteractive = $true }
Import-VstsLocStrings -LiteralPath "$PSScriptRoot\task.json"

# Update PSModulePath for hosted agent
. "$PSScriptRoot\Utility.ps1"
CleanUp-PSModulePathForHostedAgent
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs

$endpointObject =  ConvertFrom-Json  $endpoint
Import-Module "$PSScriptRoot\ps_modules\VstsAzureHelpers_"
#if WORKLOADIDENTITYFEDERATION
Initialize-AzModule -Endpoint $endpointObject -azVersion $targetAzurePs
#else
Initialize-AzModule -Endpoint $endpointObject -connectedServiceNameARM $connectedServiceNameARM `
    -azVersion $targetAzurePs -vstsAccessToken $vstsAccessToken
#endif