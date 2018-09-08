[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\FindSqlPackagePath.ps1

Register-Mock Locate-HighestVersionSqlPackageWithSql { "sqlpackage_sqlpath", 2 }
Register-Mock Locate-HighestVersionSqlPackageWithDacMsi { "sqlpackage_sqldacmsipath", 2 }
Register-Mock Locate-HighestVersionSqlPackageInVS { "sqlpackage_vspath", 2 }

$sqlpkgpath = Get-SqlPackageOnTargetMachine

Assert-AreEqual  $sqlpkgpath "sqlpackage_sqldacmsipath"
