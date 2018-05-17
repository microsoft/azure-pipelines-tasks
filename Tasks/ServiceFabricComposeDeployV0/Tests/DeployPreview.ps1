[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$serviceConnectionName = "random connection name"
$composeFilePath = "docker-compose.yml"
$applicationName = "fabric:/Application1"
$serverCertThumbprint = "random thumbprint"
$userName = "random user"
$password = "random password"
$connectionEndpointFullUrl = "https://mycluster.com:19000"
$connectionEndpoint = ([System.Uri]$connectionEndpointFullUrl).Authority

# Setup input arguments
Register-Mock Get-VstsInput { $serviceConnectionName } -Name serviceConnectionName -Require
Register-Mock Get-VstsInput { $composeFilePath } -Name composeFilePath -Require
Register-Mock Get-VstsInput { $applicationName } -Name applicationName -Require
Register-Mock Get-VstsInput { $null } -Name deployTimeoutSec
Register-Mock Get-VstsInput { $null } -Name removeTimeoutSec
Register-Mock Get-VstsInput { $null } -Name getStatusTimeoutSec
Register-Mock Get-VstsInput { "None" } -Name registryCredentials -Require

# Setup file resolution
Register-Mock Find-VstsFiles { $composeFilePath } -- -LegacyPattern $composeFilePath

Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock VSTS service endpoint
$vstsEndpoint = @{
    "url" = $connectionEndpointFullUrl
    "Auth" = @{
        "Scheme" = "UserNamePassword"
        "Parameters" = @{
            "ServerCertThumbprint" = $serverCertThumbprint
            "Username" = $userName
            "Password" = $password
        }
    }
}
Register-Mock Get-VstsEndpoint { $vstsEndpoint } -- -Name $serviceConnectionName -Require

# Setup mock Registry for Service Fabric
$SfRegistry = @{
    "FabricSDKVersion" = "255.255.1.2"
}
Register-Mock Get-ItemProperty { $SfRegistry } -- -Path 'HKLM:\SOFTWARE\Microsoft\Service Fabric SDK\' -ErrorAction SilentlyContinue

# Setup mock results of cluster connection
Register-Mock Connect-ServiceFabricClusterFromServiceEndpoint { } -- -ClusterConnectionParameters @{} -ConnectedServiceEndpoint $vstsEndpoint

$serviceFabricComposeApplicationStatusPaged = @{
    "ApplicationName"        = $applicationName
    "ComposeApplicationStatus"    = "Created"
    "StatusDetails" = ""
}

# Need to store the bool in an object so the lambdas will share the reference
$removed = New-Object 'System.Collections.Generic.Dictionary[string, bool]'
$removed.Value = $true

Register-Mock Get-ServiceFabricComposeApplicationStatusPaged {
    if (($removed.Value -eq $true))
    {
        return $null;
    }
    else
    {
        return $serviceFabricComposeApplicationStatusPaged
    }
} -ApplicationName: $applicationName

Register-Mock Remove-ServiceFabricComposeApplication {
    $removed.Value = $true
} -Force: True -ApplicationName: $applicationName

Register-Mock Test-ServiceFabricApplicationPackage { } -- -ComposeFilePath: $composeFilePath -ErrorAction: Stop

Register-Mock New-ServiceFabricComposeApplication {
    $removed.Value = $false
} -- -Compose: $composeFilePath -ApplicationName: $applicationName

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricComposeDeploy\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricComposeDeploy/ServiceFabricComposeDeploy.ps1 )

# Assert
Assert-WasCalled Get-ServiceFabricComposeApplicationStatusPaged -Times 2
Assert-WasCalled Remove-ServiceFabricComposeApplication -Times 0
Assert-WasCalled New-ServiceFabricComposeApplication -Times 1