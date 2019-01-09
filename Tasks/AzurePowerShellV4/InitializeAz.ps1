[CmdletBinding()]
param
(
    [String] [Parameter(Mandatory = $false)]
    $targetAzurePs,

    [String] [Parameter(Mandatory = $true)]
    $serviceName,

    [String] [Parameter(Mandatory = $true)]
    $endpoint
)

$endpointObject =  ConvertFrom-Json  $endpoint
$moduleName = "Az.Accounts"
$module = Get-Module -Name $moduleName -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
$module = Import-Module -Name $module.Path -Global -PassThru -Force
$environmentName = $endpointObject.environment

# Clear context
Write-Host "##[command]Clear-AzContext -Scope Process"
$null = Clear-AzContext -Scope Process
Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
$null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue 

if ($endpointObject.scheme -eq 'ServicePrincipal') {
    try {
        if ($endpointObject.authenticationType -ne 'SPNCertificate') {
            $psCredential = New-Object System.Management.Automation.PSCredential(
                    $endpointObject.servicePrincipalClientID,
                    (ConvertTo-SecureString $endpointObject.servicePrincipalKey -AsPlainText -Force))
            Write-Host "##[command]Connect-AzAccount -ServicePrincipal -Tenant $($endpointObject.tenantId) -Credential $psCredential -Environment $environmentName"
            $null = Connect-AzAccount -ServicePrincipal -Tenant $endpointObject.tenantId `
            -Credential $psCredential `
            -Environment $environmentName -WarningAction SilentlyContinue
        }
    }
    catch {
        # Provide an additional, custom, credentials-related error message. Will handle localization later
        throw ("Only support SPN credentials cross platform for now in Azure PowerShell")
    }
}
else {
    #  Provide an additional, custom, credentials-related error message. Will handle localization later
    throw ("Only support SPN credentials cross platform for now in Azure PowerShell")
}