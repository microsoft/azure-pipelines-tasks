[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\CreateRegistryStub.ps1
. $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\LocateTestAgentHelper.ps1

$testAgentReg = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing\15.0\testagentcore"
$testAgentProps = New-Object AgentProps

Register-Mock Locate-TestAgent { $testAgentReg }
Register-Mock Get-ChildItem { $testAgentProps }

# Call the execution
. $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\CheckTestAgentInstallation.ps1

# Assert.
Assert-WasCalled Get-ChildItem -Times 1