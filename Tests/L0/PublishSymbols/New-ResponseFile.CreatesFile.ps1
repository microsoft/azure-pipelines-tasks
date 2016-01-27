[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\PublishFunctions.ps1
$pdbPaths = 'Some PDB path 1', 'Some PDB path 2'
$file = ''
try {
    # Act.
    $file = New-ResponseFile -PdbFiles $pdbPaths
    Write-Verbose "File: $file"

    # Assert
    Assert-AreEqual $pdbPaths ([System.IO.File]::ReadAllLines($file))
} finally {
    if ($file -and (Test-Path -LiteralPath $file)) { Remove-Item -LiteralPath $file }
}
