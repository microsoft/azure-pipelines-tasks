function Update-PackageVersion
{
    [CmdletBinding()]
    [OutputType([string])]
    Param
    (
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $VersionValue,

        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $ServiceName,

        [Parameter(Mandatory=$true)]
        [ValidateNotNull()]
        [System.Xml.XmlElement]
        $NewPackageXml,

        [Parameter(Mandatory=$true)]
        [ValidateScript({Test-Path -LiteralPath $_})]
        [string]
        $NewPackageRoot,

        [System.Xml.XmlElement[]]
        $OldPackageXmlList,

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
    try {
        $LogIndent += "".PadLeft(2)

        $packageName = $NewPackageXml.Name
        $versionPrefix = $NewPackageXml.Version
        $newVersion = if ($ReplaceVersion) { $versionValue } else { $versionPrefix + $VersionValue }

        if (!$UpdateAllVersions)
        {
            Write-Host "$LogIndent$(Get-VstsLocString -Key SearchingPackage -ArgumentList $packageName)"
            $LogIndent += "".PadLeft(2)

            # Check the previous build for a matching package and search for changes
            $oldPackageXml = $OldPackageXmlList | Where-Object { $_.Name -eq $packageName }
            if ($oldPackageXml)
            {
                # Set the version to the version from the previous build (including its suffix). This will be overwritten if we find any changes, otherwise it will match the previous build by design.
                # Set it before we search for changes so that we can compare the xml without the old version suffix causing a false positive.
                $NewPackageXml.Version = $oldPackageXml.Version

                $updatePackageVersion = $false
                if ((!$ReplaceVersion -and !$oldPackageXml.Version.StartsWith($versionPrefix)) -or !(Test-XmlEqual $oldPackageXml $NewPackageXml))
                {
                    # The package has changed because the xml in the manifest changed
                    Write-Host "$LogIndent$(Get-VstsLocString -Key PackageManifestChanged -ArgumentList $packageName)"
                    $updatePackageVersion = $true
                }

                if ($LogAllChanges -or !$updatePackageVersion)
                {
                    # Search the package files for differences (Unless the user doesn't want to log all changes and we already know the package xml changed)
                    $newPackagePath = Join-Path $NewPackageRoot $packageName
                    $oldPackagePath = Join-Path $OldPackageRoot $packageName

                    if (Test-Path -LiteralPath $newPackagePath)
                    {
                        if (-not (Test-Path -LiteralPath $oldPackagePath) -or (Find-FileChanges $newPackagePath $oldPackagePath $LogIndent -LogAllChanges:$LogAllChanges))
                        {
                            # The package has changed because one or more files has changed
                            $updatePackageVersion = $true
                        }
                    }
                }

                if ($updatePackageVersion)
                {
                    $NewPackageXml.Version = $newVersion
                    Write-Host "$LogIndent$(Get-VstsLocString -Key UpdatedPackageVerisonFromPrevious -ArgumentList @($ServiceName,$packageName,$oldPackageXml.Version,$newVersion))"
                }
            }
            else
            {
                # Failed to find package in previous build. Fall back to force-updating the version.
                Write-Host "$LogIndent$(Get-VstsLocString -Key NewPackage)"
                $UpdateAllVersions = $true
            }
        }

        if ($UpdateAllVersions)
        {
            # Force update package version
            Write-Host "$LogIndent$(Get-VstsLocString -Key UpdatedPackageVerison -ArgumentList @($ServiceName,$packageName,$newVersion))"
            $NewPackageXml.Version = $newVersion
        }

        $NewPackageXml.Version
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}