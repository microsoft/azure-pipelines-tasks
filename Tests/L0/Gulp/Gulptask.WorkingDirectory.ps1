[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Stub Get-GulpCommand
Register-Stub Format-ArgumentsParameter
Register-Mock Get-WorkingDirectoryParameter { 'Some other working directory' } -- -Cwd 'Some working directory'
Register-Stub Invoke-Tool

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -Cwd 'Some working directory' -OmitDotSource $true

# Assert.
Assert-WasCalled Invoke-Tool -- -Path $null -Arguments $null -WorkingFolder 'Some other working directory'
