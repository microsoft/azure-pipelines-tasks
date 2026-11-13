[CmdletBinding()]
param()

# Registry authority validation test for Update-DockerSettings.psm1.
#
# ImageName comes from the application package. The secret of the selected registry
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

    foreach ($image in @('other.invalid/team/app:1.0', 'evil.example:5443/ns/app:2.0', 'capture.trusted.azurecr.io/app',
                         'trusted.azurecr.io:5000/app', 'trusted.azurecr.io@other.invalid/app', 'trusted.azurecr.io\@other.invalid/app', 'library/app'))
    {
        Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName $image -RegistryUrl 'https://trusted.azurecr.io')
    }

    # Docker Hub connection
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'myuser/app' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'app' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'other.invalid/app' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'ubuntu@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' -RegistryUrl 'https://index.docker.io/v1/')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'EVIL/app' -RegistryUrl 'https://index.docker.io/v1/')

    # Connection without a URL cannot be verified; HTTP default ports
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'myregistry.azurecr.io/app' -RegistryUrl '')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'trusted.example:80/app' -RegistryUrl 'http://trusted.example:80')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'trusted.example:80/app' -RegistryUrl 'https://trusted.example')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName 'trusted.example/app' -RegistryUrl 'https://trusted.example:443')
    # An image without a port is pulled over HTTPS first, so a plain-http registry requires an explicit port
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'trusted.example/app' -RegistryUrl 'http://trusted.example')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'trusted.example:443/app' -RegistryUrl 'http://trusted.example')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'trusted.example:80/app' -RegistryUrl 'https://trusted.example:443')

    # IPv6 literal registries: equivalent spellings match; other hosts, ports, zone ids and tokens outside the host do not
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName '[::1]:5000/app' -RegistryUrl 'https://[0:0:0:0:0:0:0:1]:5000')
    Assert-AreEqual $true (Test-ImageMatchesRegistry -ImageName '[::1]/app' -RegistryUrl 'https://[::1]')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName '[::1]:5001/app' -RegistryUrl 'https://[::1]:5000')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName '[::2]:5000/app' -RegistryUrl 'https://[::1]:5000')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName '[fe80::1%25eth0]:5000/app' -RegistryUrl 'https://[fe80::1]:5000')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName '[::1]:5000/app/[Repo]' -RegistryUrl 'https://[::1]:5000')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -ImageName 'trusted.example/app:[::1]' -RegistryUrl 'https://trusted.example')

    # ARM service principal: only Azure Container Registry hosts
    Assert-AreEqual $true (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'myregistry.azurecr.io/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'other.invalid/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'azurecr.io.other.invalid/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName 'myregistry.azurecr.io:5000/app')

    # Embedded parameter tokens and empty names cannot be verified
    Assert-AreEqual $false (Test-ImageMatchesRegistry -RegistryUrl 'https://myregistry.azurecr.io' -ImageName 'myregistry.azurecr.io/[Repo]')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -AzureContainerRegistryOnly -ImageName '[Prefix].azurecr.io/app')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -RegistryUrl 'https://myregistry.azurecr.io' -ImageName $null)

    # Registry authority of service connections whose Url is not the registry
    $acr = @{ Url = 'https://management.azure.com/'; Data = @{ registrytype = 'ACR' }; Auth = @{ Parameters = @{ loginServer = 'myregistry.azurecr.io' } } }
    Assert-AreEqual 'myregistry.azurecr.io' (Get-RegistryConnectionAuthority -Endpoint $acr)
    Assert-AreEqual $true (Test-ImageMatchesRegistry -RegistryUrl (Get-RegistryConnectionAuthority -Endpoint $acr) -ImageName 'myregistry.azurecr.io/app')
    $hub = @{ Url = 'https://hub.docker.com/'; Data = @{ registrytype = 'DockerHub' }; Auth = @{ Parameters = @{} } }
    Assert-AreEqual $true (Test-ImageMatchesRegistry -RegistryUrl (Get-RegistryConnectionAuthority -Endpoint $hub) -ImageName 'library/ubuntu')
    Assert-AreEqual $false (Test-ImageMatchesRegistry -RegistryUrl (Get-RegistryConnectionAuthority -Endpoint $hub) -ImageName 'other.invalid/app')
    $others = @{ Url = 'https://hub.docker.com/'; Data = @{ registrytype = 'Others' }; Auth = @{ Parameters = @{ registry = 'https://reg.example.com' } } }
    Assert-AreEqual $true (Test-ImageMatchesRegistry -RegistryUrl (Get-RegistryConnectionAuthority -Endpoint $others) -ImageName 'reg.example.com/app')

    # Comment/element children must not be stringified to the type name
    $doc = [xml]'<ContainerHost><ImageName><!--c-->foreign.example/app</ImageName><ImageName>ok/app</ImageName></ContainerHost>'
    $names = @(Get-ChildElements -Parent $doc.ContainerHost -LocalName 'ImageName')
    Assert-AreEqual $null (Get-ElementText -Element $names[0])
    Assert-AreEqual 'ok/app' (Get-ElementText -Element $names[1])}

