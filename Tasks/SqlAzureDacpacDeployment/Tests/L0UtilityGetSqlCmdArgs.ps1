[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1


#path to Utility.ps1 for SqlAzureDacpacDeployment task
. "$PSScriptRoot\..\Utility.ps1"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -dacpacFile "azureDacpac.dacpac" -targetMethod "server" -serverName "yyy.database.windows.net" -databaseName "databaseName" -sqlUsername "sqlUsername" -sqlPassword "sqlPassword" -publishProfile "Profile.xml" -additionalArguments "Add_args"
Assert-AreEqual '/SourceFile:"azureDacpac.dacpac" /Action:Publish /TargetServerName:"yyy.database.windows.net" /TargetDatabaseName:"databaseName" /TargetUser:"sqlUsername" /TargetPassword:"sqlPassword" /Profile:"Profile.xml" Add_args' $sqlPackageCommandLineArguments "Should have constructed Argument for TargetMethod Server"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -dacpacFile "azureDacpac.dacpac" -targetMethod "server" -serverName "yyy.database.windows.net" -databaseName "databaseName" -sqlUsername "sqlUsername" -sqlPassword "sqlPassword" -publishProfile "Profile.xml" -additionalArguments "Add_args" -isOutputSecure
Assert-AreEqual '/SourceFile:"azureDacpac.dacpac" /Action:Publish /TargetServerName:"yyy.database.windows.net" /TargetDatabaseName:"databaseName" /TargetUser:"sqlUsername" /TargetPassword:"********" /Profile:"Profile.xml" Add_args' $sqlPackageCommandLineArguments "Should have mocked paasword"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -dacpacFile "azureDacpac.dacpac" -targetMethod "connectionString" -connectionString "connectionString:10/20/30" -publishProfile "Profile.xml" -additionalArguments "Add_args" -isOutputSecure
Assert-AreEqual '/SourceFile:"azureDacpac.dacpac" /Action:Publish /TargetConnectionString:"connectionString:10/20/30" /Profile:"Profile.xml" Add_args' $sqlPackageCommandLineArguments "Should have constructed Argument for Connection String"

Assert-Throws {
    Get-SqlPackageCommandArguments -dacpacFile "azureDacpac.dacpac" -targetMethod "connectionString" -connectionString "connectionString:10/20/30" -publishProfile "Profile.json" -additionalArguments "Add_args" -isOutputSecure
} -MessagePattern "*SAD_InvalidPublishProfile*"

Assert-Throws {
    Get-SqlPackageCommandArguments -dacpacFile "azureDacpac.sql" -targetMethod "connectionString" -connectionString "connectionString:10/20/30" -publishProfile "Profile.xml" -additionalArguments "Add_args" -isOutputSecure
} -MessagePattern "*SAD_InvalidDacpacFile*"
