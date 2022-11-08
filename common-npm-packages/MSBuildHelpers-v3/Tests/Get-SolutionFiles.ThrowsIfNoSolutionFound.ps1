[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Find-VstsFiles { } -- -LegacyPattern 'Some * solution'
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1

# Act/Assert.
Assert-Throws { Get-SolutionFiles -Solution 'Some * solution' } -MessagePattern *solution*not*found*using*search*pattern*
