[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

## xlr8 : Get all inputs 
$connectedServiceNameSelector = Get-VstsInput -Name "ConnectedServiceNameSelector" -Require
$taskNameSelector = Get-VstsInput -Name "TaskNameSelector" -Require
$dacpacFile = Get-VstsInput -Name "DacpacFile"
$sqlFile = Get-VstsInput -Name "SqlFile"
$sqlInline = Get-VstsInput -Name "SqlInline"
$serverName = Get-VstsInput -Name  "ServerName" -Require
$databaseName = Get-VstsInput -Name "DatabaseName" -Require
$connectedServiceName = Get-VstsInput -Name "ConnectedServiceName"
$connectedServiceNameARM = Get-VstsInput -Name "ConnectedServiceNameARM"
$sqlUsername = Get-VstsInput -Name "SqlUsername"
$sqlPassword = Get-VstsInput -Name "SqlPassword"

$deploymentAction = Get-VstsInput -Name "DeploymentAction"  # new input 

$publishProfile = Get-VstsInput -Name "PublishProfile"
$additionalArguments = Get-VstsInput -Name "AdditionalArguments"
$sqlAdditionalArguments = Get-VstsInput -Name "SqlAdditionalArguments"
$inlineAdditionalArguments = Get-VstsInput -Name "InlineAdditionalArguments"
$ipDetectionMethod = Get-VstsInput -Name "IpDetectionMethod" -Require
$startIpAddress = Get-VstsInput -Name "StartIpAddress"
$endIpAddress = Get-VstsInput -Name "EndIpAddress"
$deleteFirewallRule = Get-VstsInput -Name "DeleteFirewallRule" -Require -AsBool
$defaultTimeout = 120

$ErrorActionPreference = 'Stop'

# Initialize Rest API Helpers.
# xlr8 : This should be mainly for adding/removing firewalls
Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

# Load all dependent files for execution
. "$PSScriptRoot\Utility.ps1"
. "$PSScriptRoot\FindSqlPackagePath.ps1"

Try
{
    $firewallRuleName = ""

    if ($TaskNameSelector -eq "DacpacTask")
    {
        Write-Verbose "FilePath= Find-VstsFiles LegacyPattern $DacpacFile"
        $FilePath = Find-VstsFiles LegacyPattern $DacpacFile
        Write-Host "packageFile= $FilePath"

        #Ensure that a single package (.dacpac) file is found
        ThrowIfMultipleFilesOrNoFilePresent -files $FilePath -pattern $DacpacFile

        # Do Profile Path Validations here as it only matters for Dacpac Task

        $PublishProfilePath = ""
        if( [string]::IsNullOrWhitespace($PublishProfile) -eq $false -and $PublishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $PublishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\"))
        {
            Write-Host "PublishProfilePath = Find-VstsFiles LegacyPattern $PublishProfile"
            $PublishProfilePath = Find-VstsFiles LegacyPattern $PublishProfile
            Write-Host "Publish profile path = $PublishProfilePath"

            #Ensure that only one publish profile file is found
            ThrowIfMultipleFilesOrNoFilePresent -files $PublishProfilePath -pattern $PublishProfile
        }
    }
    ElseIf ($TaskNameSelector -eq "SqlTask")
    {
        Write-Verbose "FilePath= Find-VstsFiles LegacyPattern $SqlFile"
        $FilePath = Find-VstsFiles LegacyPattern $SqlFile
        Write-Host "packageFile= $FilePath"

        #Ensure that a single .sql file is found
        ThrowIfMultipleFilesOrNoFilePresent -files $FilePath -pattern $SqlFile

        $sqlFileExtension = ".sql"
        if([System.IO.Path]::GetExtension($FilePath) -ne $sqlFileExtension)
        {
            Write-Error (Get-VstsLocString -Key "SAD_InvalidSqlFile" -ArgumentList $FilePath)
        }
    }
    ElseIf ($TaskNameSelector -eq "InlineSqlTask")
    {
        $FilePath = [System.IO.Path]::GetTempFileName()
        ($SqlInline | Out-File $FilePath)
    
        Write-Host "tempFile= $FilePath"
    
        $SqlAdditionalArguments = $InlineAdditionalArguments
    }

    # xlr8 : Get the endpoint used in the task
    if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM")
    {
        $connectedServiceName = $connectedServiceNameARM
    }

    # Getting endpoint used for the task
    $endpoint = Get-Endpoint -connectedServiceName $connectedServiceName

    # Checks for the very basic consistency of the Server Name
    $ServerName = $ServerName.ToLower()
    Check-ServerName $ServerName

    Import-SqlPs
    
    $firewallRuleName, $isFirewallConfigured = Add-SqlServerFirewallRule -IpDetectionMethod $IpDetectionMethod -ServerName $serverName  
    
    if ($TaskNameSelector -eq "DacpacTask")
    {
        Publish-DacpacFile -AdditionalArguments $AdditionalArguments
    }
    else
    {
        if($sqlUserName)
        {
            $SqlUsername = Get-FormattedSqlUsername -sqlUserName $sqlUserName -serverName $serverName
        }

        $scriptArgument = "Invoke-Sqlcmd -ServerInstance `"$ServerName`" -Database `"$DatabaseName`" -Username `"$SqlUsername`" "

        $commandToRun = $scriptArgument + " -Password `"$SqlPassword`" "
        $commandToLog = $scriptArgument + " -Password ****** "

        # Increase Timeout to 120 seconds in case its not provided by User
        if (-not ($SqlAdditionalArguments.ToLower().Contains("-connectiontimeout")))
        {
            # Add Timeout of 120 Seconds
            $SqlAdditionalArguments = $SqlAdditionalArguments + " -ConnectionTimeout $defaultTimeout"
        }

        $commandToRun += " -Inputfile `"$FilePath`" " + $SqlAdditionalArguments
        $commandToLog += " -Inputfile `"$FilePath`" " + $SqlAdditionalArguments

        Write-Host $commandToLog
        Invoke-Expression $commandToRun
    }
    
}
Catch [System.Management.Automation.CommandNotFoundException]
{
    if ($_.Exception.CommandName -ieq "Invoke-Sqlcmd")
    {
        Write-Host "SQL Powershell Module is not installed on your agent machine. Please follow steps given below to execute this task"  -ForegroundColor Red
        Write-Host "1. Install PowershellTools & SharedManagementObjects(dependency), from https://www.microsoft.com/en-us/download/details.aspx?id=52676 (2016)"
        Write-Host "2. Restart agent machine after installing tools to register Module path updates"
        Write-Host "3. Run Import-Module SQLPS on your agent Powershell prompt. (This step is not required on Powershell 3.0 enabled machines)"
    }

    if($_.Exception.Message) 
    {
        Write-Error ($_.Exception.Message)
    }
    else 
    {
        Write-Error ($_.Exception)
    }
    throw
}
Catch [Exception]
{
    $errorMessage = Get-VstsLocString -Key "SAD_TroubleshootingLink"

    if($_.Exception.Message) 
    {
        $errorMessage = $_.Exception.Message + " " + $errorMessage
    }
    else 
    {
        $errorMessage = $_.Exception.ToString() + " " + $errorMessage
    }

    throw $errorMessage
}
Finally
{
    # Delete Temp file Created During inline Task Execution
    if ($TaskNameSelector -eq "InlineSqlTask" -and (Test-Path $FilePath) -eq $true)
    {
        Write-Verbose "Removing File $FilePath"
        Remove-Item $FilePath -ErrorAction 'SilentlyContinue'
    }

    # Check if Firewall Rule is configured
    if ($firewallRuleName)
    {
        # Deleting firewall rule for agent on sql server
        Write-Verbose "Deleting $firewallRuleName"
        Delete-AzureSqlDatabaseServerFirewallRule -serverName $serverFriendlyName -firewallRuleName $firewallRuleName -endpoint $endpoint `
                                                -isFirewallConfigured $isFirewallConfigured -deleteFireWallRule $DeleteFirewallRule
    }
    else
    {
        Write-Verbose "No Firewall Rule was added"
    }
}


## =========== should the below functions be in the same file ?

# Function to import SqlPS module & avoid directory switch
function Import-Sqlps {
    Push-Location
    Import-Module SqlPS -ErrorAction 'SilentlyContinue' 3>&1 | out-null
    Pop-Location
}

function ThrowIfMultipleFilesOrNoFilePresent($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-VstsLocString -Key "SAD_FoundMoreFiles" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-VstsLocString -Key "SAD_NoFilesMatch" -ArgumentList $pattern)
        }
    }
}

