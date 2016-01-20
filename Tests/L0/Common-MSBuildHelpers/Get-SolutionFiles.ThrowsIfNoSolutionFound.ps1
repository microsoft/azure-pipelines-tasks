[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Find-VstsFiles { } -- -LegacyPattern 'Some * solution'
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

# Act/Assert.
Assert-Throws { Get-SolutionFiles -Solution 'Some * solution' } -MessagePattern *solution*not*found*using*search*pattern*
