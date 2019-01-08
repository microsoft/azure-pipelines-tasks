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

$psCredential = New-Object System.Management.Automation.PSCredential(
                    $endpointObject.servicePrincipalClientID,
                    (ConvertTo-SecureString $endpointObject.servicePrincipalKey -AsPlainText -Force))

$null = Connect-AzAccount -ServicePrincipal -Tenant $endpointObject.tenantId `
        -Credential $psCredential `
        -Environment $environmentName -WarningAction SilentlyContinue