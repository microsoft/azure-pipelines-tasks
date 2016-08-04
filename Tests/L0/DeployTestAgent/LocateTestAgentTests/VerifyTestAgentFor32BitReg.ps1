[cmdletbinding()]
param()

. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\CreateRegistryStub.ps1
. $PSScriptRoot\..\..\..\..\Tasks\DeployVisualStudioTestAgent\LocateTestAgentHelper.ps1

# Fake Registry objects
$testAgentReg = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing";
$dev14Reg = New-Object Registry
$dev14Reg.PSChildName = "14.0"
$dev14Reg.SubKeyNames = 'testagentcore'
$dev15Reg = New-Object Registry
$dev15Reg.PSChildName = "15.0"
$dev15Reg.SubKeyNames = 'testagentcore'
$dev16Reg = New-Object Registry
$dev16Reg.PSChildName = "16.0"

Register-Mock Get-ChildItem { ($dev14Reg,$dev15Reg) } $testAgentReg
Register-Mock Test-Path { $true } $testAgentReg

# Verify that test agent path is empty
$testAgent = Locate-TestAgent
# Assert.
Assert-AreEqual "15.0" $testAgent.Version
Assert-AreEqual ($testAgentReg + "\15.0\testagentcore") $testAgent.Path
