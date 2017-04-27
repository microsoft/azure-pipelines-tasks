[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$serviceConnectionName = "random connection name"
$composeFilePath = "docker-compose.yml"
$applicationName = "fabric:/Application1"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$serverCertThumbprint = "random thumbprint"
$userName = "random user"
$password = "random password"
$aadAuthority = "random authority"
$accessToken = "random access token"
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

# Setup mock results of cluster connection
Register-Mock Connect-ServiceFabricClusterFromServiceEndpoint { } -- -ClusterConnectionParameters @{} -ConnectedServiceEndpoint $vstsEndpoint

$serviceFabricDockerComposeApplicationStatusPaged = @{
    "ApplicationName"        = $applicationName
    "DockerComposeApplicationStatus"    = "Created"
    "StatusDetails" = ""
}

# Need to store the bool in an object so the two lambdas will share the reference
$removed = New-Object 'System.Collections.Generic.Dictionary[string, bool]'
$removed.Value = $false

Register-Mock Get-ServiceFabricDockerComposeApplicationStatusPaged {
    if (($removed.Value -eq $true))
    {
        return $null;
    }
    else
    {
        return $serviceFabricDockerComposeApplicationStatusPaged
    }
} -ApplicationName: $applicationName

Register-Mock Remove-ServiceFabricDockerComposeApplication {
    $removed.Value = $true
} -Force: True -ApplicationName: $applicationName

Register-Mock New-ServiceFabricDockerComposeApplication { } -ApplicationName: $applicationName

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricComposeDeploy\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricComposeDeploy/ServiceFabricComposeDeploy.ps1 )

# Assert
Assert-WasCalled Get-ServiceFabricDockerComposeApplicationStatusPaged -Times 2
Assert-WasCalled Remove-ServiceFabricDockerComposeApplication -Times 1
Assert-WasCalled New-ServiceFabricDockerComposeApplication -Times 1