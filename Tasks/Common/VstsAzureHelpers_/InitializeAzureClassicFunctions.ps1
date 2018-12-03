# Dot source Utility functions.
. $PSScriptRoot/Utility.ps1

function Initialize-AzureClassicModule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string]$StorageAccount)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
        if (!(Import-AzureClassicModule))
        {
            throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList "Any version", "Azure")
        }

        Initialize-AzureClassicSubscription -Endpoint $Endpoint -StorageAccount $StorageAccount
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-AzureClassicModule {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $moduleName = "Azure"
        # Attempt to resolve the module.
        Write-Verbose "Attempting to find the module '$moduleName' from the module path."
        $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
        if (!$module) {
            Write-Verbose "No module found with name: $moduleName"
            return $false
        }

        # Import the module.
        Write-Host "##[command]Import-Module -Name $($module.Path) -Global"
        $module = Import-Module -Name $module.Path -Global -PassThru -Force
        Write-Verbose "Imported module version: $($module.Version)"

        return $true
     }finally {
        Trace-VstsLeavingInvocation $MyInvocation
     }
}

function Initialize-AzureClassicSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string]$StorageAccount)

    #Set UserAgent for Azure Calls
    Set-UserAgent

    $environmentName = "AzureCloud"
    
    if ($Endpoint.Auth.Scheme -eq 'Certificate') {
        # Add the certificate to the cert store.
        $certificate = Add-Certificate -Endpoint $Endpoint

        # Setup the additional parameters.
        $additional = @{ }
        if ($StorageAccount) {
            $additional['CurrentStorageAccountName'] = $StorageAccount
        }

        # Set the subscription.
        Write-Host "##[command]Set-AzureSubscription -SubscriptionName $($Endpoint.Data.SubscriptionName) -SubscriptionId $($Endpoint.Data.SubscriptionId) -Certificate ******** -Environment $environmentName $(Format-Splat $additional)"
        Set-AzureSubscription -SubscriptionName $Endpoint.Data.SubscriptionName -SubscriptionId $Endpoint.Data.SubscriptionId -Certificate $certificate -Environment $environmentName @additional
        Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount

    } elseif ($Endpoint.Auth.Scheme -eq 'UserNamePassword') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.UserName,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.Password -AsPlainText -Force))

        # Add Azure account
        try {
            Write-Host "##[command]Add-AzureAccount -Credential $psCredential"
            $null = Add-AzureAccount -Credential $psCredential
        } catch {
            # Provide an additional, custom, credentials-related error message.
            Write-VstsTaskError -Message $_.Exception.Message
            Assert-TlsError -exception $_.Exception
            throw (New-Object System.Exception((Get-VstsLocString -Key AZ_CredentialsError), $_.Exception))
        }

        # Select Azure subscription
        Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
    } 
    else {
        throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
    } 
}



