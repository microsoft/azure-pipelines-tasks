function Set-CurrentAzureSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$StorageAccount)

    $additional = @{ }
    if ($script:azureModuleVersion -lt ([version]'0.8.15')) {
        $additional['Default'] = $true # The Default switch is required prior to 0.8.15.
    }

    $null = Select-AzureSubscription -SubscriptionId $SubscriptionId @additional
    if ($StorageAccount) {
        Set-AzureSubscription -SubscriptionId $SubscriptionId -CurrentStorageAccountName $StorageAccount
    }
}

function Set-CurrentAzureRMSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$TenantId)

    $additional = @{ }
    if ($TenantId) { $additional['TenantId'] = $TenantId }
    $null = Select-AzureRMSubscription -SubscriptionId $SubscriptionId @additional
}

function Initialize-AzureSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string]$StorageAccount)

    if ($Endpoint.Auth.Scheme -eq 'Certificate') {
        if (!(Get-Module Azure)) {
            # TODO: LOC
            throw "Azure Powershell module is not found. Certificate based authentication is failed."
        }

        $bytes = [System.Convert]::FromBase64String($Endpoint.Auth.Parameters.Certificate)
        $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
        $certificate.Import($bytes)
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
            ([System.Security.Cryptography.X509Certificates.StoreName]::My),
            ([System.Security.Cryptography.X509Certificates.StoreLocation]::'CurrentUser'))
        $store.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))
        $store.Add($certificate)
        $store.Close()
        $additional = @{ }
        if ($script:azureModuleVersion -lt ([version]'0.8.8')) {
            $additional['ServiceEndpoint'] = $Endpoint.Url
        } else {
            $additional['Environment'] = 'AzureCloud'
        }

        if ($StorageAccount) {
            $additional['CurrentStorageAccountName'] = $StorageAccount
        }

        Set-AzureSubscription -SubscriptionName $Endpoint.Data.SubscriptionName -SubscriptionId $Endpoint.Data.SubscriptionId -Certificate $certificate @additional
        Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId
    } elseif ($Endpoint.Auth.Scheme -eq 'UserNamePassword') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.UserName,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.Password -AsPlainText -Force))
        if (Get-Module Azure) {
            $azureAccount = Add-AzureAccount -Credential $psCredential
        }

        # TODO: Shouldn't this simply be "else"? By the time we get here, don't we know it's AzureRM?
        # TODO: Why is -ListAvailable passed to Get-Module? Is module auto-loading being
        # relied upon here to resolve the command Add-AzureRMAccount? If so, the required
        # module should be explicitly imported instead.
        if (Get-module -Name Azurerm.profile -ListAvailable) {
            #  Write-Host "Add-AzureRMAccount -Credential `$psCredential"
            $azureRMAccount = Add-AzureRMAccount -Credential $psCredential
        }

        # TODO: Would Add-AzureAccount/Add-AzureRMAccount generate an error? If so, passing "-ErrorAction Stop" would be better since it would already supply a meaningful error message and prevent further execution.
        if (!$azureAccount -and !$azureRMAccount)
        {
            # TODO: LOC
            throw "There was an error with the Azure credentials used for deployment."
        }

        # TODO: If Add-AzureAccount can be relied on to stop on failure, then this should move into the approriate IF block above.
        if ($azureAccount) {
            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        }

        # TODO: If Add-AzureRMAccount can be relied on to stop on failure, then this should move into the approriate IF block above.
        if ($azureRMAccount) {
            Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId
        }
    } elseif ($Endpoint.Auth.Scheme -eq 'ServicePrincipal') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.ServicePrincipalId,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))
        if ($script:azureModuleVersion -lt ([version]'0.9.9')) { # Shouldn't the condition be "-lt 1.0"?
             $azureAccount = Add-AzureAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential
        } else {
            # TODO: Shouldn't this simply be "else"? By the time we get here, don't we know it's AzureRM?
            # TODO: Why is -ListAvailable passed to Get-Module? Is module auto-loading being
            # relied upon here to resolve the command Add-AzureRMAccount? If so, the required
            # module should be explicitly imported instead.
            if (!(Get-module -Name Azurerm.profile -ListAvailable)) {
                # TODO: LOC
                throw "AzureRM Powershell module is not found. SPN based authentication is failed."
            }

            $azureRMAccount = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential 
        }

        # TODO: Would Add-AzureAccount/Add-AzureRMAccount generate an error? If so, passing "-ErrorAction Stop" would be better since it would already supply a meaningful error message and prevent further execution.
        if (!$azureAccount -and !$azureRMAccount) {
            # TODO: LOC
            throw "There was an error with the service principal used for deployment."
        }

        # TODO: If Add-AzureAccount generates an error on failure, then this should move into the approriate IF block above.
        if ($azureAccount) {
            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        }

        # TODO: If Add-AzureRMAccount generates an error on failure, then this should move into the approriate IF block above.
        if ($azureRMAccount) {
            Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }
    } else {
        # TODO: LOC
        throw "Unsupported authorization scheme for azure endpoint = " + $Endpoint.Auth.Scheme
    }
}

function Import-AzureModule {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        foreach ($programFiles in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
            if (!$programFiles) { continue }
            $path = [System.IO.Path]::Combine($programFiles, "Microsoft SDKs\Azure\PowerShell\ServiceManagement\Azure\Azure.psd1")
            if (Test-Path -LiteralPath $path -PathType Leaf) {
                Write-Verbose "Importing '$psd1'."
                Import-Module -Name $path -Global -PassThru -Verbose:$false
                return
            }
        }

        foreach ($name in @('Azure', 'AzureRM')) {
            if (Get-Module -Name $name -ListAvailable) {
                Write-Verbose "Importing module '$name'."
                Import-Module -Name $name -Global -PassThru -Verbose:$false
                return
            }
        }

        throw (Get-VstsLocString -Key AZ_ModuleNotFound)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
