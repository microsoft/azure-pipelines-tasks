[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$global:retriesAttempted = 0
$global:onExceptionCalled = $false

$action = {
    $global:retriesAttempted++
    throw [System.IO.FileNotFoundException] "File not found error!"
}

$onException = {
    $global:onExceptionCalled = $true
    return $true
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
Assert-Throws {
    & $module Invoke-ActionWithRetries -Action $action -RetryableExceptions @("System.IO.IOException") -ExceptionRetryEvaluator $onException
} -MessagePattern "File not found error!"
Assert-AreEqual 10 $global:retriesAttempted "Number of retries not correct"
Assert-AreEqual $true $global:onExceptionCalled "ExceptionRetryEvaluator callback not called"
