[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$global:retriesAttempted = 0
$action = {
    $global:retriesAttempted++
    if ($global:retriesAttempted -eq 5)
    {
        return $true
    }
    elseif ($global:retriesAttempted -eq 2)
    {
        throw [System.IO.FileNotFoundException] "File not found error!"
    }
    else
    {
        throw [System.IO.DirectoryNotFoundException] "dir not found error!"
    }
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
& $module Invoke-ActionWithRetries -Action $action -RetryableExceptions @("System.IO.FileNotFoundException", "System.IO.DirectoryNotFoundException")
Assert-AreEqual 5 $global:retriesAttempted "Number of retries not correct"
