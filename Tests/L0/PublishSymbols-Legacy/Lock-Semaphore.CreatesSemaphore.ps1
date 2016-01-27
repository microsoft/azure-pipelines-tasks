[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
foreach ($createDirectory in @( $true, $false )) {
    Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
    $semaphorePath = "$share\_lockfile.sem"
    try {
        if ($createDirectory) {
            $null = [System.IO.Directory]::CreateDirectory($share)
        }

        # Act.
        $semaphore = Lock-Semaphore -Share $share -MaximumWaitTime ([timespan]::FromMilliseconds(1)) -SemaphoreMessage "Some semaphore message"

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
    } finally {
        if ($semaphore.Stream) { $semaphore.Stream.Dispose() }
        if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
    }
}