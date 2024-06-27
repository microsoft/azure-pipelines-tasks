$featureFlags = @{
    retireAzureRM  = [System.Convert]::ToBoolean($env:RETIRE_AZURERM_POWERSHELL_MODULE)
}

# Dot source Utility functions.
. $PSScriptRoot/Utility.ps1

function Initialize-AzModule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string] $connectedServiceNameARM,
        [Parameter(Mandatory=$false)]
        [string] $azVersion,
        [Parameter(Mandatory = $false)]
        [bool] $isPSCore,
        [Parameter(Mandatory=$false)]
        [Security.SecureString]$encryptedToken
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
        Write-Verbose "Importing Az Modules."
        
        if ($featureFlags.retireAzureRM) {
            $azAccountsVersion = Import-AzAccountsModule -azVersion $azVersion
            
            # Update-AzConfig is a part of Az.Accounts
            if (Get-Command Update-AzConfig -ErrorAction SilentlyContinue) {
                Write-Verbose "Supressing breaking changes warnings of Az module."
                Write-Host "##[command]Update-AzConfig -DisplayBreakingChangeWarning $false -AppliesTo Az"
                Update-AzConfig -DisplayBreakingChangeWarning $false -AppliesTo Az
            } else {
                Write-Verbose "Update-AzConfig cmdlet is not available."
            }

            # Enable-AzureRmAlias for azureRm compability
            if (Get-Command Enable-AzureRmAlias -ErrorAction SilentlyContinue) {
                Write-Verbose "Enable-AzureRmAlias for backward compability"
                Write-Host "##[command]Enable-AzureRmAlias -Scope Process"
                Enable-AzureRmAlias -Scope Process
            } else {
                Write-Verbose "Enable-AzureRmAlias cmdlet is not available."
            }

        } else  {
            # We are only looking for Az.Accounts module becasue all the command required for initialize the azure PS session is in Az.Accounts module.
            $azAccountsVersion = Import-AzAccountsModule -azVersion $azVersion
            Write-VstsTaskWarning -Message (Get-VstsLocString -Key AZ_RMDeprecationMessage) -AsOutput 
        }

        $azAccountsVersion = [System.Version]::new(
            $azAccountsVersion.Major, 
            $azAccountsVersion.Minor, 
            $azAccountsVersion.Build
        )

        Write-Verbose "Initializing Az Subscription."
        $initializeAzSubscriptionParams = @{
            Endpoint = $Endpoint
            connectedServiceNameARM = $connectedServiceNameARM
            vstsAccessToken = $encryptedToken
            azAccountsModuleVersion = $azAccountsVersion
            isPSCore = $isPSCore
        }
        Initialize-AzSubscription @initializeAzSubscriptionParams
    }
    finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

