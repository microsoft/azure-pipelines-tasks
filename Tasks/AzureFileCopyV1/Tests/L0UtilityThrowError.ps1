[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1

 $exceptionMessage = "Exception thrown"

Assert-Throws {
    ThrowError -errorMessage $exceptionMessage
} -MessagePattern "$exceptionMessage AFC_AzureFileCopyMoreHelp https://aka.ms/azurefilecopyreadme"
