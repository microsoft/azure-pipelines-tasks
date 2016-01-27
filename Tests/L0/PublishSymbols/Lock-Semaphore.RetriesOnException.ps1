[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\SemaphoreFunctions.ps1
Register-Mock Test-Path { Unregister-Mock Test-Path ; throw (New-Object System.IO.IOException('Some IO exception message'))}
Register-Mock Write-Warning
Register-Mock Start-Sleep
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$semaphorePath = "$share\_lockfile.sem"
try {
    # Act.
    $semaphore = Lock-Semaphore -Share $share -MaximumWaitTime ($script:sleepInterval + [timespan]::FromSeconds(1)) -SemaphoreMessage "Some semaphore message"

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
    Assert-AreEqual "Some semaphore message" ([System.IO.File]::ReadAllText($semaphorePath))
    Assert-WasCalled Write-Warning -Times 1
    Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*Error0AccessingSemaphoreFile1Retrying2Seconds*' }
    Assert-WasCalled Start-Sleep -Times 1 -- -Seconds $script:sleepInterval.TotalSeconds
} finally {
    if ($semaphore.Stream) { $semaphore.Stream.Dispose() }
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}