[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\FindSqlPackagePath.ps1

$sqlPackageVsPath = "sqlpackage_vspath"
$sqlPackageSqlServerPath = "sqlpackage_sqlpath"
$sqlPackageSqlDacMsiPath = "sqlpackage_sqldacmsipath"

Register-Mock Locate-HighestVersionSqlPackageWithSql { $sqlPackageSqlServerPath, 1 }
Register-Mock Locate-HighestVersionSqlPackageWithDacMsi { $sqlPackageSqlDacMsiPath, 2 }
Register-Mock Locate-HighestVersionSqlPackageInVS { $sqlPackageVsPath, 3 }

$sqlpkgpath = Get-SqlPackageOnTargetMachine

Assert-AreEqual  $sqlpkgpath $sqlPackageVsPath

Unregister-Mock Locate-HighestVersionSqlPackageWithSql
Unregister-Mock Locate-HighestVersionSqlPackageWithDacMsi
Unregister-Mock Locate-HighestVersionSqlPackageInVS

Register-Mock Locate-HighestVersionSqlPackageWithSql { $sqlPackageSqlServerPath, 1 }
Register-Mock Locate-HighestVersionSqlPackageWithDacMsi { $sqlPackageSqlDacMsiPath, 3 }
Register-Mock Locate-HighestVersionSqlPackageInVS { $sqlPackageVsPath, 2 }

$sqlpkgpath = Get-SqlPackageOnTargetMachine

Assert-AreEqual  $sqlpkgpath $sqlPackageSqlDacMsiPath

Unregister-Mock Locate-HighestVersionSqlPackageWithSql
Unregister-Mock Locate-HighestVersionSqlPackageWithDacMsi
Unregister-Mock Locate-HighestVersionSqlPackageInVS

Register-Mock Locate-HighestVersionSqlPackageWithSql { $sqlPackageSqlServerPath, 3 }
Register-Mock Locate-HighestVersionSqlPackageWithDacMsi { $sqlPackageSqlDacMsiPath, 1 }
Register-Mock Locate-HighestVersionSqlPackageInVS { $sqlPackageVsPath, 2 }

$sqlpkgpath = Get-SqlPackageOnTargetMachine

Assert-AreEqual  $sqlpkgpath $sqlPackageSqlServerPath