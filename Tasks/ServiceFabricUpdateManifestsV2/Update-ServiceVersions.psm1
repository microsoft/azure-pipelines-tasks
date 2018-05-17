function Update-ServiceVersions
{
    [CmdletBinding()]
    [OutputType([string])]
    Param
    (
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $VersionValue,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $ServiceName,

        [Parameter(Mandatory = $true)]
        [ValidateScript({Test-Path -LiteralPath $_})]
        [string]
        $NewPackageRoot,

        [string]
        $OldPackageRoot,

        [string]
        $LogIndent,

        [Switch]
        $UpdateAllVersions,

        [Switch]
        $LogAllChanges,

        [Switch]
        $ReplaceVersion
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $LogIndent += "".PadLeft(2)

        $serviceManifestName = "ServiceManifest.xml"

        $newPackagePath = Join-Path $NewPackageRoot $ServiceName
        $newManifestPath = Join-Path $newPackagePath $serviceManifestName
        $newManifest = [XML](Get-Content -LiteralPath $newManifestPath)

        $versionPrefix = $newManifest.ServiceManifest.Version
        $newVersion = if ($ReplaceVersion) { $versionValue } else { $versionPrefix + $VersionValue }

        $newPackagesXml = @()
        $newPackagesXml += $newManifest.ServiceManifest.CodePackage
        $newPackagesXml += $newManifest.ServiceManifest.ConfigPackage
        $newPackagesXml += $newManifest.ServiceManifest.DataPackage
        $newPackagesXml = $newPackagesXml | Where { $_ }

        if (!$UpdateAllVersions)
        {
            # Check the previous build for a matching service and gather its info
            Write-Host "$LogIndent$(Get-VstsLocString -Key SearchingService -ArgumentList $ServiceName)"
            $LogIndent += "".PadLeft(2)

            $oldPackagePath = Join-Path $OldPackageRoot $ServiceName
            $oldManifestPath = Join-Path $oldPackagePath $serviceManifestName
            if (Test-Path -LiteralPath $oldManifestPath)
            {
                $oldManifest = [XML](Get-Content -LiteralPath $oldManifestPath)

                # Set the version to the version from the previous build (including its suffix). This will be overwritten if we find any changes, otherwise it will match the previous build by design.
                # Set it before we search for changes so that we can compare the xml without the old version suffix causing a false positive.
                $newManifest.ServiceManifest.Version = $oldManifest.ServiceManifest.Version

                $oldPackagesXml = @()
                $oldPackagesXml += $oldManifest.ServiceManifest.CodePackage
                $oldPackagesXml += $oldManifest.ServiceManifest.ConfigPackage
                $oldPackagesXml += $oldManifest.ServiceManifest.DataPackage
                $oldPackagesXml = $oldPackagesXml | Where { $_ }
            }
            else
            {
                # Failed to find service in previous build. Fall back to updating all verisons.
                Write-Host "$LogIndent$(Get-VstsLocString -Key NewService)"
                $UpdateAllVersions = $true
            }
        }

        # Update the versions of all child packages
        foreach ($newPackageXml in $newPackagesXml)
        {
            $newPackageXml.Version = Update-PackageVersion -VersionValue $VersionValue -ServiceName $ServiceName -NewPackageXml $newPackageXml -NewPackageRoot $newPackagePath -OldPackageXmlList $oldPackagesXml -OldPackageRoot $oldPackagePath -LogIndent $LogIndent -UpdateAllVersions:$UpdateAllVersions -LogAllChanges:$LogAllChanges -ReplaceVersion:$ReplaceVersion
        }

        if ($UpdateAllVersions)
        {
            # Force update service version
            $newManifest.ServiceManifest.Version = $newVersion
            Write-Host "$LogIndent$(Get-VstsLocString -Key UpdatedServiceVerison -ArgumentList @($ServiceName,$newVersion))"
        }
        elseif ((!$ReplaceVersion -and !$oldManifest.ServiceManifest.Version.StartsWith($versionPrefix)) -or !(Test-XmlEqual $oldManifest $newManifest))
        {
            # Update the service version if the service manifest has changed for any of the following reasons:
            # 1. The user edited the manifest itself (including changes to the version prefix)
            # 2. At least one of the child package versions was updated in the manifest
            Write-Host "$LogIndent$(Get-VstsLocString -Key ServiceManifestChanged -ArgumentList $ServiceName)"
            $newManifest.ServiceManifest.Version = $newVersion
            Write-Host "$LogIndent$(Get-VstsLocString -Key UpdatedServiceVerisonFromPrevious -ArgumentList @($ServiceName,$oldManifest.ServiceManifest.Version,$newVersion))"
        }

        $newManifest.Save($newManifestPath)

        $newManifest.ServiceManifest.Version
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}