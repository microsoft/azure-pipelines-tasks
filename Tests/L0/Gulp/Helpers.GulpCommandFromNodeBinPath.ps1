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
Register-Mock -Command 'Test-Path' -Arguments @(
        '-LiteralPath'
        'c:\some build sources directory\node_modules\.bin\gulp.cmd'
        '-PathType'
        'Leaf'
    ) -Func {
        $true
    }
Register-Mock -Command 'Get-Command' -Arguments @(
        '-Name'
        'c:\some build sources directory\node_modules\.bin\gulp.cmd'
    ) -Func {
        'Some node bin gulp command'
    }

# Act.
$actual = Get-GulpCommand

# Assert.
Assert-AreEqual -Expected 'Some node bin gulp command' -Actual $actual
