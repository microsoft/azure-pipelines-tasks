[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\CommonFunctions.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishHelpers\UnpublishFunctions.ps1
Write-Verbose ($share = [System.IO.Path]::Combine($env:TMP, ([System.IO.Path]::GetRandomFileName())))
$transactionId = 'Some transaction ID'
$maximumWaitTime = [timespan]::FromSeconds(2)
$semaphoreMessage = 'Some semaphore message'
$semaphore = New-Object psobject
Register-Mock Lock-Semaphore { $semaphore }
Register-Mock Get-SymStorePath { 'Some path to symstore.exe' }
Register-Mock Invoke-VstsTool
Register-Mock Unlock-Semaphore
try {
    $null = [System.IO.Directory]::CreateDirectory($share)

    # Act.
    Invoke-UnpublishSymbols -Share $share -TransactionId $transactionId -MaximumWaitTime $maximumWaitTime -SemaphoreMessage $semaphoreMessage

    # Assert.
    Assert-WasCalled Lock-Semaphore -Share $share -MaximumWaitTime ([timespan]::FromMinutes(1)) -SemaphoreMessage $semaphoreMessage
    Assert-WasCalled Invoke-VstsTool -- -FileName 'Some path to symstore.exe' -Arguments "del /i ""$transactionId"" /s ""$share""" -WorkingDirectory ([System.IO.Path]::GetTempPath()) -RequireExitCodeZero
    Assert-WasCalled Unlock-Semaphore -- $semaphore
} finally {
    if (Test-Path -LiteralPath $share) { Remove-Item -LiteralPath $share -Recurse }
}