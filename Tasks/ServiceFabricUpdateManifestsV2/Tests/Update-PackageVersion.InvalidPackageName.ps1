[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$newPackageRoot = "$PSScriptRoot\NewPackageRoot"
$oldPackageRoot = "$PSScriptRoot\OldPackageRoot"

try
{
    New-Item -ItemType Directory -Path $newPackageRoot | Out-Null
    New-Item -ItemType Directory -Path $oldPackageRoot | Out-Null

    [xml] $newPackageDocument = '<CodePackage Name="..\OutsidePackage" Version="1.0.0" />'
    [xml] $oldPackageDocument = '<CodePackage Name="..\OutsidePackage" Version="1.0.0" />'

    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-PackageVersion.psm1"
    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Test-XmlEqual.psm1"

    $errorMessage = $null
    try
    {
        Update-PackageVersion -VersionValue '.NewSuffix' -ServiceName 'Service1Pkg' -NewPackageXml $newPackageDocument.DocumentElement -NewPackageRoot $newPackageRoot -OldPackageXmlList @($oldPackageDocument.DocumentElement) -OldPackageRoot $oldPackageRoot
    }
    catch
    {
        $errorMessage = $_.Exception.Message
    }

    Assert-AreEqual 'InvalidManifestPathSegment CodePackage/@Name ..\OutsidePackage' $errorMessage
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $newPackageRoot -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force -LiteralPath $oldPackageRoot -ErrorAction SilentlyContinue
}
