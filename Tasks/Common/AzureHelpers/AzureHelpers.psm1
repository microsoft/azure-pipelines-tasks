# Private module-scope variables.
$script:isClassic = $null
$script:classicVersion = $null

# Override the DebugPreference.
if ($global:DebugPreference -eq 'Continue') {
    Write-Verbose '$OVERRIDING $global:DebugPreference from ''Continue'' to ''SilentlyContinue''.'
    $global:DebugPreference = 'SilentlyContinue'
}

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

# Dot source the private functions.
. $PSScriptRoot/InitializeFunctions.ps1
. $PSScriptRoot/ImportFunctions.ps1

# This is the only public function.
function Initialize-Azure {
    [CmdletBinding()]
    param()
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Get the inputs.
        $serviceNameInput = Get-VstsInput -Name ConnectedServiceNameSelector -Default 'ConnectedServiceName'
        $serviceName = Get-VstsInput -Name $serviceNameInput -Default (Get-VstsInput -Name DeploymentEnvironmentName)
        if (!$serviceName) {
            # Let the task SDK throw an error message if the input isn't defined.
            Get-VstsInput -Name $serviceNameInput -Require
        }

        $endpoint = Get-VstsEndpoint -Name $serviceName -Require
        $storageAccount = Get-VstsInput -Name StorageAccount

        # Import/initialize the Azure module.
        Import-AzureModule -PreferAzureRM:($serviceNameInput -eq 'ConnectedServiceNameARM')
        Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $storageAccount
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

# Export only the public function.
Export-ModuleMember -Function Initialize-Azure