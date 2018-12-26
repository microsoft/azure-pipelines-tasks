[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. "$PSScriptRoot\..\Utility.ps1"

$dacpacFilePath = "C:\Test\DB.dacpac"
$publishProfilePath = "C:\Test\Profile.xml"
$targetDacpacFilePath = "C:\Test\DB.dacpac"
$targetBacpacFilePath = "C:\Test\DB.bacpac"
$outputXmlPath = "C:\Test\Output.xml"
$outputSqlPath = "C:\Test\Output.sql"
$sqlpackageAdditionalArguments = "/AddArgs:args"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Publish action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Extract" -targetFile $targetDacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Extract /TargetFile:"C:\Test\DB.dacpac" /SourceServerName:"a0nuel7r2k.database.windows.net" /SourceDatabaseName:"TestDatabase" /SourceUser:"TestUser" /SourcePassword:"TestPassword" /AddArgs:args' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Extract action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Export" -targetFile $targetBacpacFilePath -sourceServerName $serverName -sourceDatabaseName $databaseName -sourceUser $sqlUsername -sourcePassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Export /TargetFile:"C:\Test\DB.bacpac" /SourceServerName:"a0nuel7r2k.database.windows.net" /SourceDatabaseName:"TestDatabase" /SourceUser:"TestUser" /SourcePassword:"TestPassword" /AddArgs:args' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Export action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Import" -sourceFile $bacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Import /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Import action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "DeployReport" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:DeployReport /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /OutputPath:"C:\Test\Output.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for DeployReport action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "DriftReport" -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputXmlPath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:DriftReport /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /OutputPath:"C:\Test\Output.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for DriftReport action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Script" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser $sqlUsername -targetPassword $sqlPassword -outputPath $outputSqlPath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Script /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /OutputPath:"C:\Test\Output.sql" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Script action"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser "sql@Username" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"sql@Username@a0nuel7r2k.database.windows.net" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should handle username with @ special character for TargetMethod Server"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser "sql@Username" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments -isOutputSecure
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"sql@Username@a0nuel7r2k.database.windows.net" /TargetPassword:"********" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should handle mocked password"
# username contains '@'
$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser "user@sql" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"user@sql@a0nuel7r2k.database.windows.net" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for TargetMethod Server"

# username contains sql servername in FQDN format
$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser "sqluser@a0nuel7r2k.database.windows.net" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"sqluser@a0nuel7r2k.database.windows.net" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for TargetMethod Server when usename cantains sql servername in FQDN format"

# username contains sql servername without FQDN format
$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName $serverName -targetDatabaseName $databaseName -targetUser "sqluser@a0nuel7r2k" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"sqluser@a0nuel7r2k" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for TargetMethod Server when usename cantains sql servername without FQDN format"

# $sql servername is being given in FQDN format with port and username contains '@'
$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName "yyy.database.windows.net,1433" -targetDatabaseName $databaseName -targetUser "user@sql@yyy.database.windows.net,1433" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"yyy.database.windows.net,1433" /TargetDatabaseName:"TestDatabase" /TargetUser:"user@sql@yyy.database.windows.net,1433@a0nuel7r2k.database.windows.net" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for TargetMethod Server when sql servername is being given in FQDN format with port and username contains '@'"

# $sql servername is being given in FQDN format with port and username contains servername without FQDN
$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "server" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -targetServerName "yyy.database.windows.net,1433" -targetDatabaseName $databaseName -targetUser "sqluser@yyy" -targetPassword $sqlPassword -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetServerName:"yyy.database.windows.net,1433" /TargetDatabaseName:"TestDatabase" /TargetUser:"sqluser@yyy@a0nuel7r2k.database.windows.net" /TargetPassword:"TestPassword" /Profile:"C:\Test\Profile.xml" /AddArgs:args /TargetTimeout:120' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for TargetMethod Server when sql servername is being given in FQDN format with port and username contains servername without FQDN"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "ConnectionString" -targetConnectionString "connectionString:10/20/30" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /TargetConnectionString:"connectionString:10/20/30" /Profile:"C:\Test\Profile.xml" /AddArgs:args' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Connection String"

$sqlPackageCommandLineArguments = Get-SqlPackageCommandArguments -authenticationType "ConnectionString" -sourceConnectionString "connectionString:10/20/30" -sqlpackageAction "Publish" -sourceFile $dacpacFilePath -publishProfile $publishProfilePath -additionalArguments $sqlpackageAdditionalArguments
Assert-AreEqual '/Action:Publish /SourceFile:"C:\Test\DB.dacpac" /SourceConnectionString:"connectionString:10/20/30" /Profile:"C:\Test\Profile.xml" /AddArgs:args' `
                                    $sqlPackageCommandLineArguments "Should have constructed Argument for Connection String"

Assert-Throws {
    Get-SqlPackageCommandArguments -sourceFile $dacpacFilePath -authenticationType "connectionString" -connectionString "connectionString:10/20/30" -publishProfile "Profile.json" `
                                    -additionalArguments "Add_args" -isOutputSecure
} -MessagePattern "*SAD_InvalidPublishProfile*"
