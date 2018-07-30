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
    return $false
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
& $module Invoke-ActionWithRetries -Action $action -RetryableExceptions @("System.IO.IOException") -ExceptionRetryEvaluator $onException
Assert-AreEqual 1 $global:retriesAttempted "Number of retries not correct"
Assert-AreEqual $true $global:onExceptionCalled "ExceptionRetryEvaluator callback not called"
