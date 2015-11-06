[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Stub Get-GulpCommand
Register-Mock Format-ArgumentsParameter { 'Some formatted arguments' } -- -GulpFile 'Some gulp file' -Targets 'Some targets' -Arguments 'Some arguments'
Register-Stub Get-WorkingDirectoryParameter
Register-Stub Invoke-Tool

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -GulpFile 'Some gulp file' -Targets 'Some targets' -Arguments 'Some arguments' -OmitDotSource $true

# Assert.
Assert-WasCalled Invoke-Tool -- -Path $null -Arguments 'Some formatted arguments' -WorkingFolder $null
