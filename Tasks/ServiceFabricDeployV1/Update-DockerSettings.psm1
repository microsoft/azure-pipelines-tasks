# Load the shared manifest-path-segment validator (Assert-ValidManifestPathSegment). This runs before
# Create-DiffPackage.psm1's own validation - configureDockerSettings is applied unconditionally, even when
# useDiffPackage is disabled - so ServiceManifestRef/@ServiceManifestName must be checked here too, not just
# in the diff-package path.
. "$PSScriptRoot\ServiceFabricSDK\Utilities.ps1"

function Get-ImageRegistryAuthority
{
    [CmdletBinding()]
    Param(
        [String]
        $ImageName
    )

    # Follows Docker reference rules: the first path component is a registry if it contains '.' or ':',
    # is 'localhost' or contains an uppercase letter; otherwise the image lives on Docker Hub.
    $imageName = $ImageName.Trim()
    if (-not $imageName.Contains('/'))
    {
        return 'docker.io:443'
    }

    $firstComponent = $imageName.Split('/')[0]
    if ($firstComponent -match '[@\\]')
    {
        return $null
    }

    if ($firstComponent -match '[.:]' -or $firstComponent -eq 'localhost' -or $firstComponent -cne $firstComponent.ToLowerInvariant())
    {
        return Get-NormalizedRegistryAuthority -Value $firstComponent
    }

    return 'docker.io:443'
}

function Get-NormalizedRegistryAuthority
{
    [CmdletBinding()]
    Param(
        [String]
        $Value
    )

    $uri = $null
    $candidate = if ($Value -match '^[a-zA-Z][a-zA-Z0-9+.-]*://') { $Value } else { "https://$Value" }
    if (-not [Uri]::TryCreate($candidate, [UriKind]::Absolute, [ref]$uri) -or -not $uri.Host)
    {
        return $null
    }

    # A user-info section means the host the client would contact differs from the leading text; never trust it.
    if ($uri.UserInfo)
    {
        return $null
    }

    $registryHost = $uri.IdnHost.ToLowerInvariant()
    if (@('index.docker.io', 'registry-1.docker.io', 'registry.hub.docker.com') -contains $registryHost)
    {
        $registryHost = 'docker.io'
    }

    # Keep the effective port (scheme default when omitted): different ports can be different registry services.
    return "${registryHost}:$($uri.Port)"
}

function Test-ImageMatchesRegistry
{
    [CmdletBinding()]
    Param(
        [String]
        $ImageName,

        # Registry service connection URL.
        [String]
        $RegistryUrl,

        # Credentials that are not tied to a registry URL (ARM service principal) are only valid for Azure Container Registry.
        [switch]
        $AzureContainerRegistryOnly
    )

    $imageAuthority = Get-ImageRegistryAuthority -ImageName $ImageName
    if (-not $imageAuthority)
    {
        return $false
    }

    if ($AzureContainerRegistryOnly)
    {
        return ($imageAuthority -match '^[^:]+\.azurecr\.(io|cn|us|de):443$')
    }

    # A registry connection without a usable URL cannot be verified, so fail closed.
    $registryAuthority = Get-NormalizedRegistryAuthority -Value $RegistryUrl
    return ($registryAuthority -and $imageAuthority -eq $registryAuthority)
}

