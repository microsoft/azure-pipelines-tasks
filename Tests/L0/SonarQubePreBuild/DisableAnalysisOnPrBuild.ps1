[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

# Arrange 

$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-TaskVariable { $true } -- -Context $distributedTaskContext -Name 'DisableSQAnalysisOnPrBuilds'
Register-Mock IsPrBuild {$true}
Register-Mock Write-Host

# Act - this script contains executable code and would fail if allowed to run 
. $PSScriptRoot\..\..\..\Tasks\SonarQubePreBuild\SonarQubePreBuild.ps1 -connectedServiceName "service" -projectKey "projectKey" -projectName "projectName" -projectVersion "1"

Assert-WasCalled Write-Host -ArgumentsEvaluator {$args[0] -like "*DisableSQAnalysisOnPrBuilds*"}





