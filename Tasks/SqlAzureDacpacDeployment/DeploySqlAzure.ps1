[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$connectedServiceNameSelector = Get-VstsInput -Name "ConnectedServiceNameSelector" -Require
$TaskNameSelector = Get-VstsInput -Name "TaskNameSelector" -Require
$DacpacFile = Get-VstsInput -Name "DacpacFile"
$SqlFile = Get-VstsInput -Name "SqlFile"
$SqlInline = Get-VstsInput -Name "SqlInline"
$ServerName = Get-VstsInput -Name  "ServerName" -Require
$DatabaseName = Get-VstsInput -Name "DatabaseName" -Require
$connectedServiceName = Get-VstsInput -Name "ConnectedServiceName"
$connectedServiceNameARM = Get-VstsInput -Name "ConnectedServiceNameARM"
$SqlUsername = Get-VstsInput -Name "SqlUsername"
$SqlPassword = Get-VstsInput -Name "SqlPassword"
$PublishProfile = Get-VstsInput -Name "PublishProfile"
$AdditionalArguments = Get-VstsInput -Name "AdditionalArguments"
$SqlAdditionalArguments = Get-VstsInput -Name "SqlAdditionalArguments"
$InlineAdditionalArguments = Get-VstsInput -Name "InlineAdditionalArguments"
$IpDetectionMethod = Get-VstsInput -Name "IpDetectionMethod" -Require
$StartIpAddress = Get-VstsInput -Name "StartIpAddress"
$EndIpAddress = Get-VstsInput -Name "EndIpAddress"
$DeleteFirewallRule = Get-VstsInput -Name "DeleteFirewallRule" -Require -AsBool

# Initialize Azure.
Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
Initialize-Azure

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

# Load all dependent files for execution
. "$PSScriptRoot\Utility.ps1"
. "$PSScriptRoot\FindSqlPackagePath.ps1"

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

if ($TaskNameSelector -eq "DacpacTask")
{
    Write-Host "FilePath= Find-VstsFiles LegacyPattern $DacpacFile"
    $FilePath = Find-VstsFiles LegacyPattern $DacpacFile
    Write-Host "packageFile= $FilePath"

    #Ensure that a single package (.dacpac) file is found
    ThrowIfMultipleFilesOrNoFilePresent -files $FilePath -pattern $DacpacFile
} ElseIf ($TaskNameSelector -eq "SqlTask")
{
    Write-Host "FilePath= Find-VstsFiles LegacyPattern $SqlFile"
    $FilePath = Find-VstsFiles LegacyPattern $SqlFile
    Write-Host "packageFile= $FilePath"

    #Ensure that a single .sql file is found
    ThrowIfMultipleFilesOrNoFilePresent -files $FilePath -pattern $SqlFile
}

$PublishProfilePath = ""
if( [string]::IsNullOrWhitespace($PublishProfile) -eq $false -and $PublishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $PublishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\"))
{
    Write-Host "PublishProfilePath = Find-VstsFiles LegacyPattern $PublishProfile"
    $PublishProfilePath = Find-VstsFiles LegacyPattern $PublishProfile
    Write-Host "Publish profile path = $PublishProfilePath"

    #Ensure that only one publish profile file is found
    ThrowIfMultipleFilesOrNoFilePresent -files $PublishProfilePath -pattern $PublishProfile
}


$ErrorActionPreference = 'Stop'

$ServerName = $ServerName.ToLower()
$serverFriendlyName = $ServerName.split(".")[0]
Write-Verbose "Server friendly name is $serverFriendlyName"

# Getting start and end IP address for agent machine
$ipAddress = Get-AgentIPAddress -startIPAddress $StartIpAddress -endIPAddress $EndIpAddress -ipDetectionMethod $IpDetectionMethod
Write-Verbose ($ipAddress | Format-List | Out-String)

$startIp =$ipAddress.StartIPAddress
$endIp = $ipAddress.EndIPAddress

Try
{
    # Importing required version of azure cmdlets according to azureps installed on machine
    $azureUtility = Get-AzureUtility

    Write-Verbose "Loading $azureUtility"
    . "$PSScriptRoot\$azureUtility"

    if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM")
    {
        $connectedServiceName = $connectedServiceNameARM
    }

    # Getting connection type (Certificate/UserNamePassword/SPN) used for the task
    $connectionType = Get-ConnectionType -connectedServiceName $connectedServiceName

    # creating firewall rule for agent on sql server
    $firewallSettings = Create-AzureSqlDatabaseServerFirewallRule -startIP $startIp -endIP $endIp -serverName $serverFriendlyName -connectionType $connectionType
    Write-Verbose ($firewallSettings | Format-List | Out-String)

    $firewallRuleName = $firewallSettings.RuleName
    $isFirewallConfigured = $firewallSettings.IsConfigured

    if ($TaskNameSelector -eq "DacpacTask")
    {
        # getting script arguments to execute sqlpackage.exe
        $scriptArgument = Get-SqlPackageCommandArguments -dacpacFile $FilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                     -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments

        $scriptArgumentToBeLogged = Get-SqlPackageCommandArguments -dacpacFile $FilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                     -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments -isOutputSecure
   
        Write-Verbose "sqlPackageArguments = $scriptArgumentToBeLogged"

        $SqlPackagePath = Get-SqlPackageOnTargetMachine

        Write-Verbose "Executing SQLPackage.exe"

        $SqlPackageCommand = "`"$SqlPackagePath`" $scriptArgument"
        $commandToBeLogged = "`"$SqlPackagePath`" $scriptArgumentToBeLogged"

        Write-Verbose "Executing : $commandToBeLogged"

        Run-Command $SqlPackageCommand
    }
    else
    {
        $scriptArgument = "Invoke-Sqlcmd -ServerInstance `"$ServerName`" -Database `"$DatabaseName`" -Username `"$SqlUsername`" "

        $commandToRun = $scriptArgument + " -Password `"$SqlPassword`" "
        $commandToLog = $scriptArgument + " -Password ****** "

        if ($TaskNameSelector -eq "SqlTask")
        {
            # Check if file selected is an sql file.
            $sqlFileExtension = ".sql"
            if([System.IO.Path]::GetExtension($FilePath) -ne $sqlFileExtension)
            {
                Write-Error (Get-VstsLocString -Key "SAD_InvalidSqlFile" -ArgumentList $FilePath)
            }

            $commandToRun += " -Inputfile `"$FilePath`" " + $SqlAdditionalArguments
            $commandToLog += " -Inputfile `"$FilePath`" " + $SqlAdditionalArguments
        }
        else # inline Sql
        {
            $commandToRun += " -Query `"$SqlInline`" " + $InlineAdditionalArguments
            $commandToLog += " -Query `"$SqlInline`" " + $InlineAdditionalArguments
        }

        Write-Host $commandToLog
        Invoke-Expression $commandToRun
    }
    
}
Catch [System.Management.Automation.CommandNotFoundException]
{
    Write-Host "Exception Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.CommandName -ieq "Invoke-Sqlcmd")
    {
        Write-Host "SQL Powershell Module is not installed on your agent machine. Please follow steps given below to execute this task"
        Write-Host "1. Install PowershellTools & SharedManagementObjects(dependency), from https://www.microsoft.com/en-us/download/details.aspx?id=52676 (2016)"
        Write-Host "2. Restart agent machine after installing tools to register Module path updates"
        Write-Host "3. Run Import-Module SQLPS on your agent Powershell prompt. (This step is not required on Powershell 3.0 enabled machines)"
    }
    throw $_.Exception
}
Finally
{
    # deleting firewall rule for agent on sql server
    Delete-AzureSqlDatabaseServerFirewallRule -serverName $serverFriendlyName -firewallRuleName $firewallRuleName -connectionType $connectionType `
                                              -isFirewallConfigured $isFirewallConfigured -deleteFireWallRule $DeleteFirewallRule
}

Write-Verbose "Leaving script DeploySqlAzure.ps1"
