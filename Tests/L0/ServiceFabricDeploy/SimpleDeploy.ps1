[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$publishProfilePath = "$PSScriptRoot\data\PublishProfile.xml"
$applicationPackagePath = "random package path"
$aadServiceConnectionName = "random connection name"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$userName = "random user"
$password = "random password"
$aadAuthority = "random authority"
$accessToken = "random access token"
$appName = "AppName"

# Setup input arguments
Register-Mock Get-VstsInput { $publishProfilePath } -- -Name publishProfilePath -Require
Register-Mock Get-VstsInput { $applicationPackagePath } -- -Name applicationPackagePath -Require
Register-Mock Get-VstsInput { $aadServiceConnectionName } -- -Name aadServiceConnectionName -Require

# Setup file resolution
Register-Mock Find-VstsFiles { $publishProfilePath } -- -LegacyPattern $publishProfilePath
Register-Mock Find-VstsFiles { $applicationPackagePath } -- -LegacyPattern $applicationPackagePath -IncludeDirectories

Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock VSTS service endpoint
$vstsEndpoint = @{
    "Auth" = @{
        "Parameters" = @{
            "Username" = $userName
            "Password" = $password
        }
    }
}
Register-Mock Get-VstsEndpoint { $vstsEndpoint } -- -Name $aadServiceConnectionName -Require

# Setup mock results of cluster metadata
$clusterMetadata = @{
    "AzureActiveDirectoryMetadata" = @{
        "Authority" = $aadAuthority
    }
}
Register-Mock Connect-ServiceFabricCluster { $clusterMetadata } -- -GetMetadata:$true -AzureActiveDirectory:$true

# Setup mocking for ActiveDirectory assembly
Register-Mock Get-VstsTaskVariable { "" } -- -Name "Agent.ServerOMDirectory" -Require
Register-Mock Add-Type {} -- -LiteralPath "\Microsoft.IdentityModel.Clients.ActiveDirectory.dll"
$mockAuthContext = New-Object PSObject
$acquireTokenMethod = {
    Param
    (
        [String]$clusterAppId,
        [String]$clientAppId,
        [Hashtable]$userCredential
    )

    return @{
        "AccessToken" = $accessToken
    }
}
Add-Member -InputObject $mockAuthContext -MemberType ScriptMethod -Name AcquireToken -Value $acquireTokenMethod
Register-Mock Create-Object { $mockAuthContext } -- -TypeName Microsoft.IdentityModel.Clients.ActiveDirectory.AuthenticationContext -ArgumentList @($aadAuthority)
Register-Mock Create-Object { $null } -- -TypeName Microsoft.IdentityModel.Clients.ActiveDirectory.UserCredential -ArgumentList @($userName, $password)

# Setup mock for connection to cluster with access token
Register-Mock Connect-ServiceFabricCluster { $null } -- -AzureActiveDirectory -SecurityToken $accessToken WarningAction SilentlyContinue

# Setup mock registry settings
$regKeyObj = @{
    "FabricSDKPSModulePath" = $serviceFabricSdkModulePath
}
Register-Mock Get-ItemProperty { $regKeyObj } -- -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKPSModulePath

Register-Mock Get-ApplicationNameFromApplicationParameterFile { $appName } -- "$PSScriptRoot\data\ApplicationParameters.xml"

# Indicate that the application does not exist on cluster
Register-Mock Get-ServiceFabricApplication { $null } -- -ApplicationName $appName

$publishArgs = @("-ApplicationPackagePath", $applicationPackagePath, "-ApplicationParameterFilePath", "$PSScriptRoot\data\ApplicationParameters.xml", "-Action", "RegisterAndCreate", "-OverwriteBehavior", "SameAppTypeAndVersion", "-ErrorAction", "Stop")
Register-Mock Publish-NewServiceFabricApplication -Arguments $publishArgs 

# Act
@( & $PSScriptRoot/../../../Tasks/ServiceFabricDeploy/deploy.ps1 )

# Assert
Assert-WasCalled Publish-NewServiceFabricApplication -Arguments $publishArgs