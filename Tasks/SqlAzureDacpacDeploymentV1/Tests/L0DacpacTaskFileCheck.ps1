[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

Register-Mock Get-VstsInput { "DacpacTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "MultipleDacpacFiles" } -ParametersEvaluator { $Name -eq "DacpacFile" }
Register-Mock Get-VstsInput { "Mock Value"} -ParametersEvaluator { $Name -ne "TaskNameSelector"  -and $Name -ne "DacpacFile" } 
Register-Mock Get-VstsInput { "Publish" } -ParametersEvaluator { $Name -eq "DeploymentAction" }

Register-Mock Get-Endpoint { return $spnEndpoint }
Register-Mock Add-FirewallRule { return "TestRule", $true }
Register-Mock Test-Path { return $false }

Register-Mock Find-VstsFiles {
    return @("Dacpac1.dacpac", "Dacpac2.dacpac", "DacpacN.dacpac") 
} -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "MultipleDacpacFiles" }

Assert-Throws {
    & "$PSScriptRoot\..\DeploySqlAzure.ps1"
} -MessagePattern "*SAD_FoundMoreFiles*"

<#
Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { "DacpacTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "NoDacpacFile" } -ParametersEvaluator { $Name -eq "DacpacFile" }
Register-Mock Get-VstsInput { "Mock Value"} -ParametersEvaluator { $Name -ne "TaskNameSelector"  -and $Name -ne "DacpacFile" }

Register-Mock Find-VstsFiles { $null } -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "NoDacpacFile" }

Assert-Throws {
    & "$PSScriptRoot\..\DeploySqlAzure.ps1"
} -MessagePattern "*SAD_NoFilesMatch*"
#>