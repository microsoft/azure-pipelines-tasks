[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Find-VstsFiles { $expected } -- -LegacyPattern $solution
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..

# Act/Assert.
Assert-Throws { Get-SolutionFiles -Solution '' } -MessagePattern *Cannot*bind*Solution*
