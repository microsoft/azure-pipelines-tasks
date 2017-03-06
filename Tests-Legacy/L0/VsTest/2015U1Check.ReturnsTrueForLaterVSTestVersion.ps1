[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
Register-Mock Get-TaskVariable
$vstestVersion = "15"
Register-Mock SetRegistryKeyForParallel { } -- -vsTestVersion $vstestVersion 
$path="$env:VS140COMNTools\..\IDE\CommonExtensions\Microsoft\TestWindow\TE.TestModes.dll"
Register-Mock Test-Path { $false } -- -Path $path

. $PSScriptRoot\..\..\..\Tasks\VsTest\Helpers.ps1
$isVS2015Installed = IsVisualStudio2015Update1OrHigherInstalled $vstestVersion
Assert-AreEqual $isVS2015Installed $true