# Not used, keep now in case if we need to revert back to the old implementation.
function Initialize-AzModules {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [PSCustomObject[]] $RequiredAzModules = (Get-RequiredAzModules),
        
        [Parameter()]
        [switch] $TryInstallModule
    )
    Trace-VstsEnteringInvocation $MyInvocation

    try {
        $azAccountsVersion = $null;
        foreach ($RequiredAzModule in $RequiredAzModules) {
            $ModuleVersion = Import-SpecificAzModule -ModuleToImport $RequiredAzModule -TryInstallModule:$TryInstallModule;
            Write-Verbose "$($RequiredAzModule.Name) is available with version $ModuleVersion."
            
            if ($RequiredAzModule.Name -eq 'Az.Accounts') {
                $azAccountsVersion = $ModuleVersion;

                # Update-AzConfig is a part of Az.Accounts
                if (Get-Command Update-AzConfig -ErrorAction SilentlyContinue) {
                    Write-Verbose "Supressing breaking changes warnings of Az module."
                    Write-Host "##[command]Update-AzConfig -DisplayBreakingChangeWarning $false -AppliesTo Az"
                    Update-AzConfig -DisplayBreakingChangeWarning $false -AppliesTo Az
                } else {
                    Write-Verbose "Update-AzConfig cmdlet is not available."
                }

                # Enable-AzureRmAlias for azureRm compability
                if (Get-Command Enable-AzureRmAlias -ErrorAction SilentlyContinue) {
                    Write-Verbose "Enable-AzureRmAlias for backward compability"
                    Write-Host "##[command]Enable-AzureRmAlias -Scope Process"
                    Enable-AzureRmAlias -Scope Process
                } else {
                    Write-Verbose "Enable-AzureRmAlias cmdlet is not available."
                }
            }
        }
        
        return $azAccountsVersion
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-SpecificAzModule {
    [OutputType([System.Version])]
    [CmdletBinding()]
    [OutputType([version])]
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject[]]$ModuleToImport, 
        
        [Parameter()]
        [switch]$TryInstallModule
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Attempting to find the latest available version of module $($ModuleToImport.Name)."
        $RequiredModule = Get-Module -Name $ModuleToImport.Name -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

        if ($RequiredModule -and ($RequiredModule.Version.Major -ge $ModuleToImport.Major)) {
            Write-Verbose "Module $($ModuleToImport.Name) version $($RequiredModule.Version) was found."
        } elseif ($TryInstallModule -eq $true) {
            Write-Verbose "Unable to find module $($ModuleToImport.Name) from the module path. Installing $($ModuleToImport.Name) module."

            Write-Host "##[command]Install-Module -Name $($ModuleToImport.Name) -RequiredVersion $($ModuleToImport.Version) -Force -AllowClobber -ErrorAction Stop -SkipPublisherCheck"
            Install-Module -Name $ModuleToImport.Name -RequiredVersion $ModuleToImport.Version -Force -AllowClobber -ErrorAction Stop -SkipPublisherCheck
            $AvaiableModules = Get-Module -Name $ModuleToImport.Name -ListAvailable;
            
            foreach ($AvaiableModule in $AvaiableModules) {
                if ($AvaiableModule.Version -eq $ModuleToImport.Version) {
                    $RequiredModule = $AvaiableModule;
                    break;
                }
            }
        }

        if (-not $RequiredModule -or ($RequiredModule.Version.Major -lt $ModuleToImport.Major) ) {
            Write-Verbose "Failed to find the required module $($RequiredModule). $($RequiredModule.Version.Major). $($ModuleToImport.Major)"
            throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $ModuleToImport.Major, $ModuleToImport.Name)
        }

        Write-Host "##[command]Import-Module -Name $($ModuleToImport.Name) -Global -PassThru -Force -RequiredVersion $($RequiredModule.Version)"
        $RequiredModule = Import-Module -Name $ModuleToImport.Name -Global -PassThru -Force -RequiredVersion $RequiredModule.Version
        Write-Host("Imported module $($ModuleToImport.Name), version: $($RequiredModule.Version)")

        return $RequiredModule.Version
    }
    catch {
        Write-Verbose "Import-SpecificAzModule: Failed to import module $($ModuleToImport.Name)."
        throw
    }
    finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Import-AzAccountsModule {
    [CmdletBinding()]
    param([string] $azVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # We are only looking for Az.Accounts module becasue all the command required for initialize the azure PS session is in Az.Accounts module.
        $moduleName = "Az.Accounts"
        
        # Attempt to resolve the module.
        Write-Verbose "Attempting to find the module '$moduleName' from the module path."

        if ($azVersion -eq "") {
            $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
        }
        else {
            $modules = Get-Module -Name $moduleName -ListAvailable
            foreach ($moduleVal in $modules) {
                # $moduleVal.Path will have value like C:\Program Files\WindowsPowerShell\Modules\Az.Accounts\1.2.1\Az.Accounts.psd1
                $azModulePath = Split-Path (Split-Path (Split-Path $moduleVal.Path -Parent) -Parent) -Parent
                $azModulePath = $azModulePath + "\Az\*"
                $azModuleVersion = split-path -path $azModulePath -Leaf -Resolve
                if ($azModuleVersion -eq $azVersion) {
                    $module = $moduleVal
                    break
                }
            }
        }

        Write-Verbose "Check Az.Accounts module availability."
        Get-Module -Name $moduleName -ListAvailable

        # Install Az if not found
        if (!$module) {
            Write-Verbose "No module found with name: $moduleName"
            throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $azVersion, "Az.Accounts")
        }

        # Import the module.
        Write-Host "##[command]Import-Module -Name $($module.Path) -Global"
        $module = Import-Module -Name $module.Path -Global -PassThru -Force
        Write-Verbose "Imported module version: $($module.Version)"
        return $module.Version
    }
    finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Initialize-AzSubscription {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        $Endpoint,
        [Parameter(Mandatory=$false)]
        [string] $connectedServiceNameARM,
        [Parameter(Mandatory=$false)]
        [Security.SecureString] $vstsAccessToken,
        [Parameter(Mandatory=$false)]
        [Version] $azAccountsModuleVersion,
        [Parameter(Mandatory=$false)]
        [bool] $isPSCore
    )

    #Set UserAgent for Azure Calls
    Set-UserAgent

    $environmentName = "AzureCloud"
    if ($Endpoint.Data.Environment) {
        $environmentName = $Endpoint.Data.Environment
        if($environmentName -eq "AzureStack") {
            Add-AzureStackAzEnvironment -endpoint $Endpoint -name "AzureStack"
        }
    }

    $scopeLevel = "Subscription"
    If (($Endpoint.PSObject.Properties['Data']) -and ($Endpoint.Data.PSObject.Properties['scopeLevel']))
    {
        $scopeLevel = $Endpoint.Data.scopeLevel
    }

    if ($Endpoint.Auth.Scheme -eq 'ServicePrincipal') {
        try {
            Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
            $null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
            Write-Host "##[command]Clear-AzContext -Scope Process"
            $null = Clear-AzContext -Scope Process
            if (Get-Command 'Clear-AzConfig' -errorAction SilentlyContinue) {
                Write-Host "##[command]Clear-AzConfig -DefaultSubscriptionForLogin"
                $null = Clear-AzConfig -DefaultSubscriptionForLogin
            }

            if ($Endpoint.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
                $servicePrincipalCertificate = Add-CertificateForAz -Endpoint $Endpoint

                Retry-Command -Command 'Connect-AzAccount'-Verbose -Args `
                @{
                    Tenant=$Endpoint.Auth.Parameters.TenantId;
                    CertificateThumbprint=$servicePrincipalCertificate.Thumbprint;
                    ApplicationId=$Endpoint.Auth.Parameters.ServicePrincipalId;
                    Environment=$environmentName;
                    ServicePrincipal=$true;
                    Scope='Process';
                    WarningAction='SilentlyContinue';
                }
            }
            else {
                $psCredential = New-Object System.Management.Automation.PSCredential(
                    $Endpoint.Auth.Parameters.ServicePrincipalId,
                    (ConvertTo-SecureString $Endpoint.Auth.Parameters.ServicePrincipalKey -AsPlainText -Force))

                Retry-Command -Command 'Connect-AzAccount' -Verbose -Args `
                @{
                    Tenant=$Endpoint.Auth.Parameters.TenantId;
                    Credential=$psCredential;
                    Environment=$environmentName;
                    ServicePrincipal=$true;
                    Scope='Process';
                    WarningAction='SilentlyContinue';
                } `
                -serviceConnectionId $connectedServiceNameARM
            }
        }
        catch {
            # Provide an additional, custom, credentials-related error message.
            Write-VstsTaskError -Message $_.Exception.Message
            Assert-TlsError -exception $_.Exception
            throw (New-Object System.Exception((Get-VstsLocString -Key AZ_ServicePrincipalError), $_.Exception))
        }

        if ($scopeLevel -eq "Subscription") {
            Set-CurrentAzSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }
    } elseif ($Endpoint.Auth.Scheme -eq 'ManagedServiceIdentity') {
        Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
        $null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
        Write-Host "##[command]Clear-AzContext -Scope Process"
        $null = Clear-AzContext -Scope Process

        Retry-Command -Command 'Connect-AzAccount' -Verbose -Args `
        @{
            Environment=$environmentName;
            Identity=$true;
            Scope='Process';
        }

        if ($scopeLevel -ne "ManagementGroup") {
            Set-CurrentAzSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }
    } elseif ($Endpoint.Auth.Scheme -eq 'WorkloadIdentityFederation') {
        $clientAssertionJwt = Get-VstsFederatedToken -serviceConnectionId $connectedServiceNameARM -vstsAccessToken $vstsAccessToken `
            -azAccountsModuleVersion $azAccountsModuleVersion -isPSCore $isPSCore

        Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
        $null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
        Write-Host "##[command]Clear-AzContext -Scope Process"
        $null = Clear-AzContext -Scope Process

        Retry-Command -Command 'Connect-AzAccount' -Verbose -Args `
        @{
            ServicePrincipal=$true;
            Tenant=$Endpoint.Auth.Parameters.TenantId;
            ApplicationId=$Endpoint.Auth.Parameters.ServicePrincipalId;
            FederatedToken=$clientAssertionJwt;
            Environment=$environmentName;
            Scope='Process';
        }

        if ($scopeLevel -ne "ManagementGroup") {
            Set-CurrentAzSubscription -SubscriptionId $Endpoint.Data.SubscriptionId -TenantId $Endpoint.Auth.Parameters.TenantId
        }
    } else {
        Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
        $null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
        Write-Host "##[command]Clear-AzContext -Scope Process"
        $null = Clear-AzContext -Scope Process
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
    if ($null -ne $armEnv) {
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

    Retry-Command -Command 'Set-AzContext' -Verbose -Args `
    @{
        SubscriptionId=$SubscriptionId;
    }
}

function Retry-Command {
    param(
        [Parameter(Mandatory=$true)][string]$command,
        [Parameter(Mandatory=$true)][hashtable]$args,
        [Parameter(Mandatory=$false)][string]$serviceConnectionId,
        [Parameter(Mandatory=$false)][int]$retries=5,
        [Parameter(Mandatory=$false)][int]$secondsDelay=5
    )

    $retryCount = 0
    $completed = $false

    while(-not $completed) {
        try {
            Write-Host "##[command]$command $($args.GetEnumerator() | where-object { $_.key -ne "FederatedToken"} | out-string)"
            & $command @args
            Write-Verbose("Command [{0}] succeeded." -f $command)
            $completed = $true
        } catch {
            if ($retryCount -ge $retries) {
                Write-Verbose("Command [{0}] failed the maximum number of {1} times." -f $command, $retryCount)
                                
                $expiredSecretErrorCode = "AADSTS7000222"
                if ($_.Exception.Message -match $expiredSecretErrorCode) {

                    $organizationURL = $Env:System_CollectionUri
                    $projectName = $Env:System_TeamProject
                    $serviceConnectionLink = [uri]::EscapeUriString("$organizationURL$projectName/_settings/adminservices?resourceId=$serviceConnectionId")
                    throw (Get-VstsLocString -Key AZ_ExpiredServicePrincipalMessageWithLink -ArgumentList $serviceConnectionLink)
                } else {
                    throw
                }
            } else {
                $secondsDelay = [math]::Pow(2, $retryCount)
                Write-Verbose("Command [{0}] failed. Retrying in {1} seconds." -f $command, $secondsDelay)
                Start-Sleep $secondsDelay
                $retryCount++
            }
        }
    }
}

function Get-RequiredAzModules {
    [CmdletBinding()]
    [OutputType([PSCustomObject[]])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string] $AzAccounts = '2.19.0',
        
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string] $AzResources = '6.15.1',

        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string] $AzStorage = '6.1.1'
    )

    [PSCustomObject]@{
        Name    = 'Az.Accounts'
        Version = $AzAccounts
        Major   = 2
    }

    [PSCustomObject]@{
        Name    = 'Az.Resources'
        Version = $AzResources
        Major   = 4
    }

    [PSCustomObject]@{
        Name    = 'Az.Storage'
        Version = $AzStorage
        Major   = 3
    }
}