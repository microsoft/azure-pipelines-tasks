[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$global:retriesAttempted = 0
$action = {
    $global:retriesAttempted++
    return "some-result"
}

$retryEvaluator = {
    param($result)
    return $true
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
Assert-Throws {
    & $module Invoke-ActionWithRetries -Action $action -ResultRetryEvaluator $retryEvaluator
} -MessagePattern "ActionTimedOut"
Assert-AreEqual 10 $global:retriesAttempted "Number of retries not correct"