function Update-DockerSettings
{
    [CmdletBinding()]
    Param(
        [String]
        $ApplicationPackagePath,

        [Hashtable]
        $ClusterConnectionParameters
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        # Get the credentials of the selected registry endpoint
        $registryCredentials = Get-VstsInput -Name registryCredentials -Require
        switch ($registryCredentials) {
            "AzureResourceManagerEndpoint"
            {
                $azureSubscriptionEndpoint = Get-VstsInput -Name azureSubscriptionEndpoint -Require
                $connectedServiceEndpoint = Get-VstsEndpoint -Name $azureSubscriptionEndpoint -Require
                if ($connectedServiceEndpoint.Auth.Scheme -ne "ServicePrincipal")
                {
                    throw (Get-VstsLocString -Key UnsupportedARMAuthScheme -ArgumentList $connectedServiceEndpoint.Auth.Scheme)
                }

                $userName = $connectedServiceEndpoint.Auth.Parameters.ServicePrincipalId
                $password = $connectedServiceEndpoint.Auth.Parameters.ServicePrincipalKey
                $isPasswordEncrypted = $false
                $registryUrl = $null
                $acrOnly = $true
                $restrictToRegistry = $true
            }
            "ContainerRegistryEndpoint"
            {
                $dockerRegistryInput = Get-VstsInput -Name dockerRegistryEndpoint -Require
                $dockerRegistryEndpoint = Get-VstsEndpoint -Name $dockerRegistryInput -Require
                $registryUrl = $dockerRegistryEndpoint.Url
                $acrOnly = $false
                $restrictToRegistry = $true

                if ($dockerRegistryEndpoint.Data.registrytype -eq "ACR")
                {
                    if ($dockerRegistryEndpoint.Auth.Scheme -ne "ServicePrincipal")
                    {
                        throw (Get-VstsLocString -Key UnsupportedContainerRegistryAuthScheme -ArgumentList $dockerRegistryEndpoint.Auth.Scheme)
                    }
                    $userName = $dockerRegistryEndpoint.Auth.Parameters.ServicePrincipalId
                    $password = $dockerRegistryEndpoint.Auth.Parameters.ServicePrincipalKey
                    $isPasswordEncrypted = $false
                }
                else {
                    $userName = $dockerRegistryEndpoint.Auth.Parameters.UserName
                    $password = $dockerRegistryEndpoint.Auth.Parameters.Password
                    $isPasswordEncrypted = $false
                }
            }
            "UsernamePassword"
            {
                $username = Get-VstsInput -Name registryUserName -Require
                $password = Get-VstsInput -Name registryPassword -Require
                $isPasswordEncrypted = (Get-VstsInput -Name passwordEncrypted -Require) -eq "true"
                $registryUrl = $null
                $restrictToRegistry = $false
            }
        }

        if (-not $isPasswordEncrypted -and ($ClusterConnectionParameters["ServerCertThumbprint"] -or $ClusterConnectionParameters["ServerCommonName"]))
        {
            $encryptedPassword = Get-ServiceFabricEncryptedText -Text $password -ClusterConnectionParameters $clusterConnectionParameters
            if ($encryptedPassword)
            {
                $password = $encryptedPassword
                $isPasswordEncrypted = $true
            }
        }

        $appManifestPath = Join-Path $ApplicationPackagePath "ApplicationManifest.xml"
        $appManifestXml = [xml](Get-Content -LiteralPath $appManifestPath)

        $serviceManifestImports = @($appManifestXml.ApplicationManifest.ServiceManifestImport)
        foreach ($serviceManifestImport in $serviceManifestImports)
        {
            # Open the service manifest associated with the current ServiceManifestImport element
            #
            # ServiceManifestName is read straight out of the local ApplicationManifest.xml, and the
            # manifest is only as trustworthy as whatever produced the application package. A relative
            # name (eg '..\..\x') would read a file outside the application package, and a UNC name (eg
            # '\\server\share\x') would cause an outbound SMB request - so it must be validated before
            # it is joined into a path, exactly like the equivalent name is validated in
            # Create-DiffPackage.psm1.
            Assert-ValidManifestPathSegment -Name $serviceManifestImport.ServiceManifestRef.ServiceManifestName -ElementDescription 'ServiceManifestRef/@ServiceManifestName'
            $serviceManifestPath = [System.IO.Path]::Combine($ApplicationPackagePath, $serviceManifestImport.ServiceManifestRef.ServiceManifestName, "ServiceManifest.xml")
            $serviceManifestXml = [xml](Get-Content -LiteralPath $serviceManifestPath)

            # Enumerate through the code packages of the service manifest and find those that are associated with an image name. For each
            # of those code packages, we're going to setup the app manifest with ContainerHostPolicies for those code packages so that they
            # are configured to use the selected registry's credentials.  Example XML fragment of what we're trying to ensure exists in
            # the app manifest:
            #   <ServiceManifestImport>
            #     <ServiceManifestRef ServiceManifestName="WebApplication1Pkg" ServiceManifestVersion="1.0.0" />
            #     <Policies>
            #       <ContainerHostPolicies CodePackageRef="Code">
            #         <RepositoryCredentials AccountName="username" Password="encryptedpassword" PasswordEncrypted="true" />
            #       </ContainerHostPolicies>
            #     </Policies>
            #   </ServiceManifestImport>

            $codePackages = @($serviceManifestXml.ServiceManifest.CodePackage)
            foreach ($codePackage in $codePackages)
            {
                # If this code package has an image name associated with it, update the app manifest to ensure there are respository credentials defined for this package.
                if ($codePackage.EntryPoint -and $codePackage.EntryPoint.ContainerHost -and $codePackage.EntryPoint.ContainerHost.ImageName)
                {
                    # Ensure there is a Policies element
                    $policies = $serviceManifestImport.Policies
                    if (-not $serviceManifestImport.Policies)
                    {
                        $policies = $appManifestXml.CreateElement("Policies", $appManifestXml.ApplicationManifest.NamespaceURI)
                        [void]($serviceManifestImport.AppendChild($policies))
                    }

                    # Ensure there is a ContainerHostPolicies element
                    $containerHostPolicies = @($policies.ContainerHostPolicies)
                    $containerHostPolicy = $containerHostPolicies | where { $_.CodePackageRef -eq $codePackage.Name }
                    if (-not $containerHostPolicy)
                    {
                        $containerHostPolicy = $appManifestXml.CreateElement("ContainerHostPolicies", $appManifestXml.ApplicationManifest.NamespaceURI)
                        $containerHostPolicy.SetAttribute("CodePackageRef", $codePackage.Name)
                        [void]($policies.AppendChild($containerHostPolicy))
                    }

                    # If there isn't already a RepositoryCredentials element, create one with the credentials of the selected registry
                    if (-not $containerHostPolicy.RepositoryCredentials)
                    {
                        # ImageName comes from the (untrusted) application package, and ImageOverrides can select a different
                        # image at deployment time. Never hand a service connection's secret to a registry other than the one
                        # the connection points at, whichever image ends up being used.
                        if ($restrictToRegistry)
                        {
                            $imageNames = @($codePackage.EntryPoint.ContainerHost.ImageName)
                            if ($containerHostPolicy.ImageOverrides)
                            {
                                $imageNames += @($containerHostPolicy.ImageOverrides.Image | where { $_ } | foreach { $_.Name })
                            }

                            foreach ($imageName in $imageNames)
                            {
                                # An override name that is an application parameter ('[Param]') is resolved only at deployment time
                                # from files this task does not control, so it cannot be verified here.
                                if ($imageName -match '^\s*\[.*\]\s*$' -or -not (Test-ImageMatchesRegistry -ImageName $imageName -RegistryUrl $registryUrl -AzureContainerRegistryOnly:$acrOnly))
                                {
                                    # Kill switch: when enabled, fall back to the legacy behavior of applying the credentials to any image.
                                    if (Get-VstsPipelineFeature -FeatureName 'ServiceFabricDeploy.DisableRegistryAuthorityCheck')
                                    {
                                        Write-Warning (Get-VstsLocString -Key RegistryAuthorityCheckDisabled -ArgumentList $imageName, $codePackage.Name)
                                    }
                                    else
                                    {
                                        throw (Get-VstsLocString -Key RegistryAuthorityMismatch -ArgumentList $imageName, $codePackage.Name)
                                    }
                                }
                            }
                        }
                        $repositoryCredentials = $appManifestXml.CreateElement("RepositoryCredentials", $appManifestXml.ApplicationManifest.NamespaceURI)
                        $repositoryCredentials.SetAttribute("AccountName", $userName)
                        $repositoryCredentials.SetAttribute("Password", $password)
                        $repositoryCredentials.SetAttribute("PasswordEncrypted", $isPasswordEncrypted.ToString().ToLower())
                        [void]($containerHostPolicy.AppendChild($repositoryCredentials))
                    }
                }
            }
        }

        $appManifestXml.Save($appManifestPath)
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}