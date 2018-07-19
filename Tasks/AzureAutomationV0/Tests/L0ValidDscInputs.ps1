[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-VstsInput { "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceName" }
Register-Mock Get-VstsInput { "SurabhiSonali" } -ParametersEvaluator { $Name -eq "ResourceGroupName" }
Register-Mock Get-VstsInput { "SurabhiTrial" } -ParametersEvaluator { $Name -eq "AutomationAccountName" }
Register-Mock Get-VstsInput { "SurabhiTrial" } -ParametersEvaluator { $Name -eq "AutomationAccountName" }
Register-Mock Get-VstsInput { "TestConfiguration" } -ParametersEvaluator { $Name -eq "AutomationDscConfiguration" }
Register-Mock Get-VstsInput { "true" } -ParametersEvaluator {$Name -eq "CompileDscConfiguration"}
Register-Mock Initialize-Azure

Register-Mock Get-Endpoint { return "ConnectedServiceNameARM" }
Register-Mock Start-AzureRmAutomationDscCompilationJob { }

& "$PSScriptRoot\..\DeployToAzureAutomation.ps1"

Assert-WasCalled Start-AzureRmAutomationDscCompilationJob -Times 1
