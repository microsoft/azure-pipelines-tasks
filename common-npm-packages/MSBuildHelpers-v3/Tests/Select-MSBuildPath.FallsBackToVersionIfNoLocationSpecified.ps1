[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '15.0' -Architecture 'Some architecture'

# Act.
$actual = Select-MSBuildPath -Method 'Location' -Location '' -PreferredVersion '' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual -Expected 'Some resolved location' -Actual $actual
