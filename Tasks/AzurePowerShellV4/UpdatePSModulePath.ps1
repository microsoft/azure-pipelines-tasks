[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs
)

# Update PSModulePath for hosted agent
. "$PSScriptRoot\Utility.ps1"
CleanUp-PSModulePathForHostedAgent
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs