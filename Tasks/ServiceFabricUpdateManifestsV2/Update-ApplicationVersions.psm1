function Update-ApplicationVersions
{
    [CmdletBinding()]
    Param()

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        #region Collect and parse input values
        $appPackagePathSearchPattern = (Get-VstsInput -Name applicationPackagePath -Require)
        Write-Host (Get-VstsLocString -Key SearchingForApplicationPackage -ArgumentList $appPackagePathSearchPattern)
        $newAppPackagePath = Find-VstsFiles -LegacyPattern $appPackagePathSearchPattern -IncludeDirectories
        Assert-SingleItem $newAppPackagePath $appPackagePathSearchPattern
        Assert-VstsPath -LiteralPath $newAppPackagePath -PathType Container
        Write-Host (Get-VstsLocString -Key FoundApplicationPackage -ArgumentList $newAppPackagePath)

        $appManifestName = "ApplicationManifest.xml"
        $newAppManifestPath = Join-Path $newAppPackagePath $appManifestName
        $newAppManifestXml = [XML](Get-Content -LiteralPath $newAppManifestPath)
        $appTypeName = $newAppManifestXml.ApplicationManifest.ApplicationTypeName

        $updateAllVersions = ((Get-VstsInput -Name updateOnlyChanged -Require) -ne "true")

        $logAllChanges = ((Get-VstsInput -Name logAllChanges -Require) -eq "true")

        $replaceVersion = ((Get-VstsInput -Name versionBehavior) -eq "Replace")

        $versionValue = Get-VstsInput -Name versionSuffix -Require
        Write-Host (Get-VstsLocString -Key VersionValueLabel -ArgumentList $versionValue)
        $versionPrefix = $newAppManifestXml.ApplicationManifest.ApplicationTypeVersion

        $newVersion = if ($replaceVersion) { $versionValue } else { $versionPrefix + $versionValue }
        #endregion

        if (!$updateAllVersions)
        {
            # Gather information on the previous build (if the user only wants to update changed packages)
            $pkgArtifactName = Get-VstsInput -Name pkgArtifactName -Require
            $compareType = Get-VstsInput -Name compareType -Require
            $buildNumber = Get-VstsInput -Name buildNumber
            $overwritePkgArtifact = ((Get-VstsInput -Name overwriteExistingPkgArtifact) -eq "true")

            try
            {
                $oldDropLocation = Get-VstsBuild $pkgArtifactName $overwritePkgArtifact $compareType $buildNumber
            }
            catch
            {
                # Failed to communicate with Azure Pipelines and get the previous build. Swallow exception and set oldDropLocation to null
                Write-Warning (Get-VstsLocString -Key VstsRestApiFailed -ArgumentList $_)
                $oldDropLocation = $null
            }

            if ($oldDropLocation -and (Test-Path -LiteralPath $oldDropLocation))
            {
                # Gather information on the previous application type
                Write-Host (Get-VstsLocString -Key PreviousBuildLocationLabel -ArgumentList $oldDropLocation)

                Write-Host (Get-VstsLocString -Key SearchingApplicationType -ArgumentList $appTypeName)

                # Try and find the old app package path by finding the largest substring of the path that exists in the artifact path
                $relativePath = $newAppPackagePath
                $pathRoot = [System.IO.Path]::GetPathRoot($relativePath)
                if (![System.String]::IsNullOrEmpty($pathRoot))
                {
                    $relativePath = $relativePath.SubString($pathRoot.Length)
                }
                $relativePath.Trim([System.IO.Path]::DirectorySeparatorChar)
                $oldAppPackagePath = Join-Path $oldDropLocation $relativePath
                while (!(Test-Path -LiteralPath $oldAppPackagePath))
                {
                    $firstSlash = $relativePath.IndexOf([System.IO.Path]::DirectorySeparatorChar)
                    if ($firstSlash -lt 0)
                    {
                        # No sub-directory of top level directory found
                        # Check if the top level directory itself contains manifest package
                        if (Test-Path -LiteralPath (Join-Path $oldDropLocation $appManifestName))
                        {
                            $oldAppPackagePath = $oldDropLocation
                            break;
                        }

                        Write-Warning (Get-VstsLocString -Key CouldNotFindSubPath -ArgumentList @($newAppPackagePath, $oldDropLocation))
                        $updateAllVersions = $true
                        $oldAppPackagePath = $null
                        break;
                    }
                    $relativePath = $relativePath.SubString($firstSlash + 1)
                    $oldAppPackagePath = Join-Path $oldDropLocation $relativePath
                }

                if ($oldAppPackagePath)
                {
                    Write-Host (Get-VstsLocString -Key PreviousPackageLocation -ArgumentList $oldAppPackagePath)
                    $oldAppManifestPath = Join-Path $oldAppPackagePath $appManifestName
                    if (Test-Path -LiteralPath $oldAppManifestPath)
                    {
                        $oldAppManifestXml = [XML](Get-Content -LiteralPath $oldAppManifestPath)

                        # Set the version to the version from the previous build (including its suffix). This will be overwritten if we find any changes, otherwise it will match the previous build by design.
                        # Set it before we search for changes so that we can compare the xml without the old version suffix causing a false positive.
                        $newAppManifestXml.ApplicationManifest.ApplicationTypeVersion = $oldAppManifestXml.ApplicationManifest.ApplicationTypeVersion
                    }
                    else
                    {
                        Write-Warning (Get-VstsLocString -Key NoManifestInPreviousBuild)
                        $updateAllVersions = $true
                    }
                }
            }
            else
            {
                # Failed to connect to Azure Pipelines or failed to find a build. Fall back to updating all versions.
                Write-Warning (Get-VstsLocString -Key NoPreviousSuccessfulBuild)
                $updateAllVersions = $true
            }
        }

        # Update the versions of all child services
        $logIndent = "".PadLeft(2)
        foreach ($serviceManifestImport in $newAppManifestXml.ApplicationManifest.ServiceManifestImport)
        {
            $serviceVersion = Update-ServiceVersions -VersionValue $versionValue -ServiceName $serviceManifestImport.ServiceManifestRef.ServiceManifestName -NewPackageRoot $newAppPackagePath -OldPackageRoot $oldAppPackagePath -LogIndent $logIndent -UpdateAllVersions:$updateAllVersions -LogAllChanges:$logAllChanges -ReplaceVersion:$replaceVersion
            $serviceManifestImport.ServiceManifestRef.ServiceManifestVersion = $serviceVersion
        }

        if ($updateAllVersions)
        {
            # Force update application type version
            Write-Host (Get-VstsLocString -Key UpdatedApplicationTypeVersion -ArgumentList @($appTypeName, $newVersion))
            $newAppManifestXml.ApplicationManifest.ApplicationTypeVersion = $newVersion
        }
        elseif ((!$replaceVersion -and !$oldAppManifestXml.ApplicationManifest.ApplicationTypeVersion.StartsWith($versionPrefix)) -or !(Test-XmlEqual $oldAppManifestXml $newAppManifestXml))
        {
            # Update the application type version if the application manifest has changed for any of the following reasons:
            # 1. The user edited the manifest itself (including changes to the version prefix)
            # 2. At least one of the child service versions was updated in the manifest
            Write-Host "$logIndent$(Get-VstsLocString -Key AppManifestChanged)"
            $newAppManifestXml.ApplicationManifest.ApplicationTypeVersion = $newVersion
            Write-Host "$logIndent$(Get-VstsLocString -Key UpdatedApplicationTypeVersionFromPrevious -ArgumentList @($appTypeName,$oldAppManifestXml.ApplicationManifest.ApplicationTypeVersion,$newVersion))"
        }
        else
        {
            Write-Host "$logIndent$(Get-VstsLocString -Key NoChanges)"
        }

        $newAppManifestXml.Save($newAppManifestPath)
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}