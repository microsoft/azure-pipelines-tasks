[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '' -Architecture 'Some architecture' -SearchCom
foreach ($version in @('', 'latest')) {
    # Act.
    $actual = Select-MSBuildLocation -Method 'Version' -Location 'Some input location' -Version $version -Architecture 'Some architecture'

    # Assert.
    Assert-AreEqual 'Some resolved location' $actual
}
