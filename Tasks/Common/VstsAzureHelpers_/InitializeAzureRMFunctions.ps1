# Dot source Utility functions.
. $PSScriptRoot/Utility.ps1

function Initialize-AzureRMModule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
        if (!(Import-AzureRMModule))
        {
            throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList "Any version", "AzureRM")
        }

        Initialize-AzureRMSubscription -Endpoint $Endpoint
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-AzureRMModule {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $moduleName = "AzureRM"
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

        # The AzureRM module was imported.
        # Validate the AzureRM.profile module can be found.
        # First check whether or not profile module is already loaded in the current session
        $profileModule = Get-Module -Name AzureRm.Profile
        if(!$profileModule) {
            # otherwise check whether it is listed as a nested module in the azurerm module manifest ( this is valid till v 5.3.0 )
            $profileModule = (Get-Module -Name AzureRM).NestedModules | Where-Object { $_.Name.toLower() -eq "azurerm.profile" }
            # otherwise check whether it is listed as a required module in the azurerm module manifest ( valid from v 5.4.0 and up )
            if(!$profileModule) {
                $profileModule = (Get-Module -Name AzureRM).RequiredModules | Where-Object { $_.Name.toLower() -eq "azurerm.profile" }
            }
            if (!$profileModule) {
                throw (Get-VstsLocString -Key AZ_AzureRMProfileModuleNotFound)
            }
            # Import and then store the AzureRM.profile module.
            Write-Host "##[command]Import-Module -Name $($profileModule.Path) -Global"
            $profileModule = Import-Module -Name $profileModule.Path -Global -PassThru -Force
        }

        Write-Verbose "Imported module version: $($profileModule.Version)"

        return $true
     }finally {
        Trace-VstsLeavingInvocation $MyInvocation
     }
}

function Initialize-AzureRMSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint)

    #Set UserAgent for Azure Calls
    Set-UserAgent
    
    # Clear context
    if ($Endpoint.Auth.Scheme -eq 'ServicePrincipal' -and (Get-Command -Name "Clear-AzureRmContext" -ErrorAction "SilentlyContinue")) {
        Write-Host "##[command]Clear-AzureRmContext -Scope Process"
        $null = Clear-AzureRmContext -Scope Process
        Write-Host "##[command]Clear-AzureRmContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
        $null = Clear-AzureRmContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
    }

    $environmentName = "AzureCloud"
    if($Endpoint.Data.Environment) {
        $environmentName = $Endpoint.Data.Environment
        if($environmentName -eq "AzureStack")
        {
            Add-AzureStackAzureRmEnvironment -endpoint $Endpoint -name "AzureStack"
        }
    }
    
    $scopeLevel = "Subscription"
    
    If ($Endpoint.PSObject.Properties['Data'])
    {
        If ($Endpoint.Data.PSObject.Properties['scopeLevel'])
        {
            $scopeLevel = $Endpoint.Data.scopeLevel
        }
    }

    if ($Endpoint.Auth.Scheme -eq 'ServicePrincipal') {
        
        if ($Endpoint.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
            $servicePrincipalCertificate = Add-Certificate -Endpoint $Endpoint -ServicePrincipal
        }
        else {
            $psCredential = New-Object System.Management.Automation.PSCredential(
                $Endpoint.Auth.Parameters.ServicePrincipalId,
                (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))
        }

        try {
            if (Get-Command -Name "Add-AzureRmAccount" -ErrorAction "SilentlyContinue") {                    
                if (CmdletHasMember -cmdlet "Add-AzureRMAccount" -memberName "EnvironmentName") {
                        
                    if ($Endpoint.Auth.Parameters.AuthenticationType -eq "SPNCertificate") {
                        Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -EnvironmentName $environmentName"
                        $null = Add-AzureRmAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -CertificateThumbprint $servicePrincipalCertificate.Thumbprint -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId -EnvironmentName $environmentName
                    }
                    else {
                        Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -EnvironmentName $environmentName"
                        $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -EnvironmentName $environmentName
                    }
                }
                else {
                    if ($Endpoint.Auth.Parameters.AuthenticationType -eq "SPNCertificate") {
                        Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -Environment $environmentName"
                        $null = Add-AzureRmAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -CertificateThumbprint $servicePrincipalCertificate.Thumbprint -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId -Environment $environmentName
                    }
                    else {
                        Write-Host "##[command]Add-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -Environment $environmentName"
                        $null = Add-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -Environment $environmentName
                    }
                }
            }
            else {
                if ($Endpoint.Auth.Parameters.AuthenticationType -eq "SPNCertificate") {
                    Write-Host "##[command]Connect-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -Environment $environmentName"
                    $null = Connect-AzureRmAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -CertificateThumbprint $servicePrincipalCertificate.Thumbprint -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId -Environment $environmentName
                }
                else {
                    Write-Host "##[command]Connect-AzureRMAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -Environment $environmentName"
                    $null = Connect-AzureRMAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId -Credential $psCredential -Environment $environmentName
                }
            }
        } 
        catch {
            # Provide an additional, custom, credentials-related error message.
            Write-VstsTaskError -Message $_.Exception.Message
            Assert-TlsError -exception $_.Exception
            throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
        }
            
        if($scopeLevel -eq "Subscription")
        {
            Set-CurrentAzureRMSubscriptionV2 -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }

    } elseif ($Endpoint.Auth.Scheme -eq 'ManagedServiceIdentity') {
        $accountId = $env:BUILD_BUILDID 
        if($env:RELEASE_RELEASEID){
            $accountId = $env:RELEASE_RELEASEID 
        }
        $date = Get-Date -Format o
        $accountId = -join($accountId, "-", $date)
        $access_token = Get-MsiAccessToken $Endpoint
        try {
            Write-Host "##[command]Add-AzureRmAccount  -AccessToken ****** -AccountId $accountId "
            $null = Add-AzureRmAccount -AccessToken $access_token -AccountId $accountId
        } catch {
            # Provide an additional, custom, credentials-related error message.
            Write-VstsTaskError -Message $_.Exception.Message
            throw (New-Object System.Exception((Get-VstsLocString -Key AZ_MsiFailure), $_.Exception))
        }
        
        Set-CurrentAzureRMSubscriptionV2 -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
    }else {
        throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
    } 
}

function Set-CurrentAzureRMSubscriptionV2 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$TenantId)

    $additional = @{ }
    if ($TenantId) { $additional['TenantId'] = $TenantId }

    Write-Host "##[command] Set-AzureRmContext -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Set-AzureRmContext -SubscriptionId $SubscriptionId @additional
}

