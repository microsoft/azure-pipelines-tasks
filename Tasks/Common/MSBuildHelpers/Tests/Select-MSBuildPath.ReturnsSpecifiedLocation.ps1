[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..

# Act.
$actual = Select-MSBuildPath -Method 'Location' -Location 'Some location' -PreferredVersion 'Some version' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual -Expected 'Some location' -Actual $actual
