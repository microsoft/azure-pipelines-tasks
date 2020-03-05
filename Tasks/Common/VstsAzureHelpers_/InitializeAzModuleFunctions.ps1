# Dot source Utility functions.
. $PSScriptRoot/Utility.ps1

function Initialize-AzModule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [string] $azVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
        Import-AzModule -azVersion $azVersion

        Write-Verbose "Initializing Az Module."
        Initialize-AzSubscription -Endpoint $Endpoint
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-AzModule {
    [CmdletBinding()]
    param([string] $azVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # We are only looking for Az.Accounts module becasue all the command required for initialize the azure PS session is in Az.Accounts module.
        $moduleName = "Az.Accounts"
        # Attempt to resolve the module.
        Write-Verbose "Attempting to find the module '$moduleName' from the module path."
        
        if($azVersion -eq ""){
            $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
        }
        else{
            $modules = Get-Module -Name $moduleName -ListAvailable
            foreach ($moduleVal in $modules) {
                # $moduleVal.Path will have value like C:\Program Files\WindowsPowerShell\Modules\Az.Accounts\1.2.1\Az.Accounts.psd1
                $azModulePath = Split-Path (Split-Path (Split-Path $moduleVal.Path -Parent) -Parent) -Parent
                $azModulePath = $azModulePath + "\Az\*"
                $azModuleVersion = split-path -path $azModulePath -Leaf -Resolve
                if($azModuleVersion -eq $azVersion) {
                    $module = $moduleVal
                    break
                }   
            }
        }
      
        if (!$module) {
            Write-Verbose "No module found with name: $moduleName"
            throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $azVersion, "Az.Accounts")
        }

        # Import the module.
        Write-Host "##[command]Import-Module -Name $($module.Path) -Global"
        $module = Import-Module -Name $module.Path -Global -PassThru -Force
        Write-Verbose "Imported module version: $($module.Version)"
     } finally {
        Trace-VstsLeavingInvocation $MyInvocation
     }
}

function Initialize-AzSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint)

    #Set UserAgent for Azure Calls
    Set-UserAgent
    
    # Clear context
    Write-Host "##[command]Clear-AzContext -Scope Process"
    $null = Clear-AzContext -Scope Process
    Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
    $null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue

    $environmentName = "AzureCloud"
    if($Endpoint.Data.Environment) {
        $environmentName = $Endpoint.Data.Environment
        if($environmentName -eq "AzureStack")
        {
            Add-AzureStackAzEnvironment -endpoint $Endpoint -name "AzureStack"
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
        try {
            if ($Endpoint.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
                $servicePrincipalCertificate = Add-CertificateForAz -Endpoint $Endpoint

                Write-Host "##[command]Connect-AzAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -CertificateThumbprint ****** -ApplicationId $($Endpoint.Auth.Parameters.ServicePrincipalId) -Environment $environmentName"
                $null = Connect-AzAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId `
                -CertificateThumbprint $servicePrincipalCertificate.Thumbprint `
                -ApplicationId $Endpoint.Auth.Parameters.ServicePrincipalId `
                -Environment $environmentName -WarningAction SilentlyContinue
            }
            else {
                $psCredential = New-Object System.Management.Automation.PSCredential(
                    $Endpoint.Auth.Parameters.ServicePrincipalId,
                    (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))

                Write-Host "##[command]Connect-AzAccount -ServicePrincipal -Tenant $($Endpoint.Auth.Parameters.TenantId) -Credential $psCredential -Environment $environmentName"
                $null = Connect-AzAccount -ServicePrincipal -Tenant $Endpoint.Auth.Parameters.TenantId `
                -Credential $psCredential `
                -Environment $environmentName -WarningAction SilentlyContinue
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
            Set-CurrentAzSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
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
            Write-Host "##[command]Add-AzAccount  -AccessToken ****** -AccountId $accountId "
            $null = Add-AzAccount -AccessToken $access_token -AccountId $accountId
        } catch {
            # Provide an additional, custom, credentials-related error message.
            Write-VstsTaskError -Message $_.Exception.Message
            throw (New-Object System.Exception((Get-VstsLocString -Key AZ_MsiFailure), $_.Exception))
        }
        
        Set-CurrentAzSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
    } else {
        throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $Endpoint.Auth.Scheme)
    } 
}

function Add-AzureStackAzEnvironment {
    param (
        [Parameter(mandatory=$true, HelpMessage="The Admin ARM endpoint of the Azure Stack Environment")]
        $Endpoint,
        [parameter(mandatory=$true, HelpMessage="Azure Stack environment name for use with Az commandlets")]
        [string] $Name
    )

    $azureEnvironmentParams = Get-AzureStackEnvironment -endpoint $Endpoint -name $Name

    $armEnv = Get-AzEnvironment -Name $name
    if($armEnv -ne $null) {
        Write-Verbose "Updating Az environment $name" -Verbose
        Remove-AzEnvironment -Name $name | Out-Null       
    }
    else {
        Write-Verbose "Adding Az environment $name" -Verbose
    }

    try {
        return Add-AzEnvironment @azureEnvironmentParams
    }
    catch {
        Assert-TlsError -exception $_.Exception
        throw
    }
}

function Set-CurrentAzSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$SubscriptionId,
        [string]$TenantId)

    $additional = @{ TenantId = $TenantId }

    Write-Host "##[command] Set-AzContext -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Set-AzContext -SubscriptionId $SubscriptionId @additional
}