[CmdletBinding()]
param()

$newFiles = @("A.dll", "B.dll")
$oldFiles = @("A.dll", "B.dll")
. "$PSScriptRoot\Test-FileChanges.ps1" -ExpectedResult $false -NewFiles $newFiles -OldFiles $oldFiles -ExpectedFileEqualCalls 2