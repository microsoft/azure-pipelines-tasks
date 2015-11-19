[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

# Assert.
Assert-Parses -Path $PSScriptRoot\..\..\..\Tasks\Gulp\*.ps1
