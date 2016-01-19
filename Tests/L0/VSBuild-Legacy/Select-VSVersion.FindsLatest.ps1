[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
$preferredVersions = '', 'latest'
$knownVersions = '10.0', '11.0', '12.0', '14.0' # Registered in ascending order to validate latest is searched first.
foreach ($preferredVersion in $preferredVersions) {
    Unregister-Mock Get-VisualStudioPath
    foreach ($knownVersion in $knownVersions) {
        Register-Mock Get-VisualStudioPath { "Some location" } -- -Version $knownVersion

        # Act.
        $actual = Select-VSVersion -PreferredVersion $preferredVersion

        # Assert.
        Assert-AreEqual $knownVersion $actual
    }
}
