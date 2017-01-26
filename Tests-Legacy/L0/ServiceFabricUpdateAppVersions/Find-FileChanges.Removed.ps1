[CmdletBinding()]
param()

$newFiles = @("B.dll", "D.dll")
$oldFiles = @("A.dll", "B.dll", "C.dll", "D.dll", "E.dll")
. "$PSScriptRoot\Test-FileChanges.ps1" -ExpectedResult $true -NewFiles $newFiles -OldFiles $oldFiles -ExpectedLogKey FileRemoved -ExpectedLogCalls 3 -ExpectedFileEqualCalls 2 -LogAllChanges