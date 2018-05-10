[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$connectedServiceNameSelector = Get-VstsInput -Name "ConnectedServiceNameSelector" -Require
$taskNameSelector = Get-VstsInput -Name "TaskNameSelector" -Require
$dacpacFile = Get-VstsInput -Name "DacpacFile"
$sqlFile = Get-VstsInput -Name "SqlFile"
$sqlInline = Get-VstsInput -Name "SqlInline"
$bacpacFile = Get-VstsInput -Name "BacpacFile"
$serverName = Get-VstsInput -Name  "ServerName" -Require
$databaseName = Get-VstsInput -Name "DatabaseName" -Require
$connectedServiceName = Get-VstsInput -Name "ConnectedServiceName"
$connectedServiceNameARM = Get-VstsInput -Name "ConnectedServiceNameARM"
$sqlUsername = Get-VstsInput -Name "SqlUsername"
$sqlPassword = Get-VstsInput -Name "SqlPassword"
$deploymentAction = Get-VstsInput -Name "DeploymentAction" 
$publishProfile = Get-VstsInput -Name "PublishProfile"
$sqlpackageAdditionalArguments = Get-VstsInput -Name "AdditionalArguments"
$sqlcmdAdditionalArguments = Get-VstsInput -Name "SqlAdditionalArguments"
$sqlcmdInlineAdditionalArguments = Get-VstsInput -Name "InlineAdditionalArguments"
$ipDetectionMethod = Get-VstsInput -Name "IpDetectionMethod" -Require
$startIpAddress = Get-VstsInput -Name "StartIpAddress"
$endIpAddress = Get-VstsInput -Name "EndIpAddress"
$deleteFirewallRule = Get-VstsInput -Name "DeleteFirewallRule" -Require -AsBool
$defaultTimeout = 120

$ErrorActionPreference = 'Stop'

# Initialize Rest API Helpers.
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

    # Telemetry for endpoint id 
    $telemetryJsonContent = "{`"endpointId`":`"$connectedServiceName`"}"
    Write-Host "##vso[telemetry.publish area=TaskEndpointId;feature=SqlAzureDacpacDeployment]$telemetryJsonContent"

    # Checks for the very basic consistency of the Server Name
    $serverName = $serverName.ToLower()
    Check-ServerName $serverName

    $firewallRuleName, $isFirewallConfigured = Add-FirewallRule -endpoint $endpoint -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -ipDetectionMethod $ipDetectionMethod -startIPAddress $startIpAddress -endIPAddress $endIpAddress
    
    switch ($deploymentAction) {
        "Publish" {
            Execute-PublishAction -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -taskNameSelector $taskNameSelector -dacpacFile $dacpacFile `
                -publishProfile $publishProfile -sqlFile $sqlFile -sqlInline $sqlInline -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments -sqlcmdAdditionalArguments $sqlcmdAdditionalArguments -sqlcmdInlineAdditionalArguments $sqlcmdInlineAdditionalArguments
        }
        "Extract" {
            Extract-Dacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        "Export" {
            Export-Bacpac -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        "Import" {
            Import-Bacpac -bacpacFile $bacpacFile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        "DriftReport" {
            Drift-Report -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        "Script" {
            Script-Action -dacpacFile $dacpacFile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        "DeployReport" {
            Deploy-Report -dacpacFile $dacpacFile -serverName $serverName -databaseName $databaseName -sqlUsername $sqlUsername -sqlPassword $sqlPassword -sqlpackageAdditionalArguments $sqlpackageAdditionalArguments
        }
        default {
            throw "Invalid deployment action: $deploymentAction"
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

    if($_.Exception.Message) {
        Write-Error ($_.Exception.Message)
    }
    else {
        Write-Error ($_.Exception)
    }

    throw
}
catch [Exception] {
    $errorMessage = Get-VstsLocString -Key "SAD_TroubleshootingLink"

    if($_.Exception.Message) {
        $errorMessage = $_.Exception.Message + " " + $errorMessage
    }
    else {
        $errorMessage = $_.Exception.ToString() + " " + $errorMessage
    }

    throw $errorMessage
}
finally {
    <# 
        
    if ($taskNameSelector -eq "InlineSqlTask" -and (Test-Path $FilePath) -eq $true)
    {
        Write-Verbose "Removing File $FilePath"
        Remove-Item $FilePath -ErrorAction 'SilentlyContinue'
    }

    remove the temporary file in case of inline sql. check how !

    
    #>

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
}

Write-Verbose "Leaving script DeploySqlAzure.ps1"