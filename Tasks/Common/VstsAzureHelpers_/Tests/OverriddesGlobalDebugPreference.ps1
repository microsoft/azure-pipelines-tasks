[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$global:DebugPreference = 'Continue'

# Act.
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..

# Assert.
Assert-AreEqual 'SilentlyContinue' $global:DebugPreference
