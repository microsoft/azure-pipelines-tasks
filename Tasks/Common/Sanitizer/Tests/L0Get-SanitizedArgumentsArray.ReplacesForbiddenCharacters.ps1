[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$arguments = "start notepad.exe | echo 'hello' ; calc.exe"

# Act

$sanitizedArguments, $null = Get-SanitizedArguments -InputArgs $arguments

# Assert

# We need to use $sanitizedArguments[1] because $sanitizedArguments contains buffer with Write-Output message from the function execution.
Assert-AreEqual -Expected "start notepad.exe _#removed#_ echo 'hello' _#removed#_ calc.exe" -Actual $sanitizedArguments
