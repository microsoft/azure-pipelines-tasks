[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$global:DebugPreference = 'Continue'

# Act.
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_

# Assert.
Assert-AreEqual 'SilentlyContinue' $global:DebugPreference
