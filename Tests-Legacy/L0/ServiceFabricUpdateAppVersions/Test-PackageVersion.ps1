[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $expectedSuffix,

    [string]
    $OldXmlString,

    [switch]
    $FilesChanged
)

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\..\..\..\Tasks\ServiceFabricUpdateAppVersions"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-PackageVersion.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

# Arrange.

Register-Mock Find-FileChanges { $FilesChanged }

$xml = ([xml]'<CodePackage Name="Code" Version="1.0.0"></CodePackage>').CodePackage
$oldXmlList = @( ([xml]$OldXmlString).CodePackage )

# Act
$result = Update-PackageVersion -VersionValue ".NewSuffix" -ServiceName "Service1Pkg" -NewPackageXml $xml -NewPackageRoot "$PSScriptRoot\data\CurrentPkg" -OldPackageXmlList $oldXmlList -OldPackageRoot "$PSScriptRoot\data\PreviousPkg"

# Assert
Assert-AreEqual "1.0.0$expectedSuffix" $result "Package version did not match."