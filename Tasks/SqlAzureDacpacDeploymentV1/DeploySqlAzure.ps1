[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$connectedServiceNameSelector = Get-VstsInput -Name "ConnectedServiceNameSelector" -Require
$taskNameSelector = Get-VstsInput -Name "TaskNameSelector" -Require
$dacpacFile = Get-VstsInput -Name "DacpacFile"
$sqlFile = Get-VstsInput -Name "SqlFile"
$sqlInline = Get-VstsInput -Name "SqlInline"
$bacpacFile = Get-VstsInput -Name "BacpacFile"
$serverName = Get-VstsInput -Name  "ServerName"
$databaseName = Get-VstsInput -Name "DatabaseName"
$connectedServiceName = Get-VstsInput -Name "ConnectedServiceName"
$connectedServiceNameARM = Get-VstsInput -Name "ConnectedServiceNameARM"
$sqlUsername = Get-VstsInput -Name "SqlUsername"
$sqlPassword = Get-VstsInput -Name "SqlPassword"
$aadSqlUserName = Get-VstsInput -Name "AADSqlUserName"
$aadSqlPassword = Get-VstsInput -Name "AADSqlPassword"
$deploymentAction = Get-VstsInput -Name "DeploymentAction"
$authenticationType = Get-VstsInput -Name "AuthenticationType"
$connectionString = Get-VstsInput -Name "ConnectionString"
$publishProfile = Get-VstsInput -Name "PublishProfile"
$sqlpackageAdditionalArguments = Get-VstsInput -Name "AdditionalArguments"
$sqlcmdAdditionalArguments = Get-VstsInput -Name "SqlAdditionalArguments"
$sqlcmdInlineAdditionalArguments = Get-VstsInput -Name "InlineAdditionalArguments"
$ipDetectionMethod = Get-VstsInput -Name "IpDetectionMethod" -Require
$startIpAddress = Get-VstsInput -Name "StartIpAddress"
$endIpAddress = Get-VstsInput -Name "EndIpAddress"
$deleteFirewallRule = Get-VstsInput -Name "DeleteFirewallRule" -Require -AsBool

$ErrorActionPreference = 'Stop'

# Initialize Rest API Helpers.
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

# Load all dependent files for execution
. "$PSScriptRoot\Utility.ps1"
. "$PSScriptRoot\FindSqlPackagePath.ps1"
. "$PSScriptRoot\SqlAzureActions.ps1"

try {
    if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM") {
        $connectedServiceName = $connectedServiceNameARM
    }

    $endpoint = Get-Endpoint -connectedServiceName $connectedServiceName

    $subscriptionId = $null
    if ($endpoint -and $endpoint.Data) {
        $subscriptionId = $endpoint.Data.SubscriptionId
    }

    # Telemetry for endpoint id
    $encodedServerName = GetSHA256String($serverName)
    $encodedDatabaseName = GetSHA256String($databaseName)
    $telemetryJsonContent = -join ("{`"endpointId`":`"$connectedServiceName`",", 
        "`"subscriptionId`":`"$subscriptionId`",",
        "`"serverName`": `"$encodedServerName`",",
        "`"databaseName`": `"$encodedDatabaseName`"}")
    Write-Host "##vso[telemetry.publish area=TaskEndpointId;feature=SqlAzureDacpacDeployment]$telemetryJsonContent"

    Import-Sqlps

    # Detect authentication type for YAML flow
    if (-not $authenticationType) {
        $authenticationType = Detect-AuthenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -aadSqlUsername $aadSqlUserName -aadSqlPassword $aadSqlPassword -connectionString $connectionString
        Write-Verbose "Detected authentication type : $authenticationType"
    }

    # Parse server name and database name from connection string for adding firewall rules
    if ($authenticationType -eq "connectionString") {
        $sb = New-Object System.Data.Common.DbConnectionStringBuilder
        $sb.set_ConnectionString($connectionString.toLower())

        if ($sb['data source']) {
            $serverName = $sb['data source']
        }
        elseif ($sb['server']) {
            $serverName = $sb['server']
        }

        if ($sb['initial catalog']) {
            $databaseName = $sb['initial catalog']
        }
        elseif ($sb['database']) {
            $databaseName = $sb['database']
        }

        Write-Verbose "Retrieved SQL server name : $serverName  and database : $databaseName from connection string"
    }
    elseif ($authenticationType -eq "aadAuthenticationPassword") {
        $sqlUsername = $aadSqlUserName;
        $sqlPassword = $aadSqlPassword;
    }
    elseif ($authenticationType -eq "servicePrincipal") {
        $dbDns = $endpoint.Data.sqlDatabaseDnsSuffix
        $dbDns = $dbDns.Trim(".")
        $dbUrl = (New-Object -TypeName UriBuilder -ArgumentList @("https", $dbDns)).Uri
        $accessToken = (Get-AzureRMAccessToken -endpoint $endpoint -overrideResourceType $dbUrl).access_token
    }

    # Checks for the very basic consistency of the Server Name
    $serverName = $serverName.ToLower()
    Check-ServerName $serverName

    if ($taskNameSelector -ne "DacpacTask" -and $deploymentAction -ne "Publish") {
        throw (Get-VstsLocString -Key "SAD_InvalidDeploymentActionForSQLOperations" -ArgumentList $deploymentAction)
    }

    $firewallRuleName, $isFirewallConfigured = Add-FirewallRule -endpoint $endpoint -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -ipDetectionMethod $ipDetectionMethod -startIPAddress $startIpAddress -endIPAddress $endIpAddress -token $accessToken

    $firewallConfigWaitTime = $env:SqlFirewallConfigWaitTime

    if (-not $firewallConfigWaitTime -or -not ($firewallConfigWaitTime -match '^[0-9]+$')) {
        $firewallConfigWaitTime = 10
        Write-Verbose "Sql configured firewall wait time is invalid. So, setting it to default : $firewallConfigWaitTime"
    }

    Write-Verbose "Sql firewall configured wait time : $firewallConfigWaitTime"

    Start-Sleep -Seconds $firewallConfigWaitTime

    if (@("Extract", "Export", "DriftReport", "DeployReport", "Script") -contains $deploymentAction) {
        # Create the directory for output files
        $generatedOutputFilesRoot = "$ENV:SYSTEM_DEFAULTWORKINGDIRECTORY\GeneratedOutputFiles"
        if (Test-Path $generatedOutputFilesRoot) {
            Remove-Item -Path $generatedOutputFilesRoot -Recurse -Force
        }

        Write-Verbose "Creating output files directory: $generatedOutputFilesRoot"
        New-Item -Path $generatedOutputFilesRoot -ItemType Directory | Out-Null
    }

    switch ($taskNameSelector) {
        "SqlTask" {
            Run-SqlFiles -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlFile $sqlFile -connectionString $connectionString -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments -token $accessToken
        }
        "InlineSqlTask" {
            Run-InlineSql -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlInline $sqlInline -connectionString $connectionString -sqlcmdAdditionalArguments $sqlcmdInlineAdditionalArguments -token $accessToken
        }
        "DacpacTask" {
            switch ($deploymentAction) {
                "Publish" {
                    Write-Verbose "Executing 'Publish' action."
                    Publish-Dacpac -serverName $serverName -authenticationType $authenticationType -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -dacpacFile $dacpacFile -publishProfile $publishProfile -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                "Extract" {
                    Write-Verbose "Executing 'Extract' action."
                    Extract-Dacpac -serverName $serverName -authenticationType $authenticationType -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                "Export" {
                    Write-Verbose "Executing 'Export' action."
                    Export-Bacpac -serverName $serverName -authenticationType $authenticationType -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                "Import" {
                    Write-Verbose "Executing 'Import' action."
                    Import-Bacpac -bacpacFile $bacpacFile -authenticationType $authenticationType -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                "DriftReport" {
                    Write-Verbose "Executing 'DriftReport' action."
                    Drift-Report -serverName $serverName -authenticationType $authenticationType -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                "Script" {
                    Write-Verbose "Executing 'Script' action."
                    Script-Action -dacpacFile $dacpacFile -authenticationType $authenticationType -publishProfile $publishProfile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                "DeployReport" {
                    Write-Verbose "Executing 'DeployReport' action."
                    Deploy-Report -dacpacFile $dacpacFile -authenticationType $authenticationType -publishProfile $publishProfile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -token $accessToken
                }
                default {
                    throw (Get-VstsLocString -Key "SAD_InvalidDeploymentAction" -ArgumentList $deploymentAction)
                }
            }
        }
        default {
            throw Get-VstsLocString -Key "SAD_InvalidPublishOption" -ArgumentList $taskNameSelector
        }
    }


}
catch [System.Management.Automation.CommandNotFoundException] {
    if ($_.Exception.CommandName -ieq "Invoke-Sqlcmd") {
        Write-Host "SQL Powershell Module is not installed on your agent machine. Please follow steps given below to execute this task"  -ForegroundColor Red
        Write-Host "1. Install PowershellTools & SharedManagementObjects(dependency), from https://www.microsoft.com/en-us/download/details.aspx?id=52676 (2016)"
        Write-Host "2. Restart agent machine after installing tools to register Module path updates"
        Write-Host "3. Run Import-Module SQLPS on your agent Powershell prompt. (This step is not required on Powershell 3.0 enabled machines)"
    }

    if ($_.Exception.Message) {
        Write-Error ($_.Exception.Message)
    }
    else {
        Write-Error ($_.Exception)
    }

    throw
}
catch [Exception] {
    $errorMessage = ""
    if ($_.Exception.Message) {
        $errorMessage = $_.Exception.Message
    }
    else {
        $errorMessage = $_.Exception.ToString()
    }

    if ($deploymentAction -eq "DriftReport" -and $LASTEXITCODE -eq 1) {
        $errorMessage += Get-VstsLocString -Key "SAD_DriftReportWarning"
    }

    $errorMessage += Get-VstsLocString -Key "SAD_TroubleshootingLink"

    throw $errorMessage
}
finally {
    # Check if Firewall Rule is configured
    if ($firewallRuleName) {
        # Deleting firewall rule for agent on sql server
        Write-Verbose "Deleting $firewallRuleName"
        $serverFriendlyName = $serverName.split(".")[0]
        Delete-AzureSqlDatabaseServerFirewallRule -serverName $serverFriendlyName -firewallRuleName $firewallRuleName -endpoint $endpoint `
            -isFirewallConfigured $isFirewallConfigured -deleteFireWallRule $deleteFirewallRule
    }
    else {
        Write-Verbose "No Firewall Rule was added"
    }

    Remove-EndpointSecrets
}

Write-Verbose "Leaving script DeploySqlAzure.ps1"
