[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

$connectedServiceNameSelector = Get-VstsInput -Name "ConnectedServiceNameSelector" -Require
$DacpacFile = Get-VstsInput -Name "DacpacFile" -Require
$ServerName = Get-VstsInput -Name  "ServerName" -Require
$DatabaseName = Get-VstsInput -Name "DatabaseName" -Require
$connectedServiceName = Get-VstsInput -Name "ConnectedServiceName"
$connectedServiceNameARM = Get-VstsInput -Name "ConnectedServiceNameARM"
$SqlUsername = Get-VstsInput -Name "SqlUsername"
$SqlPassword = Get-VstsInput -Name "SqlPassword"
$PublishProfile = Get-VstsInput -Name "PublishProfile"
$AdditionalArguments = Get-VstsInput -Name "AdditionalArguments"
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

Write-Host "DacpacFilePath= Find-VstsFiles LegacyPattern $DacpacFile"
$DacpacFilePath = Find-VstsFiles LegacyPattern $DacpacFile
Write-Host "packageFile= $DacpacFilePath"

#Ensure that a single package (.dacpac) file is found
ThrowIfMultipleFilesOrNoFilePresent -files $DacpacFilePath -pattern $DacpacFile

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

    # getting script arguments to execute sqlpackage.exe
    $scriptArgument = Get-SqlPackageCommandArguments -dacpacFile $DacpacFilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                     -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments

    $scriptArgumentToBeLogged = Get-SqlPackageCommandArguments -dacpacFile $DacpacFilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                     -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments -isOutputSecure
   
    Write-Verbose "sqlPackageArguments = $scriptArgumentToBeLogged"

    $SqlPackagePath = Get-SqlPackageOnTargetMachine

    Write-Verbose "Executing SQLPackage.exe"     
    
    $SqlPackageCommand = "`"$SqlPackagePath`" $scriptArgument"
    $commandToBeLogged = "`"$SqlPackagePath`" $scriptArgumentToBeLogged"

    Write-Verbose "Executing : $commandToBeLogged" 

    Run-Command $SqlPackageCommand
    
}
Finally
{
    # deleting firewall rule for agent on sql server
    Delete-AzureSqlDatabaseServerFirewallRule -serverName $serverFriendlyName -firewallRuleName $firewallRuleName -connectionType $connectionType `
                                              -isFirewallConfigured $isFirewallConfigured -deleteFireWallRule $DeleteFirewallRule
}

Write-Verbose "Leaving script DeploySqlAzure.ps1"
