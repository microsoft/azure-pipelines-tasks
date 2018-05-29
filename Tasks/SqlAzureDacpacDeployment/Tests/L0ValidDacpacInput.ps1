[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#Mock Vsts-Input
Register-Mock Get-VstsInput { "ConnectedServiceName" } -ParametersEvaluator { $Name -eq "ConnectedServiceNameSelector" }
Register-Mock Get-VstsInput { "DacpacTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "DacpacFile.dacpac" } -ParametersEvaluator { $Name -eq "DacpacFile" }
Register-Mock Get-VstsInput { "SqlFile.sql" } -ParametersEvaluator { $Name -eq "SqlFile" }
Register-Mock Get-VstsInput { $databaseName } -ParametersEvaluator { $Name -eq "DatabaseName" }
Register-Mock Get-VstsInput { "Publish" } -ParametersEvaluator { $Name -eq "DeploymentAction" }
Register-Mock Get-VstsInput { $serverName } -ParametersEvaluator { $Name -eq "ServerName" }
Register-Mock Get-VstsInput { "ConnectedServiceName" } -ParametersEvaluator { $Name -eq "ConnectedServiceName" }
Register-Mock Get-VstsInput { "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceNameARM" }
Register-Mock Get-VstsInput { $sqlUsername } -ParametersEvaluator { $Name -eq "SqlUsername" }
Register-Mock Get-VstsInput { $sqlPassword } -ParametersEvaluator { $Name -eq "SqlPassword" }
Register-Mock Get-VstsInput { $publishProfile } -ParametersEvaluator { $Name -eq "PublishProfile" }
Register-Mock Get-VstsInput { "AdditionalArguments" } -ParametersEvaluator { $Name -eq "AdditionalArguments" }
Register-Mock Get-VstsInput { "InlineAdditionalArguments" } -ParametersEvaluator { $Name -eq "InlineAdditionalArguments" }
Register-Mock Get-VstsInput { $ipDetectionMethodRange } -ParametersEvaluator { $Name -eq "IpDetectionMethod" }
Register-Mock Get-VstsInput { $startIPAddress } -ParametersEvaluator { $Name -eq "StartIpAddress" }
Register-Mock Get-VstsInput { $endIPAddress } -ParametersEvaluator { $Name -eq "EndIpAddress" }
Register-Mock Get-VstsInput { $deleteFirewallRuleTrue } -ParametersEvaluator { $Name -eq "DeleteFirewallRule" }

Register-Mock Find-VstsFiles { "dacpacFile.dacpac" } -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "DacpacFile.dacpac" }
Register-Mock Find-VstsFiles { "PublishProfile.xml" } -ArgumentsEvaluator {$args.count -eq 2 -and $args[0] -like "LegacyPattern" -and $args[1] -like "C:\Test\publish.xml" }

Register-Mock Get-Endpoint { $usernameEndpoint } -ParametersEvaluator { $connectedServiceName  -eq "connectedServiceName"}
Register-Mock Import-SqlPs { }
Register-Mock Add-AzureSqlDatabaseServerFirewallRule { 
    $fireWallRule = @{ }
    $fireWallRule.RuleName = "Mock File Wall Rule Name"
    $fireWallRule.IsConfigured = $true;
    return $fireWallRule
} -ParametersEvaluator { $startIp -eq "StartIpAddress" -and $endIPAddress -eq "EndIpAddress" -and $serverName -eq $mockServerFriendlyName -and $endPoint -eq $usernameEndpoint }

Register-Mock Get-SqlPackageOnTargetMachine { 'path/to/dac/bin/sqlpackage.exe' }


Register-Mock Delete-AzureSqlDatabaseServerFirewallRule { }

Register-Mock Execute-Command { 'executed command ! '}  -ArgumentsEvaluator {
    $args.count -eq 2 -and $args[0] -eq 'path/to/dac/bin/sqlpackage.exe' -and $args[1] -eq '/SourceFile:"dacpacFile.dacpac" /Action:Publish /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /Profile:"PublishProfile.xml" AdditionalArguments /TargetTimeout:120'
}

Register-Mock Execute-Command { throw 'Invalid Command passed !' } -ArgumentsEvaluator {
    $args.count -eq 2 -and $args[0] -eq 'path/to/dac/bin/sqlpackage.exe' -and $args[1] -ne '/SourceFile:"dacpacFile.dacpac" /Action:Publish /TargetServerName:"a0nuel7r2k.database.windows.net" /TargetDatabaseName:"TestDatabase" /TargetUser:"TestUser" /TargetPassword:"TestPassword" /Profile:"PublishProfile.xml" AdditionalArguments /TargetTimeout:120'
}

& "$PSScriptRoot\..\DeploySqlAzure.ps1"

Assert-WasCalled Execute-Command -Times 1