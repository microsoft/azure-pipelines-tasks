[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

Register-Mock Get-UserAgentString { '' }

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -Platform 'Some platform'

# Assert.
Assert-AreEqual "Some arguments /p:platform=`"Some platform`"" $actual
