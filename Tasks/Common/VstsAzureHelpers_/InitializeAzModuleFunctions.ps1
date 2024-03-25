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
            $azAccountsModuleName = "Az.Accounts"
            $azAccountsVersion = Import-SpecificAzModule -moduleName $azAccountsModuleName
            Write-Verbose "'$azAccountsModuleName' is available with version $azAccountsVersion."

            if (Get-Command Update-AzConfig -ErrorAction SilentlyContinue) {
                Write-Verbose "Supressing breaking changes warnings of '$($azAccountsModuleName)' module."
                Update-AzConfig -DisplayBreakingChangeWarning $false -AppliesTo $azAccountsModuleName
            } else {
                Write-Verbose "Update-AzConfig cmdlet is not available."
            }

            Uninstall-AzureRMModules -UseAzUninstall

            $azResourcesModuleName = "Az.Resources"
            $azResourcesVersion = Import-SpecificAzModule -moduleName $azResourcesModuleName
            Write-Verbose "'$azResourcesModuleName' is available with version $azResourcesVersion."

            $azStorageModuleName = "Az.Storage"
            $azStorageVersion = Import-SpecificAzModule -moduleName $azStorageModuleName
            Write-Verbose "'$azStorageModuleName' is available with version $azStorageVersion."
        }
        else {
            # We are only looking for Az.Accounts module becasue all the command required for initialize the azure PS session is in Az.Accounts module.
            $azAccountsVersion = Import-AzAccountsModule -azVersion $azVersion
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

function Import-SpecificAzModule {
    [OutputType([System.Version])]
    [CmdletBinding()]
    [OutputType([version])]
    param(
        [Parameter(Mandatory=$true)]
        [string]$moduleName
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Write-Verbose "Attempting to find the latest available version of module '$moduleName'."
        # $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

        # if ($module) {
        #     Write-Verbose "Module '$moduleName' version $($module.Version) was found."
        # }
        # else {
        #     Write-Verbose "Unable to find module '$moduleName' from the module path. Installing '$moduleName' module."

        Write-Host "##[command]Install-Module -Name $moduleName -Force -AllowClobber -ErrorAction Stop"
        Install-Module -Name $moduleName -Force -AllowClobber -ErrorAction Stop
        # }

        $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1

        if (-not $module) {
            Write-Warning "Unable to install '$moduleName'."
            throw (Get-VstsLocString -Key AZ_ModuleNotFound -ArgumentList $moduleName)
        }

        Write-Host "##[command]Import-Module -Name $($module.Path) -Global -PassThru -Force"
        $module = (Import-Module -Name $moduleName -Global -PassThru -Force | Sort-Object Version -Descending | Select-Object -First 1)[0]
        Write-Host("Imported module '$moduleName', version: $($module.Version)")

        return $module.Version
    }
    catch {
        Write-Verbose "Import-SpecificAzModule: Failed to import module '$moduleName'."
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

function Uninstall-AzureRMModules {
    [CmdletBinding()]
    param([switch] $UseAzUninstall)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Verbose "Uninstalling AzureRM modules."

        if ($UseAzUninstall -and (Get-Module -ListAvailable -Name Az.Accounts)) {
            Write-Host "##[command]Uninstall-AzureRm"
            Uninstall-AzureRm
        }
        else {
            $azureRmModules = Get-Module -ListAvailable -Name AzureRM.* | Select-Object Name,Version
            if ($azureRmModules -and $azureRmModules.Count -gt 0) {
                Foreach ($azureRmModule in $azureRmModules) {
                    $azureRmModuleName = $azureRmModule.Name
                    Write-Verbose "Uninstalling module: $azureRmModuleName"
                    try {
                        Write-Host "##[command]Uninstall-Module -Name $azureRmModuleName -AllVersions -Force"
                        Uninstall-Module -Name $azureRmModuleName -AllVersions -Force
                    }
                    catch {
                        Write-Verbose "Failed to uninstall module: $azureRmModuleName"
                    }
                }
            }
            else {
                Write-Host "No AzureRM modules found to uninstall."
            }
        }

        Write-Verbose "Making sure all AzureRM modules are gone after the uninstall."

        $azureRmModules = Get-Module -ListAvailable -Name AzureRM.* | Select-Object Name,Version
        if ($azureRmModules) {
            Foreach ($azureRmModule in $azureRmModules) {
                Write-Verbose "'$($azureRmModule)' AzureRM module found."
            }
        }
        else {
            Write-Verbose "No AzureRM modules found."
        }
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
                }
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
        [Parameter(Mandatory=$false)][int]$retries=5,
        [Parameter(Mandatory=$false)][int]$secondsDelay=5
    )

    $retryCount = 0
    $completed = $false

    while(-not $completed) {
        try {
            Write-Host "##[command]$command $args"
            & $command @args
            Write-Verbose("Command [{0}] succeeded." -f $command)
            $completed = $true
        } catch {
            if ($retryCount -ge $retries) {
                Write-Verbose("Command [{0}] failed the maximum number of {1} times." -f $command, $retryCount)
                throw
            } else {
                $secondsDelay = [math]::Pow(2, $retryCount)
                Write-Verbose("Command [{0}] failed. Retrying in {1} seconds." -f $command, $secondsDelay)
                Start-Sleep $secondsDelay
                $retryCount++
            }
        }
    }
}
