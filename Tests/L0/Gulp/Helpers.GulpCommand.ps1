[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
Register-Mock -Command 'Get-Command' -Arguments @(
        '-Name'
        'gulp'
        '-ErrorAction'
        'SilentlyContinue'
    ) -Func {
        'Some gulp command'
    }

# Act.
$actual = Get-GulpCommand

# Assert.
Assert-AreEqual -Expected 'Some gulp command' -Actual $actual
