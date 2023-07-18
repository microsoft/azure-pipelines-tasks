[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$arguments = "start notepad.exe | echo 'hello' ; calc.exe"

# Act

$sanitizedArguments = Get-SanitizedArguments -InputArgs $arguments

# Assert

Assert-AreEqual $sanitizedArguments "start notepad_#removed#_exe _#removed#_ echo 'hello' _#removed#_ calc_#removed#_exe"