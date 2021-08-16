[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
$method = ''
$location = 'some location'
$version = 'some version'
$architecture = 'some architecture'

# Act.
$actual = Select-MSBuildPath -Method $method -Location $location -PreferredVersion $version -Architecture $architecture

# Assert.
Assert-AreEqual -Expected $location -Actual $actual
