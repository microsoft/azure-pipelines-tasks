[CmdletBinding()]
param()

$newFiles = @("A.dll", "C.dll")
$oldFiles = @("A.dll", "B.dll", "C.dll", "D.dll")
$changedFiles = @( "A.dll", "C.dll" )
. "$PSScriptRoot\Test-FileChanges.ps1" -ExpectedResult $true -NewFiles $newFiles -OldFiles $oldFiles -ExpectedLogKey FileChanged -ExpectedLogCalls 1 -ExpectedFileEqualCalls 1 -ChangedFiles $changedFiles