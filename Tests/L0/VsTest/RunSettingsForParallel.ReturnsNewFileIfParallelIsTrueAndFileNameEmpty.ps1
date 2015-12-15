[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

$runSettingsFilePath=""
. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1
$returnedFilePath = SetupRunSettingsFileForParallel "true" $runSettingsFilePath "1" 
Assert-AreNotEqual $runSettingsFilePath $returnedFilePath

$fileExists = Test-Path $returnedFilePath
Assert-AreEqual $true $fileExists

#cleanup
if($fileExists){
	Remove-Item $returnedFilePath
}