function Update-DockerImageSettings
{
    [CmdletBinding()]
    Param()

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $imageDigestsFilePathSearchPattern = Get-VstsInput -Name imageDigestsPath -Require
        $imageDigestsPath = Find-VstsFiles -LegacyPattern $imageDigestsFilePathSearchPattern

        $appPackagePathSearchPattern = (Get-VstsInput -Name applicationPackagePath -Require)
        $appPackagePath = Find-VstsFiles -LegacyPattern $appPackagePathSearchPattern -IncludeDirectories

        # Collect the image digest values for the images
        $imageDigestValues = (Get-Content -Path $imageDigestsPath).Replace("`r`n", "`n").Split("`n")
        $imageNameToDigestMapping = @{}
        foreach ($imageDigestValue in $imageDigestValues)
        {
            $slashIndex = $imageDigestValue.IndexOf("/")
            $hashSeparatorIndex = $imageDigestValue.IndexOf("@")
            if ($slashIndex -lt 0 -or $hashSeparatorIndex -lt 0)
            {
                throw (Get-VstsLocString -Key InvalidImageDigestValue -ArgumentList @($imageDigestValue, $imageDigestsPath))
            }
            $imageName = $imageDigestValue.Substring($slashIndex + 1, $hashSeparatorIndex - $slashIndex - 1)
            $imageNameToDigestMapping[$imageName] = $imageDigestValue
        }

        # Update the service manifests to use the digest-qualified image names
        $appManifestPath = Join-Path $appPackagePath "ApplicationManifest.xml"
        $appManifestXml = [xml](Get-Content $appManifestPath)
        foreach ($serviceManifestImport in $appManifestXml.ApplicationManifest.ServiceManifestImport)
        {
            $serviceManifestPath = [System.IO.Path]::Combine($appPackagePath, $serviceManifestImport.ServiceManifestRef.ServiceManifestName, "ServiceManifest.xml")
            $serviceManifestXml = [xml](Get-Content $serviceManifestPath)

            $hasUpdates = $false
            $codePackages = @($serviceManifestXml.ServiceManifest.CodePackage)
            foreach ($codePackage in $codePackages)
            {
<<<<<<< HEAD
                if ($codePackage.EntryPoint -and $codePackage.EntryPoint.ContainerHost -and $codePackage.EntryPoint.ContainerHost.ImageName -and `
                    $imageNameToDigestMapping.Contains($codePackage.EntryPoint.ContainerHost.ImageName))
                {
                    $codePackage.EntryPoint.ContainerHost.ImageName = $imageNameToDigestMapping[$codePackage.EntryPoint.ContainerHost.ImageName]
                    $hasUpdates = $true
=======
                if ($codePackage.EntryPoint -and $codePackage.EntryPoint.ContainerHost -and $codePackage.EntryPoint.ContainerHost.ImageName)
                {
                    $digest = $imageNameToDigestMapping[$codePackage.EntryPoint.ContainerHost.ImageName]
                    if ($digest)
                    {
                        $codePackage.EntryPoint.ContainerHost.ImageName = $digest
                        $hasUpdates = $true
                    }
>>>>>>> c0885a675a97a226fd5463a41faa13def8012f64
                }
            }

            if ($hasUpdates)
            {
                $serviceManifestXml.Save($serviceManifestPath)
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}