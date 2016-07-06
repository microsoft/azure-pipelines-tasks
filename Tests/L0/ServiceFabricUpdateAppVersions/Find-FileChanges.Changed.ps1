[CmdletBinding()]
param()

$newFiles = @("A.dll", "B.dll")
$oldFiles = @("A.dll", "B.dll")
$changedFiles = @( "A.dll", "B.dll" )
. "$PSScriptRoot\Test-FileChanges.ps1" -ExpectedResult $true -NewFiles $newFiles -OldFiles $oldFiles -ExpectedLogKey FileChanged -ExpectedLogCalls 2 -ExpectedFileEqualCalls 2 -ChangedFiles $changedFiles -LogAllChanges