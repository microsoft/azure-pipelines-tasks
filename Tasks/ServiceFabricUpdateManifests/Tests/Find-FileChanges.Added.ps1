[CmdletBinding()]
param()

$newFiles = @("A.dll", "B.dll", "C.dll", "D.dll", "E.dll")
$oldFiles = @("B.dll", "D.dll")
. "$PSScriptRoot\Test-FileChanges.ps1" -ExpectedResult $true -NewFiles $newFiles -OldFiles $oldFiles -ExpectedLogKey FileAdded -ExpectedLogCalls 3 -ExpectedFileEqualCalls 2 -LogAllChanges