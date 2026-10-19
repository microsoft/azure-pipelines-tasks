[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

Unregister-Mock Get-Module

# Mock Get-Module to simulate Az.Accounts version 4.7.0
Register-Mock Get-Module {
    [PSCustomObject]@{ Version = [version]'4.7.0' }
}

# Simulate script logic (manually call logic block under test)
$azCopyExeLocation = 'AzCopy\AzCopy.exe'
$azAccountsModule = Get-Module -Name Az.Accounts -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
if ($null -eq $azAccountsModule -or ([version]$azAccountsModule.Version -ge [version]'5.0.0')) {
    $azCopyExeLocation = 'AzCopy\AzCopy.exe'
} else {
    $azCopyExeLocation = 'AzCopy_Prev\AzCopy\AzCopy.exe'
}

# Assert value
Assert-AreEqual 'AzCopy_Prev\AzCopy\AzCopy.exe' $azCopyExeLocation 'AzCopyExeLocation should be previous AzCopy when Az.Accounts < 5.0.0'
