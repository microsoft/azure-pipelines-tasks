[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
Register-Mock Write-Warning
Register-Mock Start-Sleep
$maximumWaitTime = $script:sleepInterval + [timespan]::FromSeconds(1)
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$semaphorePath = "$share\_lockfile.sem"
try {
    $null = [System.IO.Directory]::CreateDirectory($share)
    [System.IO.File]::WriteAllText($semaphorePath, 'Some already existing semaphore file')

    # Act.
    Assert-Throws {
        Lock-Semaphore -Share $share -MaximumWaitTime $maximumWaitTime -SemaphoreMessage 'Some new semaphore message'
    } -MessagePattern *Reached*max*wait*time*

    # Assert
    Assert-WasCalled Write-Warning -Times 2 -ArgumentsEvaluator { $args[0] -like '*Semaphore*file*exists*Retrying*' }
    Assert-WasCalled Start-Sleep -Times 2 -- -Seconds $script:sleepInterval.TotalSeconds
    Assert-AreEqual 'Some already existing semaphore file' ([System.IO.File]::ReadAllText($semaphorePath))
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}
