[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
Register-Mock Write-Warning
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$semaphorePath = "$share\_lockfile.sem"
try {
    $null = [System.IO.Directory]::CreateDirectory($share)
    [System.IO.File]::WriteAllText($semaphorePath, 'Some already existing semaphore file')
    [System.IO.File]::SetCreationTime($semaphorePath, ([datetime]::Now.AddHours(-25)))

    # Act.
    $semaphore = Lock-Semaphore -Share $share -MaximumWaitTime ([timespan]::FromSeconds(1)) -SemaphoreMessage "Some new semaphore message"

    # Assert.
    Assert-AreEqual "$($semaphore.Path)" $semaphorePath
    Assert-Throws {
        [System.IO.File]::Open(
            $semaphorePath,
            ([System.IO.FileMode]::Open),
            ([System.IO.FileAccess]::Read),
            ([System.IO.FileShare]::ReadWrite))
    } -MessagePattern *file*being*used*another*process*
    $semaphore.Stream.Dispose()
    Assert-AreEqual "Some new semaphore message" ([System.IO.File]::ReadAllText($semaphorePath))
    Assert-WasCalled Write-Warning -Times 2
    Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*Semaphore*file*minutes*attempting*clean*up*' }
    Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*Semaphore*file*cleaned*up*successfully*' }
} finally {
    if ($semaphore.Stream) { $semaphore.Stream.Dispose() }
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}