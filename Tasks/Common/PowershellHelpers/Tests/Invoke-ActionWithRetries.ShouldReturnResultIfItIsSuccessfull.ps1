[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$global:retriesAttempted = 0
$action = {
    $global:retriesAttempted++
    if($global:retriesAttempted -eq 5) {
        return "success"
    } else {
        return "failure"
    }
}

$successEvaluator = {
    param($result)
    if($result -eq "success") { return $true }
    return $false
}

Register-Mock Set-UserAgent
Unregister-Mock Start-Sleep
Register-Mock Start-Sleep {}

# Act/Assert.
$actionResult = & $module Invoke-ActionWithRetries -Action $action -ActionSuccessValidator $successEvaluator
Assert-AreEqual "success" $actionResult "action result should be success"
Assert-AreEqual 5 $global:retriesAttempted "Number of retries not correct"
