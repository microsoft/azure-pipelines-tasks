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

. "$PSScriptRoot/Utility.ps1"
Update-PSModulePathForHostedAgentLinux -targetAzurePs $targetAzurePs

if($targetAzurePs -eq ""){
    $module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
}
else{
    $modules = Get-Module -Name $moduleName -ListAvailable
    foreach ($moduleVal in $modules) {
        # $moduleVal.Path will have value like /usr/local/share/powershell/Modules/Az.Accounts/1.2.1/Az.Accounts.psd1
        $azModulePath = Split-Path (Split-Path (Split-Path $moduleVal.Path -Parent) -Parent) -Parent
        $azModulePath = $azModulePath + "/Az/*"
        $azModuleVersion = split-path -path $azModulePath -Leaf -Resolve
        if($azModuleVersion -eq $targetAzurePs) {
            $module = $moduleVal
            break
        }   
    }
}
      
if (!$module) {
    # Will handle localization later
    Write-Verbose "No module found with name: $moduleName"
    throw ("Could not find the module Az.Accounts with given version. If the module was recently installed, retry after restarting the Azure Pipelines task agent.")
}

# Import the module.
Write-Host "##[command]Import-Module -Name $($module.Path) -Global"
$module = Import-Module -Name $module.Path -Global -PassThru -Force

# Clear context
Write-Host "##[command]Clear-AzContext -Scope Process"
$null = Clear-AzContext -Scope Process
Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
$null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue 

if ($endpointObject.scheme -eq 'ServicePrincipal') {
    try {
        if ($endpointObject.authenticationType -ieq 'SPNKey') {
            $psCredential = New-Object System.Management.Automation.PSCredential(
                    $endpointObject.servicePrincipalClientID,
                    (ConvertTo-SecureString $endpointObject.servicePrincipalKey -AsPlainText -Force))
            Write-Host "##[command]Connect-AzAccount -ServicePrincipal -Tenant $($endpointObject.tenantId) -Credential $psCredential -Environment $environmentName"
            $null = Connect-AzAccount -ServicePrincipal -Tenant $endpointObject.tenantId `
            -Credential $psCredential `
            -Environment $environmentName -WarningAction SilentlyContinue
        }
        else {
            # Provide an additional, custom, credentials-related error message. Will handle localization later
            throw ("Only SPN credential auth scheme is supported for non windows agent.") 
        }
    }
    catch {
        # Provide an additional, custom, credentials-related error message. Will handle localization later
        throw (New-Object System.Exception("There was an error with the service principal used for the deployment.", $_.Exception))
       
    }
}
else {
    #  Provide an additional, custom, credentials-related error message. Will handle localization later
    throw ("Only SPN credential auth scheme is supported for non windows agent.")
}