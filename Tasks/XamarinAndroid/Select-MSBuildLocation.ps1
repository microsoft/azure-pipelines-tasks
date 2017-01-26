function Select-MSBuildLocation {
    [CmdletBinding()]
    param(
        [string]$Method,
        [string]$Location,
        [string]$Version,
        [string]$Architecture)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Default the msbuildLocationMethod if not specified. The input msbuildLocationMethod
        # was added to the definition after the input msbuildLocation.
        if ("$Method".ToUpperInvariant() -ne 'LOCATION' -and "$Method".ToUpperInvariant() -ne 'VERSION') {
            # Infer the msbuildLocationMethod based on the whether msbuildLocation is specified.
            if ($Location) {
                $Method = 'location'
            } else {
                $Method = 'version'
            }

            Write-Verbose "Defaulted MSBuild location method to: $Method"
        }

        # Default to 'version' if the user chose 'location' but didn't specify a location.
        if ("$Method".ToUpperInvariant() -eq 'LOCATION' -and !$Location) {
            Write-Verbose 'Location not specified. Using version instead.'
            $Method = 'version'
        }

        if ("$Method".ToUpperInvariant() -eq 'VERSION') {
            $Location = ''

            # Look for a specific version of MSBuild.
            if ($Version -and "$Version".ToUpperInvariant() -ne 'LATEST') {

                $Location = Get-MSBuildPath -Version $Version -Architecture $Architecture -SearchCom

                # Warn if not found.
                if (!$Location) {
                    Write-Warning (Get-VstsLocString -Key 'UnableToFindMSBuildVersion0Architecture1LookingForLatestVersion' -ArgumentList $Version, $Architecture)
                }
            }

            # Look for the latest version of MSBuild.
            if (!$Location) {
                Write-Verbose 'Searching for latest MSBuild version.'
                $Location = Get-MSBuildPath -Version '' -Architecture $Architecture -SearchCom

                # Throw if not found.
                if (!$Location) {
                    throw (Get-VstsLocString -Key 'MSBuildNotFoundVersion0Architecture1TryDifferent' -ArgumentList $Version, $Architecture)
                }
            }
        }

        $Location
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
