[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
$distributedTaskContext = 'Some distributed task context'
Register-Stub Get-Command
Register-Stub Get-TaskVariable
Register-Stub Join-Path
Register-Stub Test-Path
Register-Stub Find-Files
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
