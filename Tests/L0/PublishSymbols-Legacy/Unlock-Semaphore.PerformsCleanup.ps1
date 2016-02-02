[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
$script:disposeWasCalled = $false
Write-Verbose ($tempFile = [System.IO.Path]::GetTempFileName())
try {
    $semaphore = @{
        Stream = New-Object psobject
        Path = $tempFile
    }
    Add-Member -InputObject $semaphore.Stream -Name Dispose -MemberType ScriptMethod -Value { $script:disposeWasCalled = $true }

    # Act.
    Unlock-Semaphore -Semaphore $semaphore

    # Assert.
    Assert-AreEqual $true $script:disposeWasCalled
    Assert-IsNullOrEmpty (Get-Item -LiteralPath $tempFile -ErrorAction Ignore)
} finally {
    if (Test-Path -LiteralPath $tempFile) {
        Remove-Item -LiteralPath $tempFile
    }
}
