# For more information on the VSTS Task SDK:
# https://github.com/Microsoft/vsts-task-lib

[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    # Import the localized strings.
    Import-VstsLocStrings "$PSScriptRoot\task.json"

    # Import helper modules
    Find-VstsFiles -LiteralDirectory $PSScriptRoot -LegacyPattern "*.psm1" | ForEach { Import-Module $_ }

#region Collect and parse input values
    $appPackagePathSearchPattern = (Get-VstsInput -Name applicationPackagePath -Require)
    Write-Host (Get-VstsLocString -Key SearchingForApplicationPackage -ArgumentList $appPackagePathSearchPattern)
    $newAppPackagePath = Find-VstsFiles -LegacyPattern $appPackagePathSearchPattern -IncludeDirectories
    Assert-SingleItem $newAppPackagePath $appPackagePathSearchPattern
    Assert-VstsPath -LiteralPath $newAppPackagePath -PathType Container
    Write-Host (Get-VstsLocString -Key FoundApplicationPackage -ArgumentList $newAppPackagePath)

    $appManifestName = "ApplicationManifest.xml"
    $newAppManifestPath = Join-Path $newAppPackagePath $appManifestName
    $newAppManifestXml = [XML](Get-Content $newAppManifestPath)
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

        try
        {
            $oldDropLocation = Get-VstsBuild $pkgArtifactName $compareType $buildNumber
        }
        catch
        {
            # Failed to communicate with VSTS and get the previous build. Swallow exception and set oldDropLocation to null
            Write-Warning (Get-VstsLocString -Key VstsRestApiFailed -ArgumentList $_)
            $oldDropLocation = $null
        }

        if ($oldDropLocation -and (Test-Path $oldDropLocation))
        {
            # Gather information on the previous application type
            Write-Host (Get-VstsLocString -Key PreviousBuildLocationLabel -ArgumentList $oldDropLocation)

            Write-Host (Get-VstsLocString -Key SearchingApplicationType -ArgumentList $appTypeName)

            $oldAppPackagePath = Join-Path $oldDropLocation $newAppPackagePath.SubString((Get-VstsTaskVariable -Name Build.SourcesDirectory -Require).Length + 1)
            $oldAppManifestPath = Join-Path $oldAppPackagePath $appManifestName
            $oldAppManifestXml = [XML](Get-Content $oldAppManifestPath)

            # Set the version to the version from the previous build (including its suffix). This will be overwritten if we find any changes, otherwise it will match the previous build by design.
            # Set it before we search for changes so that we can compare the xml without the old version suffix causing a false positive. 
            $newAppManifestXml.ApplicationManifest.ApplicationTypeVersion = $oldAppManifestXml.ApplicationManifest.ApplicationTypeVersion
        }
        else
        {
            # Failed to connect to VSTS or failed to find a build. Fall back to updating all versions.
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
        Write-Host (Get-VstsLocString -Key UpdatedApplicationTypeVersion -ArgumentList @($appTypeName,$newVersion))
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
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}