$script:isClassic = $null
$script:classicVersion = $null

function Add-Certificate {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)]$Endpoint)

    # Add the certificate to the cert store.
    $bytes = [System.Convert]::FromBase64String($Endpoint.Auth.Parameters.Certificate)
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $certificate.Import($bytes)
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        ([System.Security.Cryptography.X509Certificates.StoreName]::My),
        ([System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser))
    $store.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))
    $store.Add($certificate)
    $store.Close()
    return $certificate
}

function Initialize-AzureSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string]$StorageAccount)

    if ($Endpoint.Auth.Scheme -eq 'Certificate') {
        # Certificate is only supported for the Azure module.
        if (!$script:isClassic) {
            throw (Get-VstsLocString -Key AZ_CertificateAuthNotSupported)
        }

        # Add the certificate to the cert store.
        $certificate = Add-Certificate -Endpoint $Endpoint

        # Setup the additional parameters.
        $additional = @{ }
        if ($StorageAccount) {
            $additional['CurrentStorageAccountName'] = $StorageAccount
        }

        # Set the subscription.
        Write-Host "##[command]Set-AzureSubscription -SubscriptionName $($Endpoint.Data.SubscriptionName) -SubscriptionId $($Endpoint.Data.SubscriptionId) -Certificate ******** -Environment AzureCloud $(Format-Splat $additional)"
        Set-AzureSubscription -SubscriptionName $Endpoint.Data.SubscriptionName -SubscriptionId $Endpoint.Data.SubscriptionId -Certificate $certificate -Environment AzureCloud @additional
        Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
    } elseif ($Endpoint.Auth.Scheme -eq 'UserNamePassword') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.UserName,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.Password -AsPlainText -Force))
        if ($script:isClassic) {
            try {
                Write-Host "##[command]Add-AzureAccount -Credential $psCredential"
                $null = Add-AzureAccount -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_CredentialsError), $_.Exception))
            }

            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        } else {
            try {
                Write-Host "##[command]Add-AzureRMAccount -Credential $psCredential"
                $null = Add-AzureRMAccount -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_CredentialsError), $_.Exception))
            }

            Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId
        }
    } elseif ($Endpoint.Auth.Scheme -eq 'ServicePrincipal') {
        $psCredential = New-Object System.Management.Automation.PSCredential(
            $Endpoint.Auth.Parameters.ServicePrincipalId,
            (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))
        if ($script:isClassic -and $script:classicVersion -lt ([version]'0.9.9')) {
            # Service principals arent supported from 0.9.9 and greater in the Azure module.
            try {
                Write-Host "##[command]Add-AzureAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential"
                $null = Add-AzureAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
            }

            Set-CurrentAzureSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -StorageAccount $StorageAccount
        } elseif ($script:isClassic) {
            # Throw if >=0.9.9 Azure.
            throw (Get-VstsLocString -Key "AZ_ServicePrincipalAuthNotSupportedAzureVersion0" -ArgumentList $script:classicVersion)
        } else {
            # Else, this is AzureRM.
            try {
                Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential"
                $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential
            } catch {
                # Provide an additional, custom, credentials-related error message.
                Write-VstsTaskError -Message $_.Exception.Message
                throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
            }

            Set-CurrentAzureRMSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }
    } else {
        throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
    }
}

function Set-CurrentAzureSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$StorageAccount)

    $additional = @{ }
    if ($script:isClassic -and $script:classicVersion -lt ([version]'0.8.15')) {
        $additional['Default'] = $true # The Default switch is required prior to 0.8.15.
    }

    Write-Host "##[command]Select-AzureSubscription -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Select-AzureSubscription -SubscriptionId $SubscriptionId @additional
    if ($StorageAccount) {
        Write-Host "##[command]Set-AzureSubscription -SubscriptionId $SubscriptionId -CurrentStorageAccountName $StorageAccount"
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
    Write-Host "##[command]Select-AzureRMSubscription -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Select-AzureRMSubscription -SubscriptionId $SubscriptionId @additional
}

function Format-Splat {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Hashtable)

    # Collect the parameters (names and values) in an array.
    $parameters = foreach ($key in $Hashtable.Keys) {
        $value = $Hashtable[$key]
        # If the value is a bool, format the parameter as a switch (ending with ':').
        if ($value -is [bool]) { "-$($key):" } else { "-$key" }
        $value
    }

    $OFS = " "
    "$parameters" # String join the array.
}