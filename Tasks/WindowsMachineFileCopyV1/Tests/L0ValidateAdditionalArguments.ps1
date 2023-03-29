[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force

. $PSScriptRoot\..\Utility.ps1

Assert-Throws {
   Validate-AdditionalArguments $invalidAdditionalArgumentsWithSemicolon
} -Message "Additional arguments can't include separator characters '&' and ';'. Please verify input. To learn more about argument validation, please check https://aka.ms/azdo-task-argument-validation"

Assert-Throws {
    Validate-AdditionalArguments $invalidAdditionalArgumentsWithAmpersand
 } -Message "Additional arguments can't include separator characters '&' and ';'. Please verify input. To learn more about argument validation, please check https://aka.ms/azdo-task-argument-validation"