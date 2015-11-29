[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }

# Act/Assert.
Assert-Throws { Get-SolutionFiles -Solution '' }
