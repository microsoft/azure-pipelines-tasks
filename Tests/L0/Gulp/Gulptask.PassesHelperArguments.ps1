[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-GulpCommand { @{ Path = 'Some path to gulp' } } -Arguments @( )
Register-Mock Format-ArgumentsParameter { 'Some formatted arguments' } -- -GulpFile 'Some gulp file' -Targets 'Some targets' -Arguments 'Some arguments'
Register-Mock Get-WorkingDirectoryParameter { 'Some other working directory' } -- -Cwd 'Some working directory'
Register-Stub Invoke-Tool

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -Cwd 'Some working directory' -GulpFile 'Some gulp file' -Targets 'Some targets' -Arguments 'Some arguments' -OmitDotSource $true

# Assert.
Assert-WasCalled Invoke-Tool -- -Path 'Some path to gulp' -Arguments 'Some formatted arguments' -WorkingFolder 'Some other working directory'
