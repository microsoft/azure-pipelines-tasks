[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$cpuCount="1"
$temptestsettingsfile = [io.path]::ChangeExtension([io.path]::GetTempFileName(),"testsettings")
$testsettings = @('<?xml version="1.0" encoding="utf-8"?> 
<TestSettings name="Empty Test Settings">
  <Description>Empty testsettings</Description>
</TestSettings>
')
Set-Content -Value $testsettings -Path $temptestsettingsfile

$returnedFilePath = SetupRunSettingsFileForParallel "true" $temptestsettingsfile $cpuCount

$fileExists = Test-Path $returnedFilePath
Assert-AreEqual $true $fileExists

Assert-AreEqual $temptestsettingsfile $returnedFilePath

#cleanup
if($fileExists){
	Remove-Item $returnedFilePath
}
if(Test-Path $temptestsettingsfile){
	Remove-Item $temptestsettingsfile
}