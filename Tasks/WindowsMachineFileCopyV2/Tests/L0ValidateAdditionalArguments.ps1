[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

# Arrange

$invalidAdditionalArgumentsWithSemicolon = "echo 123 ; start notepad.exe"
$invalidAdditionalArgumentsWithAmpersand = "echo 123 & start notepad.exe"
$invalidAdditionalArgumentsWithVerticalBar = "echo 123 | start notepad.exe"
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