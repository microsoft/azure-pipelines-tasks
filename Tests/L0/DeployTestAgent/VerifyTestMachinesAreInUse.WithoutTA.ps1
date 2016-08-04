[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\LocateTestAgentHelper.ps1

$testAgentProps = @{}
$testAgentProps.TfsUrl = "fake"

Register-Mock Locate-TestAgentPath { $null }
Register-Mock Test-Path { $true }
Register-Mock Get-ItemProperty { $testAgentProps }

# Call the execution
. $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\VerifyTestMachinesAreInUse.ps1

# Assert.
Assert-WasCalled Get-ItemProperty -Times 0