[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\SemaphoreFunctions.ps1
$variableSets = @( )
try {
    $variableSets += @{
        TempFile = [System.IO.Path]::GetTempFileName()
        CreationTime = [datetime]::Now.AddHours(-25)
        Expected = $true
    }
    $variableSets += @{
        TempFile = [System.IO.Path]::GetTempFileName()
        CreationTime = [datetime]::Now.AddHours(-23)
        Expected = $false
    }
    foreach ($variableSet in $variableSets) {
        [System.IO.File]::SetCreationTime($variableSet.TempFile, $variableSet.CreationTime)

        # Act.
        $actual = Test-SemaphoreMaximumAge -SemaphoreFile $variableSet.TempFile

        # Assert.
        Assert-AreEqual $variableSet.Expected $actual
    }
} finally {
    foreach ($variableSet in $variableSets) {
        Write-Verbose "Removing file: $($variableSet.TempFile)"
        Remove-Item -LiteralPath $variableSet.TempFile
    }
}
