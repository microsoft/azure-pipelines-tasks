function Select-MSBuildLocation {
    [CmdletBinding()]
    param([string]$VSVersion, [string]$Architecture)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Determine which MSBuild version to use.
        $msBuildVersion = $null;
        switch ("$VSVersion") {
            '' { break }
            '15.0' { $msBuildVersion = '15.0' ; break }
            '14.0' { $msBuildVersion = '14.0' ; break }
            '12.0' { $msBuildVersion = '12.0' ; break }
            '11.0' { $msBuildVersion = '4.0' ; break }
            '10.0' { $msBuildVersion = '4.0' ; break }
            default { throw (Get-VstsLocString -Key UnexpectedVSVersion0 -ArgumentList $VSVersion) }
        }

        # Find the MSBuild location.
        if (!($msBuildLocation = Get-MSBuildPath -Version $msBuildVersion -Architecture $Architecture -SearchCom)) {
            throw (Get-VstsLocString -Key MSBuildNotFoundVersion0Architecture1 -ArgumentList $msBuildVersion, $Architecture)
        }

        $msBuildLocation
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
