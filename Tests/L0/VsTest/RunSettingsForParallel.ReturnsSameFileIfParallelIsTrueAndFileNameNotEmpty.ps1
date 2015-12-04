[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

$runSettingsForParallel = [xml]'<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
</RunSettings>
'
$runSettingsFilePath = [io.path]::GetTempFileName()
$runSettingsForParallel.Save($runSettingsFilePath)

. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1
$cpuCount="1"
$returnedFilePath = SetupRunSettingsFileForParallel "true" $runSettingsFilePath $cpuCount

$fileExists = Test-Path $returnedFilePath
Assert-IsTrue $fileExists
#cleanup
if($fileExists){
	Remove-Item $returnedFilePath
}

$readRunSettingsFile=[System.Xml.XmlDocument](Get-Content $returnedFilePath)
Assert.AreEqual $cpuCount $readRunSettingsFile.RunSettings.RunConfiguration.MaxCpuCount
