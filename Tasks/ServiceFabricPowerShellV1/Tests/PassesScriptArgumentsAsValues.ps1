[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
. $PSScriptRoot\SetupMocks.ps1
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PassesScriptArgumentsAsValues_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsPipelineFeature { $true } -- -FeatureName 'EnableServiceFabricPowerShellArgumentListInvocation'
$global:testToggleEnabled = $true
Register-Mock Get-VstsInput { $global:testScriptArguments } -- -Name ScriptArguments
$env:SF_POWERSHELL_TEST_VALUE = 'from env'
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricPowerShellV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1

function Invoke-Task([string]$ScriptArguments) {
    $global:testScriptArguments = $ScriptArguments
    try {
        & $PSScriptRoot\..\ServiceFabricPowerShell.ps1
    }
    finally {
        $global:ErrorActionPreference = 'Stop' # Reset to stop.
    }
}

# Act/Assert: arguments are bound as values with the same parameter semantics.
$actual = Invoke-Task '-Name ''build; Write-Output value'' -Force -Co 5 -Settings @{ Port = 8080 } extra "$env:SF_POWERSHELL_TEST_VALUE!" $env:SF_POWERSHELL_TEST_VALUE'
Assert-AreEqual 'build; Write-Output value' $actual.Name
Assert-AreEqual $true $actual.Force.IsPresent
Assert-AreEqual 5 $actual.Count
Assert-AreEqual 8080 $actual.Settings.Port
Assert-AreEqual @('extra', 'from env!', 'from env') $actual.Args

# Act/Assert: anything that is not a literal value is rejected.
foreach ($scriptArguments in @(
    '-Name build; Write-Output value',
    '-Name build | Write-Output value',
    '-Name (Write-Output value)',
    '-Name $(Write-Output value)',
    '-Name @{ k = (Write-Output value) }',
    '-Name { Write-Output value }',
    '-Name $someVariable',
    '-Name build > value.txt')) {
    Assert-Throws { Invoke-Task $scriptArguments } -MessagePattern "UnsupportedScriptArguments0*"
}

# Act/Assert: with the org-level toggle off, arguments are invoked as before.
$global:testToggleEnabled = $false
$actual = Invoke-Task '-Name (Write-Output value)'
Assert-AreEqual 'value' $actual.Name

Remove-Item Env:\SF_POWERSHELL_TEST_VALUE
Remove-Variable -Name testScriptArguments, testToggleEnabled -Scope Global
