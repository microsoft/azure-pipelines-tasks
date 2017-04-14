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
Register-Mock Get-VstsInput { "None" } -Name repositoryCredentials -Require

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

# Setup mock results of cluster connection
Register-Mock Connect-ServiceFabricClusterFromServiceEndpoint { } -- -ClusterConnectionParameters @{} -ConnectedServiceEndpoint $vstsEndpoint

Register-Mock Get-ServiceFabricDockerComposeApplicationStatusPaged { } -- -ApplicationTypeName $applicationTypeName
Register-Mock Remove-ServiceFabricDockerComposeApplication { }

$deployArgs = @("-ApplicationName:", $applicationName, "-Compose:", $composeFilePath)
Register-Mock New-ServiceFabricDockerComposeApplication { } -- -Arguments $deployArgs

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricComposeDeploy\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricComposeDeploy/ServiceFabricComposeDeploy.ps1 )

# Assert
Assert-WasCalled Get-ServiceFabricDockerComposeApplicationStatusPaged
Assert-WasCalled Remove-ServiceFabricDockerComposeApplication -Times 0
Assert-WasCalled New-ServiceFabricDockerComposeApplication