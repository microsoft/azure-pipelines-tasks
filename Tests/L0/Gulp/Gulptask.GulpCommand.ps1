[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Mock Get-GulpCommand { @{ Path = 'Some path to gulp' } } -Arguments @( )
Register-Stub Format-ArgumentsParameter
Register-Stub Get-WorkingDirectoryParameter
Register-Stub Invoke-Tool

# Act.
& $PSScriptRoot\..\..\..\Tasks\Gulp\Gulptask.ps1 -OmitDotSource $true

# Assert.
Assert-WasCalled Invoke-Tool -- -Path 'Some path to gulp' -Arguments $null -WorkingFolder $null
