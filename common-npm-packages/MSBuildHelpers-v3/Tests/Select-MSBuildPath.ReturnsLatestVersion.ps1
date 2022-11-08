[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
foreach ($version in @('', 'latest')) {
    Unregister-Mock Get-MSBuildPath
    Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '16.0' -Architecture 'Some architecture'

    # Act.
    $actual = Select-MSBuildPath -Method 'Version' -Location 'Some input location' -PreferredVersion $version -Architecture 'Some architecture'

    # Assert.
    Assert-AreEqual -Expected 'Some resolved location' -Actual $actual
    Assert-WasCalled Get-MSBuildPath -Times 2
}
