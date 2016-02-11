[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-Command
Register-Mock Get-TaskVariable
Register-Mock Join-Path
Register-Mock Test-Path
Register-Mock Find-Files
Register-Mock Get-Command { throw 'Some error message' } -- -Name 'gulp' -ErrorAction 'Stop'

# Act.
$exception = $null
try {
    Get-GulpCommand
} catch {
    $exception = $_.Exception
}

# Assert.
Assert-AreNotEqual -NotExpected $null -Actual $exception -Message 'Expected Get-GulpCommand to throw.'
Assert-AreEqual -Expected 'Some error message' -Actual $exception.Message
