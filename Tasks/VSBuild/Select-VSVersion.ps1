function Select-VSVersion {
    [CmdletBinding()]
    param([string]$PreferredVersion, [switch]$SearchCom)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Look for a specific version of Visual Studio.
        if ($PreferredVersion -and $PreferredVersion -ne 'latest') {
            if ((Get-VSPath -Version $PreferredVersion -SearchCom:$SearchCom)) {
                return $PreferredVersion
            }

            Write-Warning (Get-VstsLocString -Key VSVersion0NotFoundLookingForLatest -ArgumentList $PreferredVersion)
        }

        # Look for the latest version of Visual Studio.
        [string[]]$knownVersions = '15.0', '14.0', '12.0', '11.0', '10.0' |
            Where-Object { $_ -ne $PreferredVersion }
        foreach ($version in $knownVersions) {
            if ((Get-VSPath -Version $version -SearchCom:$SearchCom)) {
                return $version
            }
        }

        Write-Warning (Get-VstsLocString -Key VSNotFoundTry)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
