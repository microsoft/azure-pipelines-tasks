[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $true)]
    $endpoint,

    [String] [Parameter(Mandatory = $true)]
    $connectedServiceNameARM,

    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

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
Initialize-AzModule -Endpoint $endpointObject -connectedServiceNameARM $connectedServiceNameARM `
    -azVersion $targetAzurePs -vstsAccessToken $vstsAccessToken