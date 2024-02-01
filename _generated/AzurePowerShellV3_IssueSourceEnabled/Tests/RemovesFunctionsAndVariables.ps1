[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# Arrange the task inputs.
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/RemovesFunctionsAndVariables_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext

# Arrange the mock task SDK module.
New-Module -Name VstsTaskSdk -ScriptBlock {
    function SomeVstsTaskSdkFunction1 { }
    function SomeVstsTaskSdkFunction2 { }
    function Out-Default { }
}
function Invoke-VstsTaskScript { } # Detached from the task SDK module
$null = Get-Item function:SomeVstsTaskSdkFunction1 # Sanity check to verify the function was imported.

# Arrange the mock Azure helpers module.
Register-Mock Initialize-Azure
New-Module -Name VstsAzureHelpers_ -ScriptBlock {
    function SomeAzureHelpersFunction1 { }
    function SomeAzureHelpersFunction2 { }
}
$null = Get-Item function:SomeAzureHelpersFunction1 # Sanity check to verify the function was imported.

# Act.
$actual = & $PSScriptRoot\..\AzurePowerShell.ps1
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert most task SDK functions were removed.
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('SomeVstsTaskSdkFunction1')
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('SomeVstsTaskSdkFunction2')
Assert-AreEqual $true $actual.FunctionNames.ContainsKey('Out-Default')
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('Invoke-VstsTaskScript')

# Assert the Azure helpers functions were removed.
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('SomeAzureHelpersFunction1')
Assert-AreEqual $false $actual.FunctionNames.ContainsKey('SomeAzureHelpersFunction2')

# Assert the local variables from the task script were removed.
Assert-AreEqual $false $actual.VariableNames.ContainsKey('scriptArguments')
Assert-AreEqual $false $actual.VariableNames.ContainsKey('scriptCommand')
