[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$arguments = "--recursive ;start notepad.exe"
$warningMessage = "PS_FileArgsSanitized --recursive _#removed#_start notepad_#removed#_exe";

# Act & Assert

Assert-Output { 
    Get-SanitizedArgumentsArray -InputArgs $arguments
} -ExpectedOutput $warningMessage -WriteType Warning