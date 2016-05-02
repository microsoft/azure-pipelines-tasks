[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_
Register-Mock Get-VstsInput { throw 'Some error message' } -- -Name $null -Require
Register-Mock Get-VstsEndpoint
Register-Mock Import-AzureModule
Register-Mock Initialize-AzureSubscription

# Act.
Assert-Throws { Initialize-Azure } -MessagePattern 'Some error message'