function Add-SqlServerFirewallRule {
    param (
        [String][Parameter(Mandatory=$true)] $IpDetectionMethod,
        [String] $ServerName,
        [String] $ServerFriendlyName, # is this necessary ?
        [String] $SqlUsername,
        [String] $SqlPassword, 
        [String] $StartIpAddress,
        [string] $EndIpAddress
    )
    # Test and get IPRange for autoDetect IpDetectionMethod

    $ipAddressRange = @{}
    if($IpDetectionMethod -eq "AutoDetect")
    {
        $ipAddressRange = Get-AgentIPRange -serverName $ServerName -sqlUsername $SqlUsername -sqlPassword $SqlPassword
    }
    else 
    {
        $ipAddressRange.StartIPAddress = $StartIpAddress
        $ipAddressRange.EndIPAddress = $EndIpAddress
    }

    Write-Verbose ($ipAddressRange | Format-List | Out-String)

    # creating firewall rule for agent on sql server, if it is not able to connect or iprange is selected
    if($ipAddressRange.Count -ne 0)
    {
        $serverFriendlyName = $ServerName.split(".")[0]
        Write-Verbose "Server friendly name is $serverFriendlyName"

        $firewallSettings = Create-AzureSqlDatabaseServerFirewallRule -startIP $ipAddressRange.StartIPAddress -endIP $ipAddressRange.EndIPAddress -serverName $serverFriendlyName -endpoint $endpoint
        Write-Verbose ($firewallSettings | Format-List | Out-String)

        $firewallRuleName = $firewallSettings.RuleName
        $isFirewallConfigured = $firewallSettings.IsConfigured
    }

    return $firewallRuleName, $isFirewallConfigured
}

Write-Verbose "Leaving script DeploySqlAzure.ps1"