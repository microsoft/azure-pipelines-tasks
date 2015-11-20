[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -VSVersion 'Some version'

# Assert.
Assert-AreEqual "Some arguments /p:VisualStudioVersion=`"Some version`"" $actual
