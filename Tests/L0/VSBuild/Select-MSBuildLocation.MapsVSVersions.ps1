[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-MSBuildLocation.ps1
$mappings = @(
    @{ VSVersion = '' ; MSBuildVersion = '' ; SearchCom = $false }
    @{ VSVersion = '15.0' ; MSBuildVersion = '15.0' ; SearchCom = $false }
    @{ VSVersion = '15.0' ; MSBuildVersion = '15.0' ; SearchCom = $true }
    @{ VSVersion = '14.0' ; MSBuildVersion = '14.0' ; SearchCom = $false }
    @{ VSVersion = '12.0' ; MSBuildVersion = '12.0' ; SearchCom = $false }
    @{ VSVersion = '11.0' ; MSBuildVersion = '4.0' ; SearchCom = $false }
    @{ VSVersion = '10.0' ; MSBuildVersion = '4.0' ; SearchCom = $false }
)
foreach ($mapping in $mappings) {
    Unregister-Mock Get-MSBuildPath
    Register-Mock Get-MSBuildPath { "Some location" } -- -Version $mapping.MSBuildVersion -Architecture 'Some architecture' -SearchCom: $mapping.SearchCom
    
    # Act.
    $actual = Select-MSBuildLocation -VSVersion $mapping.VSVersion -Architecture 'Some architecture' -SearchCom:$mapping.SearchCom

    # Assert.
    Assert-AreEqual 'Some location' $actual
}
