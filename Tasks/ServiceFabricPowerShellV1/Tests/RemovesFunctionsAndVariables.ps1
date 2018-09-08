[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\SetupMocks.ps1

# Arrange the task inputs.
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/RemovesFunctionsAndVariables_TargetScript.ps1" } -- -Name ScriptPath

# Arrange the mock task SDK module.
New-Module -Name VstsTaskSdk -ScriptBlock {
    function SomeVstsTaskSdkFunction1 { }
    function SomeVstsTaskSdkFunction2 { }
    function Out-Default { }
}
function Invoke-VstsTaskScript { } # Detached from the task SDK module
$null = Get-Item function:SomeVstsTaskSdkFunction1 # Sanity check to verify the function was imported.

# Act.
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricPowerShellV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
$actual = & $PSScriptRoot\..\ServiceFabricPowerShell.ps1
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert most task SDK functions were removed.
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('SomeVstsTaskSdkFunction1')
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('SomeVstsTaskSdkFunction2')
Assert-AreEqual $true $actual.FunctionNames.ContainsKey('Out-Default')
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('Invoke-VstsTaskScript')

# Assert the local variables from the task script were removed.
Assert-AreEqual $false $actual.VariableNames.ContainsKey('scriptArguments')
Assert-AreEqual $false $actual.VariableNames.ContainsKey('scriptCommand')
