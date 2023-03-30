[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$global:DebugPreference = 'Continue'
Unregister-Mock Import-Module
Register-Mock Write-VstsTaskError
Register-Mock Get-VstsWebProxy { }

# Act.
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..

# Assert.
Assert-AreEqual 'SilentlyContinue' $global:DebugPreference
