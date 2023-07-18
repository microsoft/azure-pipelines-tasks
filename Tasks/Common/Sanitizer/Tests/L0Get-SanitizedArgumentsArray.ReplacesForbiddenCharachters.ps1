[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$arguments = "start notepad.exe | echo 'hello' ; calc.exe"

# Act

$sanitizedArguments = Get-SanitizedArgumentsArray -InputArgs $arguments

# Assert

Assert-AreEqual $sanitizedArguments[0] "start"
Assert-AreEqual $sanitizedArguments[1] "notepad_#removed#_exe"
Assert-AreEqual $sanitizedArguments[2] "_#removed#_"
Assert-AreEqual $sanitizedArguments[3] "echo"
Assert-AreEqual $sanitizedArguments[4] "'hello'"
Assert-AreEqual $sanitizedArguments[5] "_#removed#_"
Assert-AreEqual $sanitizedArguments[6] "calc_#removed#_exe"