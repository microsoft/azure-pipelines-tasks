[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
$distributedTaskContext = 'Some distributed task context'
Register-Stub -Command 'Get-Command'
Register-Mock -Command 'Get-TaskVariable' -Arguments @(
        '-Context',
        $distributedTaskContext
        '-Name'
        'Build.SourcesDirectory'
    ) -Func {
        'c:\some build sources directory'
    }
Register-Stub -Command 'Test-Path'
Register-Mock -Command 'Find-Files' -Arguments @(
        '-SearchPattern'
        'c:\some build sources directory\**\gulp.cmd'
    ) -Func {
        'c:\some build sources directory\nested directory\gulp.cmd'
    }
Register-Mock -Command 'Get-Command' -Arguments @(
        '-Name'
        'c:\some build sources directory\nested directory\gulp.cmd'
    ) -Func {
        'Some sources directory gulp command'
    }

# Act.
$actual = Get-GulpCommand

# Assert.
Assert-AreEqual -Expected 'Some sources directory gulp command' -Actual $actual
