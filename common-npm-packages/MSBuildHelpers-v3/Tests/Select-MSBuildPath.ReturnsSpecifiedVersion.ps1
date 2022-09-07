[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '14.0' -Architecture 'Some architecture'

# Act.
$actual = Select-MSBuildPath -Method 'Version' -Location 'Some input location' -PreferredVersion '14.0' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual -Expected 'Some resolved location' -Actual $actual
