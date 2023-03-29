[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force

. $PSScriptRoot\..\Utility.ps1

Assert-Throws {
   Validate-AdditionalArguments $invalidAdditionalArgumentsWithSemicolon
} -Message "WFC_AdditionalArgumentsMustNotIncludeForbiddenCharacters"

Assert-Throws {
    Validate-AdditionalArguments $invalidAdditionalArgumentsWithAmpersand
 } -Message "WFC_AdditionalArgumentsMustNotIncludeForbiddenCharacters"