function Select-VSVersion {
    [CmdletBinding()]
    param([string]$PreferredVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Look for a specific version of Visual Studio.
        if ($PreferredVersion -and $PreferredVersion -ne 'latest') {
            if ($location = Get-VSPath -Version $PreferredVersion) {
                return $PreferredVersion
            }

            Write-Warning (Get-VstsLocString -Key VSVersion0NotFoundLookingForLatest -ArgumentList $PreferredVersion)
        }

        # Look for the latest version of Visual Studio.
        [string[]]$knownVersions = '14.0', '12.0', '11.0', '10.0' |
            Where-Object { $_ -ne $PreferredVersion }
        foreach ($version in $knownVersions) {
            if ($location = Get-VSPath -Version $version) {
                return $version
            }
        }

        Write-Warning (Get-VstsLocString -Key VSNotFoundTry)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
