[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$global:retriesAttempted = 0
$action = {
    $global:retriesAttempted++
    throw [System.AccessViolationException] "Access denied!"
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
Assert-Throws {
    & $module Invoke-ActionWithRetries -Action $action -RetryableExceptions @("System.IO.IOException")
} -MessagePattern "Access denied!"
Assert-AreEqual 1 $global:retriesAttempted "Number of retries not correct"
