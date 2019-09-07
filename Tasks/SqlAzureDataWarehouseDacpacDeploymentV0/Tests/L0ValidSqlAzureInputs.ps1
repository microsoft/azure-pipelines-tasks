[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1

#Mock Vsts-Input
Register-Mock Get-VstsInput { "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceNameSelector" }
Register-Mock Get-VstsInput { "DacpacTask" } -ParametersEvaluator { $Name -eq "TaskNameSelector" }
Register-Mock Get-VstsInput { "DacpacFile.dacpac" } -ParametersEvaluator { $Name -eq "DacpacFile" }
Register-Mock Get-VstsInput { $databaseName } -ParametersEvaluator { $Name -eq "DatabaseName" }
Register-Mock Get-VstsInput { "Publish" } -ParametersEvaluator { $Name -eq "DeploymentAction" }
Register-Mock Get-VstsInput { $serverName } -ParametersEvaluator { $Name -eq "ServerName" }
Register-Mock Get-VstsInput { "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceNameARM" }
Register-Mock Get-VstsInput { $sqlUsername } -ParametersEvaluator { $Name -eq "SqlUsername" }
Register-Mock Get-VstsInput { $sqlPassword } -ParametersEvaluator { $Name -eq "SqlPassword" }
Register-Mock Get-VstsInput { $aadSqlUsername } -ParametersEvaluator { $Name -eq "AADSqlUsername" }
Register-Mock Get-VstsInput { $aadSqlPassword } -ParametersEvaluator { $Name -eq "AADSqlPassword" }
Register-Mock Get-VstsInput { "server" } -ParametersEvaluator { $Name -eq "TargetMethod" }
Register-Mock Get-VstsInput { "connectionString" } -ParametersEvaluator { $Name -eq "ConnectionString" }
Register-Mock Get-VstsInput { $publishProfile } -ParametersEvaluator { $Name -eq "PublishProfile" }
Register-Mock Get-VstsInput { "AdditionalArguments" } -ParametersEvaluator { $Name -eq "AdditionalArguments" }
Register-Mock Get-VstsInput { "InlineAdditionalArguments" } -ParametersEvaluator { $Name -eq "InlineAdditionalArguments" }
Register-Mock Get-VstsInput { $ipDetectionMethodRange } -ParametersEvaluator { $Name -eq "IpDetectionMethod" }
Register-Mock Get-VstsInput { $startIPAddress } -ParametersEvaluator { $Name -eq "StartIpAddress" }
Register-Mock Get-VstsInput { $endIPAddress } -ParametersEvaluator { $Name -eq "EndIpAddress" }
Register-Mock Remove-EndpointSecrets
Register-Mock Detect-AuthenticationType {return "server"}

Register-Mock Get-Endpoint { return $spnEndpoint }
Register-Mock Import-SqlPs { }

Register-Mock Add-FirewallRule { return "TestRule", $true }
Register-Mock Delete-AzureSqlDatabaseServerFirewallRule { }

Register-Mock Publish-Dacpac { }

& "$PSScriptRoot\..\DeploySqlAzure.ps1"

Assert-WasCalled Publish-Dacpac -Times 1
Assert-WasCalled Add-FirewallRule -Times 1
Assert-WasCalled Delete-AzureSqlDatabaseServerFirewallRule -Times 1
