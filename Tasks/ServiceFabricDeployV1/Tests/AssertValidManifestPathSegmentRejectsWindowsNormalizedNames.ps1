[CmdletBinding()]
param()

# Regression test requested in review for the ApplicationTypeName / diff-package / docker-settings name
# validators (Assert-ValidImageStorePathSegment, Assert-ValidDiffPackageName, and the check in
# Update-DockerSettings.psm1), which all delegate to the shared Assert-ValidManifestPathSegment in
# ServiceFabricSDK\Utilities.ps1.
#
# Windows silently strips a trailing '.' or ' ' off a path segment outside of the '\\?\' long-path form,
# so a name that looks safe on its own can resolve to a different, potentially traversal-capable name once
# the OS normalizes it: 'MyApp.' / 'MyApp. ' both resolve to 'MyApp', '...' resolves to the parent
# directory, and '.. ' resolves to '..'. None of these fail the original checks (no path separator, not
# rooted, not literally '.' or '..'), so they must be rejected by an explicit trailing dot/space check.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricDeployV1\ServiceFabricSDK\Utilities.ps1

$windowsNormalizedNames = @(
    '.. ',      # trailing space normalizes to '..'
    '. ',       # trailing space normalizes to '.'
    '...',      # trailing dots normalize away, resolving to the parent directory
    'MyApp. ',  # trailing space is stripped, resolving to 'MyApp'
    'MyApp.'    # trailing dot is stripped, resolving to 'MyApp'
)

foreach ($name in $windowsNormalizedNames)
{
    Assert-Throws {
        Assert-ValidManifestPathSegment -Name $name -ElementDescription 'ApplicationTypeName'
    } -MessagePattern "*ApplicationTypeName*"
}

# A legitimate name that merely contains an internal (non-trailing) dot must still be allowed through.
Assert-ValidManifestPathSegment -Name 'My.App' -ElementDescription 'ApplicationTypeName'
