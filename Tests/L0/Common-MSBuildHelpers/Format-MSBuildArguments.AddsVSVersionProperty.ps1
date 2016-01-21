[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -VSVersion 'Some version'

# Assert.
Assert-AreEqual "Some arguments /p:VisualStudioVersion=`"Some version`"" $actual
