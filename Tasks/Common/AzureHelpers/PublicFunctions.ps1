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

        # Import the Azure module.
        $script:azureModuleVersion = (Import-AzureModule).Version
        Write-Verbose "Imported Azure module version: '$script:azureModuleVersion'"

        # Validate the imported version.
        $minimumVersion = [version]'0.8.10.1'
        if ($script:azureModuleVersion -lt $minimumVersion) {
            throw (Get-VstsLocString -Key AZ_RequiresMinVersion0 -ArgumentList $minimumVersion)
        }

        Initialize-AzureSubscription -Endpoint $endpoint -StorageAccount $storageAccount
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}