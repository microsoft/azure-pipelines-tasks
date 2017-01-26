[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable

. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1

$cpuCount="1"
$curLoc = $pwd.Path
$tempDirName = [System.Guid]::NewGuid().ToString() + '.runsettings'
Set-Location $env:temp
$tempDir = New-Item -Type Directory -Name $tempDirName
Set-Location $curLoc

$returnedFilePath = SetupRunSettingsFileForParallel "true" $tempDir.FullName $cpuCount

$fileExists = Test-Path $returnedFilePath
Assert-AreEqual $true $fileExists

Assert-AreNotEqual $tempDir.FullName $returnedFilePath

$readRunSettingsFile=[System.Xml.XmlDocument](Get-Content $returnedFilePath)
Assert-AreEqual $cpuCount $readRunSettingsFile.RunSettings.RunConfiguration.MaxCpuCount

#cleanup
if($fileExists){
	Remove-Item $returnedFilePath
}
if(Test-Path $tempDir.FullName){
	Remove-Item $tempDir.FullName
}