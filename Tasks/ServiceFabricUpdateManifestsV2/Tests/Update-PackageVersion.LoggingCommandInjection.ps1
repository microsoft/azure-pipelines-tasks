[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

$taskPath = "$PSScriptRoot\.."
Microsoft.PowerShell.Core\Import-Module "$taskPath\Update-PackageVersion.psm1"
Microsoft.PowerShell.Core\Import-Module "$taskPath\Test-XmlEqual.psm1"

$serviceName = 'Svc##vso[task.setvariable variable=P3]x'
$inertServiceName = 'Svc##_vso[task.setvariable variable=P3]x'
$packageName = 'Code##vso[task.setvariable variable=P5]x'
$inertPackageName = 'Code##_vso[task.setvariable variable=P5]x'

Register-Mock Test-Path { $true }
Register-Mock Find-FileChanges { $true }
Register-HostCapture

# Act 1: the previous build is compared and the package manifest differs.
$newXml = ([xml]"<CodePackage Name=`"$packageName`" Version=`"1.0.0`"></CodePackage>").CodePackage
$oldXml = ([xml]"<CodePackage Name=`"$packageName`" Version=`"1.0.0.Old##vso[task.setvariable variable=P9]x`" Extra=`"1`"></CodePackage>").CodePackage
$null = Update-PackageVersion -VersionValue '.NewSuffix' -ServiceName $serviceName -NewPackageXml $newXml -NewPackageRoot "$PSScriptRoot\data\CurrentPkg" -OldPackageXmlList @($oldXml) -OldPackageRoot "$PSScriptRoot\data\PreviousPkg"

# Act 2: every version is updated.
$newXml = ([xml]"<CodePackage Name=`"$packageName`" Version=`"1.0.0`"></CodePackage>").CodePackage
$null = Update-PackageVersion -VersionValue '.NewSuffix' -ServiceName $serviceName -NewPackageXml $newXml -NewPackageRoot "$PSScriptRoot\data\CurrentPkg" -UpdateAllVersions

# Assert
Assert-NoLiveLoggingCommands
Assert-LogLineWritten "  SearchingPackage $inertPackageName"
Assert-LogLineWritten "    PackageManifestChanged $inertPackageName"
Assert-LogLineWritten "    UpdatedPackageVerisonFromPrevious $inertServiceName $inertPackageName 1.0.0.Old##_vso[task.setvariable variable=P9]x 1.0.0.NewSuffix"
Assert-LogLineWritten "  UpdatedPackageVerison $inertServiceName $inertPackageName 1.0.0.NewSuffix"
