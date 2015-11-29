[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1
$method = ''
$location = 'some location'
$version = 'some version'
$architecture = 'some architecture'

# Act.
$actual = Select-MSBuildLocation -Method $method -Location $location -Version $version -Architecture $architecture

# Assert.
Assert-AreEqual $location $actual
