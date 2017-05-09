function Select-VSVersion {
    [CmdletBinding()]
    param([string]$PreferredVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $specificVersion = $PreferredVersion -and $PreferredVersion -ne 'latest'
        $versions = '15.0', '14.0', '12.0', '11.0', '10.0' | Where-Object { $_ -ne $PreferredVersion }

        # Look for a specific version of Visual Studio.
        if ($specificVersion) {
            if ((Get-VSPath -Version $PreferredVersion)) {
                return $PreferredVersion
            }

            # Error. Do not fallback from 15.0.
            if ($PreferredVersion -eq '15.0') {
                throw (Get-VstsLocString -Key 'VSVersion15NotFound' -ArgumentList $PreferredVersion)
            }

            # Attempt to fallback.
            $versions = $versions | Where-Object { $_ -ne '15.0' } # Fallback is only between 14.0-10.0.
            Write-Verbose "Version '$PreferredVersion' not found. Looking for fallback version."
        }

        # Look for latest or a fallback version.
        foreach ($version in $versions) {
            if ((Get-VSPath -Version $version)) {
                # Warn falling back.
                if ($specificVersion) {
                    Write-Warning (Get-VstsLocString -Key 'VSVersion0NotFoundFallbackVersion1' -ArgumentList $PreferredVersion, $version)
                }

                return $version
            }
        }

        # Warn not found.
        if ($specificVersion) {
            Write-Warning (Get-VstsLocString -Key 'VSVersion0NotFound' -ArgumentList $PreferredVersion)
        } else {
            Write-Warning (Get-VstsLocString -Key 'VSNotFoundTry')
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
