[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

$runSettingsFilePath="c:\temp"
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1
$returnedFilePath = SetupRunSettingsFileForParallel "false" $runSettingsFilePath "1" 
Assert-AreEqual $runSettingsFilePath $returnedFilePath