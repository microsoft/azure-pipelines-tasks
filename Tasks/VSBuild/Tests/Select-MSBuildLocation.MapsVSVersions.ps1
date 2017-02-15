[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-MSBuildLocation.ps1
$mappings = @(
    @{ VSVersion = '' ; MSBuildVersion = '' }
    @{ VSVersion = '15.0' ; MSBuildVersion = '15.0' }
    @{ VSVersion = '14.0' ; MSBuildVersion = '14.0' }
    @{ VSVersion = '12.0' ; MSBuildVersion = '12.0' }
    @{ VSVersion = '11.0' ; MSBuildVersion = '4.0' }
    @{ VSVersion = '10.0' ; MSBuildVersion = '4.0' }
)
foreach ($mapping in $mappings) {
    Unregister-Mock Get-MSBuildPath
    Register-Mock Get-MSBuildPath { "Some location" } -- -Version $mapping.MSBuildVersion -Architecture 'Some architecture' -SearchCom
    
    # Act.
    $actual = Select-MSBuildLocation -VSVersion $mapping.VSVersion -Architecture 'Some architecture'

    # Assert.
    Assert-AreEqual 'Some location' $actual
}