# Kill switch: package images (myregistry.azurecr.io) don't match this connection's URL
Register-Mock Get-VstsInput { "ContainerRegistryEndpoint" } -- -Name registryCredentials -Require
Register-Mock Get-VstsInput { "registry connection" } -- -Name dockerRegistryEndpoint -Require
Register-Mock Get-VstsEndpoint {
    @{ Url = $endpointUrl; Data = @{ registrytype = 'Others' }; Auth = @{ Scheme = 'UsernamePassword'; Parameters = @{ UserName = 'u'; Password = 'p' } } }
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

    # ImageOverrides can select another image at deployment time: foreign and parameterized overrides are rejected too
    foreach ($override in @('other.invalid/app:1', '[ImageParam]'))
    {
        $manifestPath = "$pkg\ApplicationManifest.xml"
        $xml = [xml](Get-Content -Raw $manifestPath)
        $ns = $xml.ApplicationManifest.NamespaceURI
        $import = @($xml.ApplicationManifest.ServiceManifestImport)[0]
        $policies = $import.AppendChild($xml.CreateElement('Policies', $ns))
        $chp = $policies.AppendChild($xml.CreateElement('ContainerHostPolicies', $ns))
        $chp.SetAttribute('CodePackageRef', 'Code')
        $ov = $chp.AppendChild($xml.CreateElement('ImageOverrides', $ns))
        $img = $ov.AppendChild($xml.CreateElement('Image', $ns))
        $img.SetAttribute('Name', $override)
        $xml.Save($manifestPath)
        $endpointUrl = 'https://myregistry.azurecr.io'
        Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} } -MessagePattern "registry mismatch"
        Assert-AreEqual $false ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
        Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    }
    # An override without Os replaces the base image, so only the override is validated
    $smPath0 = Get-ChildItem $pkg -Recurse -Filter ServiceManifest.xml | Select-Object -First 1 -ExpandProperty FullName
    $smBackup = Get-Content -Raw $smPath0
    Set-Content -LiteralPath $smPath0 -Value ($smBackup -replace '<ImageName>([^<]*)</ImageName>', '<ImageName>other.invalid/base:1</ImageName>')
    foreach ($case in @(@{ Os = $null; Name = 'myregistry.azurecr.io/app:1'; Throws = $false }, @{ Os = '16299'; Name = 'myregistry.azurecr.io/app:1'; Throws = $true }))
    {
        $xml = [xml](Get-Content -Raw $manifestPath)
        $ns = $xml.ApplicationManifest.NamespaceURI
        $import = @($xml.ApplicationManifest.ServiceManifestImport)[0]
        $policies = $import.AppendChild($xml.CreateElement('Policies', $ns))
        $chp = $policies.AppendChild($xml.CreateElement('ContainerHostPolicies', $ns))
        $chp.SetAttribute('CodePackageRef', 'Code')
        $img = $chp.AppendChild($xml.CreateElement('ImageOverrides', $ns)).AppendChild($xml.CreateElement('Image', $ns))
        $img.SetAttribute('Name', $case.Name)
        if ($case.Os) { $img.SetAttribute('Os', $case.Os) }
        $xml.Save($manifestPath)
        if ($case.Throws)
        {
            Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} } -MessagePattern "registry mismatch"
        }
        else
        {
            Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
            Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
        }
        Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    }
    Set-Content -LiteralPath $smPath0 -Value $smBackup

    # Duplicate ContainerHostPolicies: every one is validated and receives credentials; a comment-split ImageName is rejected
    $endpointUrl = 'https://myregistry.azurecr.io'
    $manifestPath = "$pkg\ApplicationManifest.xml"
    $xml = [xml](Get-Content -Raw $manifestPath)
    $ns = $xml.ApplicationManifest.NamespaceURI
    $import = @($xml.ApplicationManifest.ServiceManifestImport)[0]
    $policies = $import.AppendChild($xml.CreateElement('Policies', $ns))
    foreach ($i in 1..2) { $policies.AppendChild($xml.CreateElement('ContainerHostPolicies', $ns)).SetAttribute('CodePackageRef', 'Code') }
    $xml.Save($manifestPath)
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
    Assert-AreEqual 3 (([regex]::Matches((Get-Content -Raw $manifestPath), '<RepositoryCredentials')).Count)
    Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath

    $smPath = Get-ChildItem $pkg -Recurse -Filter ServiceManifest.xml | Select-Object -First 1 -ExpandProperty FullName
    $smOriginal = Get-Content -Raw $smPath
    Set-Content -LiteralPath $smPath -Value ($smOriginal -replace '<ImageName>([^<]*)</ImageName>', '<ImageName><!--c-->$1</ImageName>')
    Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} } -MessagePattern "registry mismatch"
    Set-Content -LiteralPath $smPath -Value $smOriginal
    $endpointUrl = 'https://other.azurecr.io'
    $flagEnabled = $true
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
    Assert-AreEqual $true ((Get-Content -Raw "$pkg\ApplicationManifest.xml") -match 'RepositoryCredentials')
    Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" "$pkg\ApplicationManifest.xml"

    # Flag on: strict parsing is skipped as well, so a comment-split ImageName is applied as before
    Set-Content -LiteralPath $smPath -Value ($smOriginal -replace '<ImageName>([^<]*)</ImageName>', '<ImageName><!--c-->$1</ImageName>')
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
    Assert-AreEqual $true ((Get-Content -Raw "$pkg\ApplicationManifest.xml") -match 'RepositoryCredentials')
    Set-Content -LiteralPath $smPath -Value $smOriginal
    Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" "$pkg\ApplicationManifest.xml"

    # Whole-value parameterized image names are validated against their effective value
    $flagEnabled = $false
    $endpointUrl = 'https://myregistry.azurecr.io'
    $manifestPath = "$pkg\ApplicationManifest.xml"
    $smPaths = @(Get-ChildItem $pkg -Recurse -Filter ServiceManifest.xml | Select-Object -ExpandProperty FullName)
    $smBackups = @{}
    foreach ($p in $smPaths) { $smBackups[$p] = Get-Content -Raw $p }
    $setImage = { param($text) foreach ($p in $smPaths) { Set-Content -LiteralPath $p -Value ($smBackups[$p] -replace '<ImageName>([^<]*)</ImageName>', "<ImageName>$text</ImageName>") } }
    $addDefault = {
        param($name, $value)
        $xml = [xml](Get-Content -Raw $manifestPath)
        $params = $xml.ApplicationManifest.AppendChild($xml.CreateElement('Parameters', $xml.ApplicationManifest.NamespaceURI))
        $prm = $params.AppendChild($xml.CreateElement('Parameter', $xml.ApplicationManifest.NamespaceURI))
        $prm.SetAttribute('Name', $name)
        $prm.SetAttribute('DefaultValue', $value)
        $xml.Save($manifestPath)
    }
    $paramCases = @(
        @{ Image = '[Img]'; Params = @{ Img = 'myregistry.azurecr.io/app:1' }; Throws = $false },
        @{ Image = '[Img]'; Params = @{ img = 'myregistry.azurecr.io/app:1' }; Throws = $false },
        @{ Image = ' [Img] '; Params = @{ Img = ' myregistry.azurecr.io/app:1 ' }; Throws = $false },
        @{ Image = '[Img]'; Params = @{ Img = 'other.invalid/app:1' }; Throws = $true },
        @{ Image = '[Img]'; Params = @{ Img = 'myregistry.azurecr.io:5000/app:1' }; Throws = $true },
        @{ Image = '[Img]'; Params = @{}; Throws = $true },
        @{ Image = '[Img]'; Params = $null; Throws = $true },
        @{ Image = '[Img]'; Params = @{ Img = '' }; Throws = $true },
        @{ Image = '[Img]'; Params = @{ Img = '   ' }; Throws = $true },
        @{ Image = '[Img]'; Params = @{ Img = '[Other]'; Other = 'myregistry.azurecr.io/app:1' }; Throws = $true },
        @{ Image = '[Img]'; Params = @{ Img = 'myregistry.azurecr.io/[Repo]' }; Throws = $true },
        @{ Image = 'myregistry.azurecr.io/[Repo]'; Params = @{ Repo = 'app' }; Throws = $true },
        @{ Image = '[A][B]'; Params = @{ A = 'myregistry.azurecr.io/'; B = 'app' }; Throws = $true },
        @{ Image = '[Img]'; Params = @{ Other = 'myregistry.azurecr.io/app:1' }; Throws = $true })
    foreach ($case in $paramCases)
    {
        & $setImage $case.Image
        if ($case.Throws)
        {
            Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter $case.Params } -MessagePattern "registry mismatch"
        }
        else
        {
            Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter $case.Params
            Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
        }
        Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    }

    # An empty <Parameters /> element must not break resolution, with the flag on or off
    foreach ($flag in @($false, $true))
    {
        $flagEnabled = $flag
        $xml = [xml](Get-Content -Raw $manifestPath)
        [void]$xml.ApplicationManifest.AppendChild($xml.CreateElement('Parameters', $xml.ApplicationManifest.NamespaceURI))
        $xml.Save($manifestPath)
        & $setImage 'myregistry.azurecr.io/app:1'
        Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
        Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
        Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    }
    $flagEnabled = $false

    # Manifest default is the lowest layer; a passed value overrides it
    & $setImage '[Img]'
    & $addDefault 'Img' 'myregistry.azurecr.io/app:1'
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{}
    Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
    Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    & $addDefault 'Img' 'myregistry.azurecr.io/app:1'
    Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter @{ Img = 'other.invalid/app:1' } } -MessagePattern "registry mismatch"
    Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    & $addDefault 'Img' 'other.invalid/app:1'
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter @{ Img = 'myregistry.azurecr.io/app:1' }
    Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
    Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath

    # Parameterized ImageOverrides are resolved too
    & $setImage 'myregistry.azurecr.io/base:1'
    foreach ($case in @(@{ Value = 'myregistry.azurecr.io/o:1'; Throws = $false }, @{ Value = 'other.invalid/o:1'; Throws = $true }))
    {
        $xml = [xml](Get-Content -Raw $manifestPath)
        $ns = $xml.ApplicationManifest.NamespaceURI
        $policies = @($xml.ApplicationManifest.ServiceManifestImport)[0].AppendChild($xml.CreateElement('Policies', $ns))
        $chp = $policies.AppendChild($xml.CreateElement('ContainerHostPolicies', $ns))
        $chp.SetAttribute('CodePackageRef', 'Code')
        $img = $chp.AppendChild($xml.CreateElement('ImageOverrides', $ns)).AppendChild($xml.CreateElement('Image', $ns))
        $img.SetAttribute('Name', '[Img]')
        $xml.Save($manifestPath)
        if ($case.Throws)
        {
            Assert-Throws { Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter @{ Img = $case.Value } } -MessagePattern "registry mismatch"
        }
        else
        {
            Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter @{ Img = $case.Value }
            Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
        }
        Copy-Item -Force "$PSScriptRoot\data\DockerSupportAssets\AppPkg\ApplicationManifest.xml" $manifestPath
    }

    # Flag on: parameters are not evaluated and the legacy behavior applies
    $flagEnabled = $true
    & $setImage '[Img]'
    Update-DockerSettings -ApplicationPackagePath $pkg -ClusterConnectionParameters @{} -ApplicationParameter @{ Img = 'other.invalid/app:1' }
    Assert-AreEqual $true ((Get-Content -Raw $manifestPath) -match 'RepositoryCredentials')
    foreach ($p in $smPaths) { Set-Content -LiteralPath $p -Value $smBackups[$p] }
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkg
}
