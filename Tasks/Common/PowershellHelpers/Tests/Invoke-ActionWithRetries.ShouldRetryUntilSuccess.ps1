[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$global:retriesAttempted = 0
$action = {
    $global:retriesAttempted++
    if($global:retriesAttempted -eq 5) {
    return $true
    } else {
        throw [System.IO.FileNotFoundException] "File not found error!"
    }
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
& $module Invoke-ActionWithRetries -Action $action
Assert-AreEqual 5 $global:retriesAttempted "Number of retries not correct"
