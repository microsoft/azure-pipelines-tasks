[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $true)]
    $endpoint,

    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] $restrictContext = 'True'
)

Import-Module "$PSScriptRoot\ps_modules\VstsTaskSdk" -ArgumentList @{ NonInteractive = $true }
Import-VstsLocStrings -LiteralPath "$PSScriptRoot\task.json"

# Update PSModulePath for hosted agent
. "$PSScriptRoot\Utility.ps1"
CleanUp-PSModulePathForHostedAgent
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs

# troubleshoot link
$troubleshoot = "https://aka.ms/azurepowershelltroubleshooting"

try
{
    # Initialize Azure.
    Write-Host "## Initializing Az module"
    $endpointObject =  ConvertFrom-Json  $endpoint
    Import-Module "$PSScriptRoot\ps_modules\VstsAzureHelpers_"
    Initialize-AzModule -Endpoint $endpointObject -azVersion $targetAzurePs -restrictContext $restrictContext
    $success = $true
}
finally {
    if (!$success) {
        Write-VstsTaskError "Initializing Az module failed: For troubleshooting, refer: $troubleshoot"
    }
}
Write-Host "## Az module initialization Complete"