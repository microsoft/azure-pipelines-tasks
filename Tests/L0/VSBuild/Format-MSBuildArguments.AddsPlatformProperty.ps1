[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1

# Act.
$actual = Format-MSBuildArguments -MSBuildArguments 'Some arguments' -Platform 'Some platform'

# Assert.
Assert-AreEqual "Some arguments /p:platform=`"Some platform`"" $actual
