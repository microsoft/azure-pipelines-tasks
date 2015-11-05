[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
$distributedTaskContext = 'Some distributed task context'
Register-Stub -Command 'Get-Command'
Register-Stub -Command 'Get-TaskVariable'
Register-Stub -Command 'Join-Path'
Register-Stub -Command 'Test-Path'
Register-Stub -Command 'Find-Files'
Register-Mock -Command 'Get-Command' -Arguments @(
        '-Name'
        'gulp'
        '-ErrorAction'
        'Stop'
    ) -Func {
        throw 'Some error message'
    }

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
