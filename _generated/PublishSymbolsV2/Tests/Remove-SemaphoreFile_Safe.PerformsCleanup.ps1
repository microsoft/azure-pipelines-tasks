[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\PublishHelpers\SemaphoreFunctions.ps1
$variableSets = @( )
try {
    $variableSets += @{
        TempFile = [System.IO.Path]::GetTempFileName()
        ExpectedWarning = '*CleanedUpSemaphoreFile0*'
    }
    $variableSets += @{
        TempFile = [System.IO.Path]::Combine($env:TMP, ([System.Guid]::NewGuid()), 'NoSuchFile.txt')
        ExpectedWarning = '*CleanUpSemaphoreFile0Error1*'
    }
    foreach ($variableSet in $variableSets) {
        Unregister-Mock Write-Warning
        Register-Mock Write-Warning

        # Act.
        Remove-SemaphoreFile_Safe -SemaphoreFile $variableSet.TempFile

        # Assert.
        Assert-WasCalled Write-Warning -Times 2
        Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*SemaphoreFile0Minutes1AttemptingCleanup*' }
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
