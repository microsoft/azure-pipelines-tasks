[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force

. $PSScriptRoot\..\Utility.ps1

# Arrange

$additionalArgumentsValidationErrorMessage = "WFC_AdditionalArgumentsMustNotIncludeForbiddenCharacters";

# Assert

Assert-Throws {
   Validate-AdditionalArguments $invalidAdditionalArgumentsWithSemicolon
} -Message $additionalArgumentsValidationErrorMessage

Assert-Throws {
    Validate-AdditionalArguments $invalidAdditionalArgumentsWithAmpersand
 } -Message $additionalArgumentsValidationErrorMessage

Assert-Throws {
   Validate-AdditionalArguments $invalidAdditionalArgumentsWithVerticalBar
} -Message $additionalArgumentsValidationErrorMessage