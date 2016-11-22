[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

Register-Mock Get-VstsInput { "SqlTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "MultipleSqlTaskFiles" } -ParametersEvaluator { $Name -eq "SqlFile" }
Register-Mock Get-VstsInput { "Mock Value" } -ParametersEvaluator { $Name -ne "TaskNameSelector"  -and $Name -ne "SqlFile" }

Register-Mock Find-VstsFiles {
    return @("Dacpac1.sql", "Dacpac2.sql", "DacpacN.sql") 
} -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "MultipleSqlTaskFiles" }

Assert-Throws {
    & "$PSScriptRoot\..\DeploySqlAzure.ps1"
} -MessagePattern "*SAD_FoundMoreFiles*"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { "SqlTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "NoSqlTaskFile" } -ParametersEvaluator { $Name -eq "SqlFile" }
Register-Mock Get-VstsInput { "Mock Value" } -ParametersEvaluator { $Name -ne "TaskNameSelector"  -and $Name -ne "SqlFile"}

Register-Mock Find-VstsFiles { $null } -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "NoSqlTaskFile" }

Assert-Throws {
    & "$PSScriptRoot\..\DeploySqlAzure.ps1"
} -MessagePattern "*SAD_NoFilesMatch*"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { "SqlTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "NonSqlTaskFile" } -ParametersEvaluator { $Name -eq "SqlFile" }
Register-Mock Get-VstsInput { "Mock Value" } -ParametersEvaluator { $Name -ne "TaskNameSelector"  -and $Name -ne "SqlFile" }

Register-Mock Find-VstsFiles { "nonsql.ps1" } -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "NonSqlTaskFile" }

Assert-Throws {
    & "$PSScriptRoot\..\DeploySqlAzure.ps1"
} -MessagePattern "*SAD_InvalidSqlFile*"