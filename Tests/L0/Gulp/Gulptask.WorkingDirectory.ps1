[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Stub -Command 'Get-GulpCommand'
Register-Stub -Command 'Format-ArgumentsParameter'
Register-Mock -Command 'Get-WorkingDirectoryParameter' -Arguments @(
        '-Cwd'
        'Some working directory'
    ) -Func {
        'Some other working directory'
    }
Register-Stub -Command 'Invoke-Tool'

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -Cwd 'Some working directory' -OmitDotSource $true

# Assert.
Assert-WasCalled -Command 'Invoke-Tool' -Arguments @(
        '-Path'
        $null
        '-Arguments'
        $null
        '-WorkingFolder'
        'Some other working directory'
    )