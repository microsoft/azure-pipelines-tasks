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

        $imageNamesFilePathSearchPattern = Get-VstsInput -Name imageNamesPath
        $imageNamesPath = $null
        if (-not [string]::IsNullOrEmpty($imageNamesFilePathSearchPattern))
        {
            $imageNamesPath = Find-VstsFiles -LegacyPattern $imageNamesFilePathSearchPattern
        }

        $imageDigestValues = (Get-Content -LiteralPath $imageDigestsPath).Replace("`r`n", "`n").Split("`n")
        $imageNames = $null
        if (($imageNamesPath -ne $null))
        {
            $imageNames = (Get-Content -LiteralPath $imageNamesPath).Replace("`r`n", "`n").Split("`n")
            if ($imageNames.Count -ne $imageDigestValues.Count)
            {
                throw (Get-VstsLocString -Key ImageDigestListMismatch -ArgumentList @($imageNames.Count, $imageDigestValues.Count))
            }
        }

        # Collect the image digest values for the images
        $imageNameToDigestMapping = @{}
        for ($ind = 0; $ind -lt $imageDigestValues.Count; $ind++)
        {
            $imageDigestValue = $imageDigestValues[$ind]
            $imageName = $null

            $slashIndex = $imageDigestValue.IndexOf("/")
            $hashSeparatorIndex = $imageDigestValue.IndexOf("@")
            if ($slashIndex -lt 0 -or $hashSeparatorIndex -lt 0)
            {
                throw (Get-VstsLocString -Key InvalidImageDigestValue -ArgumentList @($imageDigestValue, $imageDigestsPath))
            }
            $imageDigestRepoNameWithRegistry = $imageDigestValue.Substring(0, $hashSeparatorIndex)
            $imageDigestRepoName = $imageDigestValue.Substring($slashIndex + 1, $hashSeparatorIndex - $slashIndex - 1)

            if ($imageNames -ne $null)
            {
                $imageName = $imageNames[$ind]
                $slashIndex = $imageName.IndexOf("/")
                if ($slashIndex -lt 0) { $slashIndex = -1 }
                $tagSeparatorIndex = $imageName.IndexOf(":")
                if ($tagSeparatorIndex -lt 0) { $tagSeparatorIndex = $imageName.Length}

                $imageRepoName = $imageName.Substring($slashIndex + 1, $tagSeparatorIndex - $slashIndex - 1)
                if ($imageRepoName -ne $imageDigestRepoName)
                {
                    throw (Get-VstsLocString -Key ImageDigestNameMismatch -ArgumentList @($imageDigestValue, $imageName))
                }
            }
            else
            {
                $imageName = $imageDigestRepoName

                if ($imageNameToDigestMapping.ContainsKey($imageName))
                {
                    throw (Get-VstsLocString -Key AmbiguousImages -ArgumentList @($imageName))
                }

                if($imageDigestRepoNameWithRegistry -ne $imageDigestRepoName ){
                    $imageNameToDigestMapping[$imageDigestRepoNameWithRegistry] = $imageDigestValue
                }
            }
            $imageNameToDigestMapping[$imageName] = $imageDigestValue
        }

        # Update the service manifests to use the digest-qualified image names
        $appManifestPath = Join-Path $appPackagePath "ApplicationManifest.xml"
        $appManifestXml = [xml](Get-Content -LiteralPath $appManifestPath)
        foreach ($serviceManifestImport in $appManifestXml.ApplicationManifest.ServiceManifestImport)
        {
            $serviceManifestPath = [System.IO.Path]::Combine($appPackagePath, $serviceManifestImport.ServiceManifestRef.ServiceManifestName, "ServiceManifest.xml")
            $serviceManifestXml = [xml](Get-Content -LiteralPath $serviceManifestPath)

            $hasUpdates = $false
            $codePackages = @($serviceManifestXml.ServiceManifest.CodePackage)
            foreach ($codePackage in $codePackages)
            {
                if ($codePackage.EntryPoint -and $codePackage.EntryPoint.ContainerHost -and $codePackage.EntryPoint.ContainerHost.ImageName)
                {
                    $imageName = $codePackage.EntryPoint.ContainerHost.ImageName
                    if ($imageNames -eq $null)
                    {
                        # If we don't have the list of images names with tags to map to remove the tag
                        $tagSeparatorIndex = $imageName.IndexOf(":")
                        if ($tagSeparatorIndex -ge 0)
                        {
                            $imageName = $imageName.Substring(0, $tagSeparatorIndex)
                        }
                    }

                    $digest = $imageNameToDigestMapping[$imageName]
                    if ($digest)
                    {
                        $codePackage.EntryPoint.ContainerHost.ImageName = $digest
                        $hasUpdates = $true
                    }
                    else
                    {
                        Write-Verbose (Get-VstsLocString -Key NoDigestForImage -ArgumentList @($imageName))
                    }
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
