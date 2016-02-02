[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\PublishFunctions.ps1
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$lastIdPath = "$share\000Admin\lastid.txt"
try {
    $null = [System.IO.Directory]::CreateDirectory(([System.IO.Path]::GetDirectoryName($lastIdPath)))
    [System.IO.File]::WriteAllText($lastIdPath, " Some last ID ")

    # Act.
    $actual = Get-LastTransactionId -Share $share

    # Assert.
    Assert-AreEqual 'Some last ID' $actual
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}