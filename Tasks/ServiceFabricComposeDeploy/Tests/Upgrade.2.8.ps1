[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$serviceConnectionName = "random connection name"
$composeFilePath = "docker-compose.yml"
$deploymentName = "fabric:/Application1"
$applicationName = "fabric:/fabric:/Application1"
$serverCertThumbprint = "random thumbprint"
$userName = "random user"
$password = "random password"
$connectionEndpointFullUrl = "https://mycluster.com:19000"
$connectionEndpoint = ([System.Uri]$connectionEndpointFullUrl).Authority

# Setup input arguments
Register-Mock Get-VstsInput { $serviceConnectionName } -Name serviceConnectionName -Require
Register-Mock Get-VstsInput { $composeFilePath } -Name composeFilePath -Require
Register-Mock Get-VstsInput { $deploymentName } -Name applicationName -Require
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
    "FabricSDKVersion" = "2.8.1.2"
}
Register-Mock Get-ItemProperty { $SfRegistry } -- -Path 'HKLM:\SOFTWARE\Microsoft\Service Fabric SDK\' -ErrorAction SilentlyContinue

# Setup mock results of cluster connection
Register-Mock Connect-ServiceFabricClusterFromServiceEndpoint { } -- -ClusterConnectionParameters @{} -ConnectedServiceEndpoint $vstsEndpoint

$serviceFabricComposeDeploymentStatus = @{
    "DeploymentName"  = $deploymentName
    "ComposeDeploymentStatus" = "Created"
    "StatusDetails" = ""
}

$serviceFabricComposeUpgradeStatus = @{
    "ApplicationName" = $applicationName
    "DeploymentName" = $deploymentName
    "UpgradeState" = "RollingForwardCompleted"
    "UpgradeStatusDetails" = ""
}

# Need to store the bool in an object so the lambdas will share the reference
$removedCompose = New-Object 'System.Collections.Generic.Dictionary[string, bool]'
$removedCompose.Value = $false
$removedApp = New-Object 'System.Collections.Generic.Dictionary[string, bool]'
$removedApp.Value = $false

Register-Mock Get-ServiceFabricComposeDeploymentStatus {
    if (($removedCompose.Value -eq $true))
    {
        return $null;
    }
    else
    {
        return $serviceFabricComposeDeploymentStatus
    }
} -DeploymentName: $deploymentName

Register-Mock Remove-ServiceFabricComposeDeployment {
} -DeploymentName: $deploymentName -Force: True

Register-Mock Test-ServiceFabricApplicationPackage { } -- -ComposeFilePath $composeFilePath -ErrorAction Stop

Register-Mock New-ServiceFabricComposeDeployment {
} -- -DeploymentName: $deploymentName -Compose: $composeFilePath

Register-Mock Get-ServiceFabricComposeDeploymentUpgrade {
    if (($removedCompose.Value -eq $true))
    {
        $removedCompose.Value = $false
        return $null;
    }
    else
    {
        return $serviceFabricComposeUpgradeStatus
    }
} -DeploymentName: $deploymentName

Register-Mock Get-ServiceFabricApplicationUpgrade {
    if (($removedApp.Value -eq $true))
    {
        $removedApp.Value = $false
        return $null;
    }
    else
    {
        return $serviceFabricComposeUpgradeStatus
    }
} -ApplicationName: $applicationName

Register-Mock Start-ServiceFabricComposeDeploymentUpgrade {
    $removedCompose.Value = $true
    $removedApp.Value = $true
#} -- -DeploymentName: $deploymentName -FailureAction: Rollback -Monitored: True -Compose: $composeFilePath
} -Force: True -ConsiderWarningAsError: True -FailureAction: Rollback -DeploymentName: $deploymentName -Monitored: True -Compose: $composeFilePath
# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricComposeDeploy\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricComposeDeploy/ServiceFabricComposeDeploy.ps1 )

# Assert
Assert-WasCalled Get-ServiceFabricComposeDeploymentStatus -Times 1
Assert-WasCalled Get-ServiceFabricComposeDeploymentUpgrade -Times 2
Assert-WasCalled Remove-ServiceFabricComposeDeployment -Times 0
Assert-WasCalled New-ServiceFabricComposeDeployment -Times 0