[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
Register-Mock Get-VstsInput { throw 'Some error message' } -- -Name $null -Require
Register-Mock Get-VstsEndpoint
Register-Mock Import-AzureModule
Register-Mock Initialize-AzureSubscription

# Act.
Assert-Throws { Initialize-Azure } -MessagePattern 'Some error message'
