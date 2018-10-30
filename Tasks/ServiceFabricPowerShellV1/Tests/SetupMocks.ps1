# Arrange.
$serviceConnectionName = "random connection name"
$serverCertThumbprint = "random thumbprint"
$userName = "random user"
$password = "random password"
$aadAuthority = "random authority"
$accessToken = "random access token"
$appName = "AppName"
$connectionEndpointFullUrl = "https://mycluster.com:19000"
$connectionEndpoint = ([System.Uri]$connectionEndpointFullUrl).Authority

# Setup input arguments
Register-Mock Get-VstsInput { $serviceConnectionName } -- -Name serviceConnectionName -Require

# Configure Mocks
Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock Azure Pipelines service endpoint
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

# Setup mock results of cluster metadata
$clusterMetadata = @{
    "AzureActiveDirectoryMetadata" = @{
        "Authority" = $aadAuthority
    }
}
Register-Mock Connect-ServiceFabricCluster { $clusterMetadata } -- -ServerCertThumbprint:$serverCertThumbprint -ConnectionEndpoint:$connectionEndpoint -AzureActiveDirectory:$true -GetMetadata:$true

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
Register-Mock Connect-ServiceFabricCluster { $null } -- -ServerCertThumbprint:$serverCertThumbprint -AzureActiveDirectory:$true -SecurityToken:$accessToken -ConnectionEndpoint:$connectionEndpoint -WarningAction:SilentlyContinue

# Setup mock registry settings
$regKeyObj = @{
    "FabricSDKPSModulePath" = $serviceFabricSdkModulePath
}
Register-Mock Get-ItemProperty { $regKeyObj } -- -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKPSModulePath

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\ps_modules\TlsHelper_"
Register-Mock Write-VstsTaskError
