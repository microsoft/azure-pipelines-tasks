[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-MSBuildLocation.ps1
$method = ''
$location = 'some location'
$version = 'some version'
$architecture = 'some architecture'

# Act.
$actual = Select-MSBuildLocation -Method $method -Location $location -Version $version -Architecture $architecture

# Assert.
Assert-AreEqual $location $actual
