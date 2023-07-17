[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$arguments = "--recursive --log-level=INFO"

# Act

$sanitizedArguments = Get-SanitizedArgumentsArray -InputArgs $arguments

# Assert

Assert-AreEqual $sanitizedArguments[0] "--recursive"
Assert-AreEqual $sanitizedArguments[1] "--log-level=INFO"