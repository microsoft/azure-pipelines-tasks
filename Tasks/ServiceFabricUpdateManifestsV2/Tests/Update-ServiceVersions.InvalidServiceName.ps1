[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$pkgPath = "$PSScriptRoot\pkg"
$outsideServicePath = "$PSScriptRoot\OutsideService"

try
{
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\" -Destination $pkgPath -Container -Recurse
    Copy-Item -LiteralPath "$pkgPath\Service1Pkg" -Destination $outsideServicePath -Container -Recurse

    $outsideManifestPath = "$outsideServicePath\ServiceManifest.xml"
    $outsideManifestBefore = Get-Content -LiteralPath $outsideManifestPath -Raw

    Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Update-ServiceVersions.psm1"

    $errorMessage = $null
    try
    {
        Update-ServiceVersions -VersionValue '.NewSuffix' -ServiceName '..\OutsideService' -NewPackageRoot $pkgPath -UpdateAllVersions
    }
    catch
    {
        $errorMessage = $_.Exception.Message
    }

    Assert-AreEqual 'InvalidManifestPathSegment ServiceManifestRef/@ServiceManifestName ..\OutsideService' $errorMessage
    Assert-AreEqual $outsideManifestBefore (Get-Content -LiteralPath $outsideManifestPath -Raw) "The service manifest outside the application package was modified."
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $pkgPath -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force -LiteralPath $outsideServicePath -ErrorAction SilentlyContinue
}
