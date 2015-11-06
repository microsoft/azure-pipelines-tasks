[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Stub -Command 'Get-GulpCommand'
Register-Mock -Command 'Format-ArgumentsParameter' -Arguments @(
        '-GulpFile'
        'Some gulp file'
        '-Targets'
        'Some targets'
        '-Arguments'
        'Some arguments'
    ) -Func {
        'Some formatted arguments'
    }
Register-Stub -Command 'Get-WorkingDirectoryParameter'
Register-Stub -Command 'Invoke-Tool'

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -GulpFile 'Some gulp file' -Targets 'Some targets' -Arguments 'Some arguments' -OmitDotSource $true

# Assert.
Assert-WasCalled -Command 'Invoke-Tool' -Arguments @(
        '-Path'
        $null
        '-Arguments'
        'Some formatted arguments'
        '-WorkingFolder'
        $null
    )