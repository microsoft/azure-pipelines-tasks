[CmdletBinding()]
param()

# Security regression test for Update-DockerSettings.psm1.
#
# ImageName comes from the application package, which is not trusted. The secret of the selected registry
# credentials must only be written into the application manifest for images hosted on that registry.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-DockerSettings.psm1"

$module = Get-Module Update-DockerSettings
& $module {
    # Docker registry connection: authority must match the connection URL
    foreach ($image in @('trusted.azurecr.io/team/app:1.0', 'TRUSTED.azurecr.io/app', 'trusted.azurecr.io:443/app'))
    {
        Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName $image -RegistryUrl 'https://trusted.azurecr.io')
    }

    foreach ($image in @('attacker.invalid/team/app:1.0', 'evil.example:5443/ns/app:2.0', 'capture.trusted.azurecr.io/app',
                         'trusted.azurecr.io:5000/app', 'trusted.azurecr.io@attacker.invalid/app', 'trusted.azurecr.io\@attacker.invalid/app', 'library/app'))
    {
        Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName $image -RegistryUrl 'https://trusted.azurecr.io')
    }

    # Docker Hub connection
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'myuser/app' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'app' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'attacker.invalid/app' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'ubuntu@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'EVIL/app' -RegistryUrl 'https://index.docker.io/v1/')

    # Connection without a URL cannot be verified; HTTP default ports
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'myregistry.azurecr.io/app' -RegistryUrl '')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'trusted.example:80/app' -RegistryUrl 'http://trusted.example:80')

    # ARM service principal: only Azure Container Registry hosts
    Assert-AreEqual $true (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'myregistry.azurecr.io/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'attacker.invalid/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'azurecr.io.attacker.invalid/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'myregistry.azurecr.io:5000/app')
}

# Kill switch: package images (myregistry.azurecr.io) don't match this connection's URL
Register-Mock Get-VstsInput { "ContainerRegistryEndpoint" } -- -Name registryCredentials -Require
Register-Mock Get-VstsInput { "registry connection" } -- -Name dockerRegistryEndpoint -Require
Register-Mock Get-VstsEndpoint {
    @{ Url = 'https://other.azurecr.io'; Data = @{ registrytype = 'Others' }; Auth = @{ Scheme = 'UsernamePassword'; Parameters = @{ UserName = 'u'; Password = 'p' } } }
} -- -Name "registry connection" -Require
Register-Mock Get-VstsLocString { "registry mismatch" }
Register-Mock Write-Warning

$flagEnabled = $false
Register-Mock Get-VstsPipelineFeature { $flagEnabled } -- -FeatureName 'ServiceFabricDeploy.DisableRegistryAuthorityCheck'

$pkg = Join-Path $env:TEMP ("sfpkg-" + [guid]::NewGuid())
Copy-Item -LiteralPath "$PSScriptRoot\data\DockerSupportAssets\AppPkg\" -Destination $pkg -Container -Recurse
try
{
    Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} } -MessagePattern "registry mismatch"
    Assert-AreEqual $false ((Get-Content -Raw "$pkg\ApplicationManifest.xml") -match 'RepositoryCredentials')

    $flagEnabled = $true
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
    Assert-AreEqual $true ((Get-Content -Raw "$pkg\ApplicationManifest.xml") -match 'RepositoryCredentials')
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkg
}
