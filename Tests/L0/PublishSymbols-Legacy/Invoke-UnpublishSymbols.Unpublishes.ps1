[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishHelpers.ps1
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$transactionId = 'Some transaction ID'
$maximumWaitTime = [timespan]::FromSeconds(2)
$semaphoreMessage = 'Some semaphore message'
$semaphore = New-Object psobject
Register-Mock Push-Location
Register-Mock Lock-Semaphore { $semaphore }
Register-Mock SymstoreExe { $global:LASTEXITCODE = 0 }
Register-Mock Get-SymStorePath { Get-Command SymstoreExe }
Register-Mock Unlock-Semaphore
Register-Mock Pop-Location
try {
    $null = [System.IO.Directory]::CreateDirectory($share)

    # Act.
    Invoke-UnpublishSymbols -Share $share -TransactionId $transactionId -MaximumWaitTime $maximumWaitTime -SemaphoreMessage $semaphoreMessage

    # Assert.
    Assert-WasCalled Push-Location -- -LiteralPath ([System.IO.Path]::GetTempPath()) -ErrorAction Stop
    Assert-WasCalled Lock-Semaphore -Share $share -MaximumWaitTime ([timespan]::FromMinutes(1)) -SemaphoreMessage $semaphoreMessage
    Assert-WasCalled SymstoreExe -- del /i $transactionId /s $share
    Assert-WasCalled Unlock-Semaphore -- $semaphore
    Assert-WasCalled Pop-Location
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}