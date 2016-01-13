[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
$mappings = @(
    @{ VSVersion = '' ; MSBuildVersion = '' }
    @{ VSVersion = '14.0' ; MSBuildVersion = '14.0' }
    @{ VSVersion = '12.0' ; MSBuildVersion = '12.0' }
    @{ VSVersion = '11.0' ; MSBuildVersion = '4.0' }
    @{ VSVersion = '10.0' ; MSBuildVersion = '4.0' }
)
foreach ($mapping in $mappings) {
    Unregister-Mock Get-MSBuildLocation
    Register-Mock Get-MSBuildLocation { "Some location" } -- -Version $mapping.MSBuildVersion -Architecture 'Some architecture'
    
    # Act.
    $actual = Select-MSBuildLocation -VSVersion $mapping.VSVersion -Architecture 'Some architecture'

    # Assert.
    Assert-AreEqual 'Some location' $actual
}
