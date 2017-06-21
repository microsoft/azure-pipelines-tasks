[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Assert-VstsPath
. $PSScriptRoot\..\IndexHelpers\DbghelpFunctions.ps1

# Act.
[string]$path = Get-DbghelpPath

# Assert the build contains this dependency from the archivePackage
Assert-WasCalled Assert-VstsPath
Assert-AreEqual -Expected "dbghelp.dll" -Actual ([System.IO.Path]::GetFileName($path))
Assert-AreEqual -Expected $true -Actual ([System.IO.File]::Exists($path)) -Message "Path not found: $path"