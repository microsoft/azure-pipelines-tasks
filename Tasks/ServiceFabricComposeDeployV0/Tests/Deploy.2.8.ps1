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
Register-Mock Get-VstsInput { "false" } -Name upgrade

# Setup file resolution
Register-Mock Find-VstsFiles { $composeFilePath } -- -LegacyPattern $composeFilePath

Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock Azure Pipelines service endpoint
$vstsEndpoint = @{
    "url"  = $connectionEndpointFullUrl
    "Auth" = @{
        "Scheme"     = "UserNamePassword"
        "Parameters" = @{
            "ServerCertThumbprint" = $serverCertThumbprint
            "Username"             = $userName
            "Password"             = $password
        }
    }
}
Register-Mock Get-VstsEndpoint { $vstsEndpoint } -- -Name $serviceConnectionName -Require

# Setup mock Registry for Service Fabric
$SfRegistry = @{
    "FabricSDKVersion" = "2.8.1.2"
}
Register-Mock Get-ItemProperty { $SfRegistry } -- -Path 'HKLM:\SOFTWARE\Microsoft\Service Fabric SDK\' -ErrorAction SilentlyContinue

# Setup mock results of cluster connection
Register-Mock Connect-ServiceFabricClusterFromServiceEndpoint { } -- -ClusterConnectionParameters @{} -ConnectedServiceEndpoint $vstsEndpoint

$serviceFabricComposeDeploymentStatus = @{
    "DeploymentName"          = $applicationName
    "ComposeDeploymentStatus" = "Created"
    "StatusDetails"           = ""
}

# Need to store the bool in an object so the lambdas will share the reference
$removed = New-Object 'System.Collections.Generic.Dictionary[string, bool]'
$removed.Value = $true

Register-Mock Get-ServiceFabricComposeDeploymentStatus {
    if (($removed.Value -eq $true))
    {
        return $null;
    }
    else
    {
        return $serviceFabricComposeDeploymentStatus
    }
} -DeploymentName: $applicationName

Register-Mock Remove-ServiceFabricComposeDeployment {
    $removed.Value = $true
} -Force: True -DeploymentName: $applicationName

Register-Mock Test-ServiceFabricApplicationPackage { } -- -ComposeFilePath: $composeFilePath -ErrorAction: Stop

Register-Mock New-ServiceFabricComposeDeployment {
    $removed.Value = $false
} -- -DeploymentName: $applicationName -Compose: $composeFilePath

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricComposeDeployV0\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricComposeDeployV0/ServiceFabricComposeDeploy.ps1 )

# Assert
Assert-WasCalled Get-ServiceFabricComposeDeploymentStatus -Times 2
Assert-WasCalled Remove-ServiceFabricComposeDeployment -Times 0
Assert-WasCalled New-ServiceFabricComposeDeployment -Times 1