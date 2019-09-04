[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $true)]
    $endpoint,

    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs
)

$endpointObject =  ConvertFrom-Json  $endpoint
$moduleName = "Az.Accounts"
$environmentName = $endpointObject.environment

$azureRMModulePath = "C:\Modules\azurerm_2.1.0"
$azureModulePath = "C:\Modules\azure_2.1.0"
$azPSModulePath = $env:PSModulePath

if ($azPSModulePath.split(";") -contains $azureRMModulePath) {
    $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
    write-host "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-host "$azureRMModulePath is not present in $azPSModulePath"
}

if ($azPSModulePath.split(";") -contains $azureModulePath) {
    $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
    write-host "$azureModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-host "$azureModulePath is not present in $azPSModulePath"
}

$env:PSModulePath = $azPSModulePath

. "$PSScriptRoot/Utility.ps1"
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs

Write-Verbose "Env:PSModulePath: '$env:PSMODULEPATH'"
# We are only looking for Az.Accounts module becasue all the command required for initialize the azure PS session is in Az.Accounts module.
$moduleName = "Az.Accounts"
# Attempt to resolve the module.
Write-Verbose "Attempting to find the module '$moduleName' from the module path."
        
if($targetAzurePs -eq ""){
    $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
}
else{
    $modules = Get-Module -Name $moduleName -ListAvailable
    foreach ($moduleVal in $modules) {
        # $moduleVal.Path will have value like C:\Program Files\WindowsPowerShell\Modules\Az.Accounts\1.2.1\Az.Accounts.psd1
        $azModulePath = Split-Path (Split-Path (Split-Path $moduleVal.Path -Parent) -Parent) -Parent
        $azModulePath = $azModulePath + "\Az\*"
        $azModuleVersion = split-path -path $azModulePath -Leaf -Resolve
        if($azModuleVersion -eq $targetAzurePs) {
            $module = $moduleVal
            break
        }   
    }
}
      
if (!$module) {
    Write-Verbose "No module found with name: $moduleName"
    throw ("Could not find the module Az.Accounts with given version. If the module was recently installed, retry after restarting the Azure Pipelines task agent.")
}

# Import the module.
Write-Host "##[command]Import-Module -Name $($module.Path) -Global"
$module = Import-Module -Name $module.Path -Global -PassThru -Force
Write-Verbose "Imported module version: $($module.Version)"

# Clear context
Write-Host "##[command]Clear-AzContext -Scope Process"
$null = Clear-AzContext -Scope Process
Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
$null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue

$environmentName = "AzureCloud"
if($endpointObject.environment) {
    $environmentName = $endpointObject.environment
    if($environmentName -eq "AzureStack")
    {
        Add-AzureStackAzEnvironment -endpoint $endpointObject -name "AzureStack"
    }
}

$scopeLevel = "Subscription"
    
If ($endpointObject.scopeLevel)
{
    $scopeLevel = $endpointObject.scopeLevel
}

if ($endpointObject.scheme -eq 'ServicePrincipal') {
    try {
        if ($endpointObject.authenticationType -eq 'SPNCertificate') {
            $servicePrincipalCertificate = Add-Certificate -Endpoint $Endpoint -ServicePrincipal

            Write-Host "##[command]Connect-AzAccount -ServicePrincipal -Tenant $($endpointObject.tenantId) -CertificateThumbprint ****** -ApplicationId $($endpointObject.servicePrincipalClientId) -Environment $environmentName"
            $null = Connect-AzAccount -ServicePrincipal -Tenant $endpointObject.tenantId `
            -CertificateThumbprint $servicePrincipalCertificate.Thumbprint `
            -ApplicationId $endpointObject.servicePrincipalClientId `
            -Environment $environmentName -WarningAction SilentlyContinue
        }
        else {
            $psCredential = New-Object System.Management.Automation.PSCredential(
                $endpointObject.servicePrincipalClientId,
                (ConvertTo-SecureString $endpointObject.servicePrincipalKey -AsPlainText -Force))

            Write-Host "##[command]Connect-AzAccount -ServicePrincipal -Tenant $($endpointObject.tenantId) -Credential $psCredential -Environment $environmentName"
            $null = Connect-AzAccount -ServicePrincipal -Tenant $endpointObject.tenantId `
            -Credential $psCredential `
            -Environment $environmentName -WarningAction SilentlyContinue
        }
    } 
    catch {
        # Provide an additional, custom, credentials-related error message.
        Write-Host "Exception is : $($_.Exception.Message)"
        throw (New-Object System.Exception("There was an error with the service principal used for the deployment.", $_.Exception))
    }
            
    if($scopeLevel -eq "Subscription")
    {
	    $SubscriptionId = $endpointObject.subscriptionId
        $TenantId = $endpointObject.tenantId
        $additional = @{ TenantId = $TenantId }
        Write-Host "##[command] Set-AzContext -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
        $null = Set-AzContext -SubscriptionId $SubscriptionId @additional
    }
}
elseif ($endpointObject.scheme -eq 'ManagedServiceIdentity') {
    $accountId = $env:BUILD_BUILDID 
    if($env:RELEASE_RELEASEID){
        $accountId = $env:RELEASE_RELEASEID 
    }
    $date = Get-Date -Format o
    $accountId = -join($accountId, "-", $date)
    $access_token = Get-MsiAccessToken $endpointObject
    try {
        Write-Host "##[command]Add-AzAccount  -AccessToken ****** -AccountId $accountId "
        $null = Add-AzAccount -AccessToken $access_token -AccountId $accountId
    } catch {
        # Provide an additional, custom, credentials-related error message.
        Write-Host "Exception is : $($_.Exception.Message)"
        throw (New-Object System.Exception("Could not fetch access token for Managed Identity.", $_.Exception))
    }
        
    $SubscriptionId = $endpointObject.subscriptionId
    $TenantId = $endpointObject.tenantId
    $additional = @{ TenantId = $TenantId }
    Write-Host "##[command] Set-AzContext -SubscriptionId $SubscriptionId $(Format-Splat $additional)"
    $null = Set-AzContext -SubscriptionId $SubscriptionId @additional
}
else {
    throw ("Unsupported authentication scheme for Azure endpoint.")
}