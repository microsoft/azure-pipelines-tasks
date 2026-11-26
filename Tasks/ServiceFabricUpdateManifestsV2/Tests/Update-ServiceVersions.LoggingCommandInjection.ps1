[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-ServiceVersions.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

# The marker is in a folder name, so keep it short: Windows PowerShell 5.1 fails on directory paths of 248 characters or more.
$workRoot = "$PSScriptRoot\wSvc"
$newRoot = "$workRoot\new"
$oldRoot = "$workRoot\old"
$serviceName = 'Svc##vso[task.debug]x'
$inertServiceName = 'Svc##_vso[task.debug]x'

try
{
    # Arrange: the service folder name and the previous build's service version carry markers.
    New-Item -ItemType Directory -Path $newRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $oldRoot -Force | Out-Null
    Copy-Item -LiteralPath "$PSScriptRoot\data\CurrentPkg\Service1Pkg\" -Destination "$newRoot\Service1Pkg" -Container -Recurse
    Rename-Item -LiteralPath "$newRoot\Service1Pkg" -NewName $serviceName
    Copy-Item -LiteralPath "$PSScriptRoot\data\PreviousPkgXmlChanged\pkg\Service1Pkg\" -Destination "$oldRoot\Service1Pkg" -Container -Recurse
    Rename-Item -LiteralPath "$oldRoot\Service1Pkg" -NewName $serviceName

    $oldManifestPath = "$oldRoot\$serviceName\ServiceManifest.xml"
    $oldManifest = [xml](Get-Content -LiteralPath $oldManifestPath)
    $oldManifest.ServiceManifest.Version = '1.0.0.Old##vso[task.setvariable variable=P9]x'
    $oldManifest.Save($oldManifestPath)

    Register-Mock Update-PackageVersion { '1.0.0.OldSuffix' }
    Register-HostCapture

    # Act: the previous build is compared, and the service manifest differs.
    $null = Update-ServiceVersions -VersionValue '.NewSuffix' -ServiceName $serviceName -NewPackageRoot $newRoot -OldPackageRoot $oldRoot

    # Assert
    Assert-NoLiveLoggingCommands
    Assert-LogLineWritten "  SearchingService $inertServiceName"
    Assert-LogLineWritten "    ServiceManifestChanged $inertServiceName"
    Assert-LogLineWritten "    UpdatedServiceVerisonFromPrevious $inertServiceName 1.0.0.Old##_vso[task.setvariable variable=P9]x 1.0.0.NewSuffix"
}
finally
{
    Remove-Item -Recurse -Force -LiteralPath $workRoot -ErrorAction SilentlyContinue
}
