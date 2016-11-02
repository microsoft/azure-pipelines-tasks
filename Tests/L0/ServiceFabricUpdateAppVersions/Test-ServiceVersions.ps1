[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $ExpectedServiceSuffix,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $PreviousPkgName,

    [switch]
    $CodeChanged,

    [switch]
    $NoChanges
)

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\..\..\..\Tasks\ServiceFabricUpdateAppVersions"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ServiceVersions.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

$appPkgPath = "$PSScriptRoot\pkg"

try
{
    # Arrange.

    # Setup working package folder
    Copy-Item "$PSScriptRoot\data\CurrentPkg\" -Destination $appPkgPath -Container -Recurse

    $newSuffix = ".NewSuffix"
    $oldSuffix = ".OldSuffix"
    $serviceName = "Service1Pkg"

    if ($CodeChanged)
    {
        $expectedCodeSuffix = $newSuffix
        Register-Mock Update-PackageVersion { "1.0.0$newSuffix" } -ArgumentsEvaluator { $args[5].Name -eq "Code" }
        Register-Mock Update-PackageVersion { "1.0.0$oldSuffix" } -ArgumentsEvaluator { $args[5].Name -ne "Code" }
    }
    else
    {
        $expectedCodeSuffix = $oldSuffix
        Register-Mock Update-PackageVersion { "1.0.0$oldSuffix" }
    }

    # Act
    $result = Update-ServiceVersions -VersionValue $newSuffix -ServiceName $serviceName -NewPackageRoot $appPkgPath -OldPackageRoot "$PSScriptRoot\data\$PreviousPkgName\pkg"
    
    # Assert
    Assert-AreEqual "1.0.0$ExpectedServiceSuffix" $result "Function returned incorrect result."
    $serviceManifest = [xml](Get-Content "$appPkgPath\$serviceName\ServiceManifest.xml")
    Assert-AreEqual "1.0.0$ExpectedServiceSuffix" $serviceManifest.ServiceManifest.Version "Service version in manifest did not match."
    Assert-AreEqual "1.0.0$expectedCodeSuffix" $serviceManifest.ServiceManifest.CodePackage.Version "Code package version in manifest did not match."
    Assert-AreEqual "1.0.0$oldSuffix" $serviceManifest.ServiceManifest.ConfigPackage.Version "Config package version in manifest did not match."
    Assert-AreEqual "1.0.0$oldSuffix" $serviceManifest.ServiceManifest.DataPackage.Version "Data package version in manifest did not match."
}
finally
{
    Remove-Item -Recurse -Force $appPkgPath
}