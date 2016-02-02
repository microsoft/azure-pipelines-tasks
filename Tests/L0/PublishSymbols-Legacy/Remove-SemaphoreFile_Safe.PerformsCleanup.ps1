[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
$variableSets = @( )
try {
    $variableSets += @{
        TempFile = [System.IO.Path]::GetTempFileName()
        ExpectedWarning = '*Semaphore*cleaned*up*successfully*'
    }
    $variableSets += @{
        TempFile = [System.IO.Path]::Combine($env:TMP, ([System.Guid]::NewGuid()), 'NoSuchFile.txt')
        ExpectedWarning = '*Semaphore*exists*Attempting*clean*up*'
    }
    foreach ($variableSet in $variableSets) {
        Unregister-Mock Write-Warning
        Register-Mock Write-Warning

        # Act.
        Remove-SemaphoreFile_Safe -SemaphoreFile $variableSet.TempFile

        # Assert.
        Assert-WasCalled Write-Warning -Times 2
        Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*Semaphore*exists*Attempting*clean*up*' }
        Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like $variableSet.ExpectedWarning }
        Assert-IsNullOrEmpty (Get-Item -LiteralPath $variableSet.TempFile -ErrorAction Ignore)
    }
} finally {
    foreach ($variableSet in $variableSets) {
        if (Test-Path -LiteralPath $variableSet.TempFile) {
            Write-Verbose "Removing file: $($variableSet.TempFile)"
            Remove-Item -LiteralPath $variableSet.TempFile
        }
    }
}
