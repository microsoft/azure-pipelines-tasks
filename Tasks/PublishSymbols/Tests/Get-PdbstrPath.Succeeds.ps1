[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Assert-VstsPath
. $PSScriptRoot\..\IndexHelpers\IndexFunctions.ps1

# Act.
[string]$path = Get-PdbstrPath

# Assert the build contains this dependency from the archivePackage
Assert-WasCalled Assert-VstsPath
Assert-AreEqual -Expected "pdbstr.exe" -Actual ([System.IO.Path]::GetFileName($path))
Assert-AreEqual -Expected $true -Actual ([System.IO.File]::Exists($path)) -Message "Path not found: $path"