[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Mock -Command 'Get-GulpCommand' -Arguments @( ) -Func { @{ Path = 'Some path to gulp' } }
Register-Stub -Command 'Format-ArgumentsParameter'
Register-Stub -Command 'Get-WorkingDirectoryParameter'
Register-Stub -Command 'Invoke-Tool'

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -OmitDotSource $true

# Assert.
Assert-WasCalled -Command 'Invoke-Tool' -Arguments @(
        '-Path'
        'Some path to gulp'
        '-Arguments'
        $null
        '-WorkingFolder'
        $null
    )