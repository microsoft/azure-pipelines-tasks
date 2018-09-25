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
Register-Mock Get-VstsInput { "true" } -Name upgrade

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

$deploymentStatus = @{
    "ApplicationName"         = $applicationName
    "DeploymentName"          = $deploymentName
    "ComposeDeploymentStatus" = "Ready"
    "StatusDetails"           = ""
}

$deploymentUpgraded = @{
    "ApplicationName"      = $applicationName
    "DeploymentName"       = $deploymentName
    "UpgradeState"         = "RollingForwardCompleted"
    "UpgradeStatusDetails" = ""
}
$applicationUpgraded = @{
    "ApplicationName" = $applicationName
    "UpgradeState"    = "RollingForwardCompleted"
}

$deploymentUpgrading = @{
    "ApplicationName"      = $applicationName
    "DeploymentName"       = $deploymentName
    "UpgradeState"         = "RollingForwardInProgress"
    "UpgradeStatusDetails" = ""
}
$applicationUpgrading = @{
    "ApplicationName" = $applicationName
    "UpgradeState"    = "RollingForwardInProgress"
}

# Need to store the bool in an object so the lambdas will share the reference
$isUpgrading = New-Object 'System.Collections.Generic.Dictionary[string, bool]'
$isUpgrading.Value = $false

Register-Mock Get-ServiceFabricComposeDeploymentStatus {
    return $deploymentStatus
} -DeploymentName: $deploymentName

Register-Mock Remove-ServiceFabricComposeDeployment {
} -DeploymentName: $deploymentName -Force: $true

Register-Mock Test-ServiceFabricApplicationPackage { } -- -ComposeFilePath $composeFilePath -ErrorAction Stop

Register-Mock New-ServiceFabricComposeDeployment {
} -- -DeploymentName: $deploymentName -Compose: $composeFilePath

Register-Mock Get-ServiceFabricComposeDeploymentUpgrade {
    if ($isUpgrading.Value -eq $true)
    {
        return $deploymentUpgrading;
    }
    else
    {
        return $deploymentUpgraded
    }
} -DeploymentName: $deploymentName

Register-Mock Get-ServiceFabricApplicationUpgrade {
    if ($isUpgrading.Value -eq $true)
    {
        $isUpgrading.Value = $false
        return $applicationUpgrading;
    }
    else
    {
        return $applicationUpgraded
    }
} -ApplicationName: $applicationName

Register-Mock Start-ServiceFabricComposeDeploymentUpgrade {
    $isUpgrading.Value = $true
} -Force: True -ConsiderWarningAsError: True -FailureAction: Rollback -DeploymentName: $deploymentName -Monitored: True -Compose: $composeFilePath

Register-Mock Start-Sleep { } -ParametersEvaluator { $true }

# Act
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricComposeDeployV0\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
@( & $PSScriptRoot/../../../Tasks/ServiceFabricComposeDeployV0/ServiceFabricComposeDeploy.ps1 )

# Assert
Assert-WasCalled Get-ServiceFabricComposeDeploymentStatus -Times 1
Assert-WasCalled Get-ServiceFabricComposeDeploymentUpgrade -Times 3
Assert-WasCalled Remove-ServiceFabricComposeDeployment -Times 0
Assert-WasCalled New-ServiceFabricComposeDeployment -Times 0