[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-VstsInput { "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceName" }
Register-Mock Get-VstsInput { "TestResourceGroup" } -ParametersEvaluator { $Name -eq "ResourceGroupName" }
Register-Mock Get-VstsInput { "TestAutomationAccount" } -ParametersEvaluator { $Name -eq "AutomationAccountName" }
Register-Mock Get-VstsInput { "Hello-World" } -ParametersEvaluator { $Name -eq "AutomationRunbook" }
Register-Mock Get-VstsInput { "true" } -ParametersEvaluator {$Name -eq "StartRunbookJob"}
Register-Mock Initialize-Azure

Register-Mock Get-Endpoint { return "ConnectedServiceNameARM" }
Register-Mock Start-AzureRmAutomationRunbook { }

& "$PSScriptRoot\..\DeployToAzureAutomation.ps1"

Assert-WasCalled Start-AzureRmAutomationRunbook -Times 1
