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
            }
            "ContainerRegistryEndpoint"
            {
                $dockerRegistryInput = Get-VstsInput -Name dockerRegistryEndpoint -Require
                $dockerRegistryEndpoint = Get-VstsEndpoint -Name $dockerRegistryInput -Require

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
            }
        }

        if (-not $isPasswordEncrypted -and $ClusterConnectionParameters["ServerCertThumbprint"])
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