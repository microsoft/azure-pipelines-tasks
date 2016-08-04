[cmdletbinding()]
param()

. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\CreateRegistryStub.ps1
. $PSScriptRoot\..\..\..\..\Tasks\DeployVisualStudioTestAgent\LocateTestAgentHelper.ps1

# Fake Registry objects
$testAgentReg = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing\14.0\testagentcore";

Register-Mock Test-Path { $true } $testAgentReg

# Verify that test agent path is empty
$testAgent = Locate-TestAgent
# Assert.
Assert-AreEqual "14.0" $testAgent.Version
Assert-AreEqual $testAgentReg $testAgent.Path
