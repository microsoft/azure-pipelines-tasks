[CmdletBinding()]
param(
    [string]
    $ExpectedSuffix = $null,

    [switch]
    $CurrentCodePackageExists,

    [switch]
    $PreviousCodePackageExists
)

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-PackageVersion.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

# Arrange.
Register-Mock Test-Path { $true } -- -LiteralPath "$PSScriptRoot\data\CurrentPkg"
Register-Mock Test-Path { $true } -- -LiteralPath "$PSScriptRoot\data\PreviousPkg"
Register-Mock Test-Path { $CurrentCodePackageExists } -- -LiteralPath "$PSScriptRoot\data\CurrentPkg\Code"
Register-Mock Test-Path { $PreviousCodePackageExists } -- -LiteralPath "$PSScriptRoot\data\PreviousPkg\Code"
Register-Mock Find-FileChanges { $false } -- "$PSScriptRoot\data\CurrentPkg\Config" "$PSScriptRoot\data\PreviousPkg\Config" "  " -LogAllChanges:$false
Register-Mock Find-FileChanges { $false } -- "$PSScriptRoot\data\CurrentPkg\Data" "$PSScriptRoot\data\PreviousPkg\Data" "  " -LogAllChanges:$false

$xml = ([xml]'<CodePackage Name="Code" Version="1.0.0"></CodePackage>').CodePackage
$oldXmlList = @( $xml )

# Act
$result = Update-PackageVersion -VersionValue ".NewSuffix" -ServiceName "Service1Pkg" -NewPackageXml $xml -NewPackageRoot "$PSScriptRoot\data\CurrentPkg" -OldPackageXmlList $oldXmlList -OldPackageRoot "$PSScriptRoot\data\PreviousPkg"

# Assert
Assert-AreEqual "1.0.0$ExpectedSuffix" $result "Package version did not match."