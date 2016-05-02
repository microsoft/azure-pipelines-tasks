[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\PublishFunctions.ps1
Register-Mock Write-Warning
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
try {
    # Act.
    $actual = Get-LastTransactionId -Share $share

    # Assert.
    Assert-IsNullOrEmpty $actual
    Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*SymbolStoreLastIdTxtNotFoundAt0*' }
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}