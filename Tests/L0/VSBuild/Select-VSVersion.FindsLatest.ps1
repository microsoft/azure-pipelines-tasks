[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-VSVersion.ps1
$preferredVersions = '', 'latest'
$knownVersions = '10.0', '11.0', '12.0', '14.0', '15.0' # Registered in ascending order to validate latest is searched first.
foreach ($preferredVersion in $preferredVersions) {
    Unregister-Mock Get-VSPath
    foreach ($knownVersion in $knownVersions) {
        Register-Mock Get-VSPath { "Some location" } -- -Version $knownVersion -SearchCom: $false

        # Act.
        $actual = Select-VSVersion -PreferredVersion $preferredVersion -SearchCom:$false

        # Assert.
        Assert-AreEqual $knownVersion $actual
    }
}
