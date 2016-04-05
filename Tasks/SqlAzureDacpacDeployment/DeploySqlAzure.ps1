[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [string] [Parameter(Mandatory=$true)] $connectedServiceNameSelector,
    [String] [Parameter(Mandatory = $true)] $DacpacFile,
    [String] [Parameter(Mandatory = $true)] $ServerName,
    [String] [Parameter(Mandatory = $true)] $DatabaseName,
    [string] $connectedServiceName,
    [string] $connectedServiceNameARM,
    [String] $SqlUsername,
    [String] $SqlPassword,
    [String] $PublishProfile,
    [String] $AdditionalArguments,
    [String] [Parameter(Mandatory = $true)] $IpDetectionMethod,
    [String] $StartIpAddress,
    [String] $EndIpAddress,
    [String] [Parameter(Mandatory = $true)] $DeleteFirewallRule
)

Write-Verbose "Entering script DeploySqlAzure.ps1"

# Log arguments
Write-Verbose "ConnectedServiceNameSelector= $connectedServiceNameSelector" -Verbose
Write-Verbose "DacpacFile= $DacpacFile" -Verbose
Write-Verbose "ServerName= $ServerName" -Verbose
Write-Verbose "DatabaseName= $DatabaseName" -Verbose
Write-Verbose "SqlUsername= $SqlUsername" -Verbose
Write-Verbose "PublishProfile= $PublishProfile" -Verbose
Write-Verbose "AdditionalArguments= $AdditionalArguments" -Verbose
Write-Verbose "StartIPAddress= $StartIPAddress" -Verbose
Write-Verbose "EndIPAddress= $EndIPAddress" -Verbose
Write-Verbose "DeleteFirewallRule= $DeleteFirewallRule" -Verbose

# Import all the dlls and modules which have cmdlets we need
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

# Load all dependent files for execution
Import-Module ./Utility.ps1 -Force

function ThrowIfMultipleFilesOrNoFilePresent($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern {0}. There can be only one." -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-LocalizedString -Key "No files were found to deploy with search pattern {0}" -ArgumentList $pattern)
        }
    }
}

Write-Host "DacpacFilePath= Find-Files -SearchPattern $DacpacFile"
$DacpacFilePath = Find-Files -SearchPattern $DacpacFile
Write-Host "packageFile= $DacpacFilePath"

#Ensure that a single package (.dacpac) file is found
ThrowIfMultipleFilesOrNoFilePresent -files $DacpacFilePath -pattern $DacpacFile

$PublishProfilePath = ""
if( [string]::IsNullOrWhitespace($PublishProfile) -eq $false -and $PublishProfile -ne $env:SYSTEM_DEFAULTWORKINGDIRECTORY -and $PublishProfile -ne [String]::Concat($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "\"))
{
    Write-Host "PublishProfilePath = Find-Files -SearchPattern $PublishProfile"
    $PublishProfilePath = Find-Files -SearchPattern $PublishProfile
    Write-Host "Publish profile path = $PublishProfilePath"

    #Ensure that only one publish profile file is found
    ThrowIfMultipleFilesOrNoFilePresent -files $PublishProfilePath -pattern $PublishProfile
}


$ErrorActionPreference = 'Stop'

$ServerName = $ServerName.ToLower()
$serverFriendlyName = $ServerName.split(".")[0]
Write-Verbose "Server friendly name is $serverFriendlyName" -Verbose

# Getting start and end IP address for agent machine
$ipAddress = Get-AgentIPAddress -startIPAddress $StartIpAddress -endIPAddress $EndIpAddress -ipDetectionMethod $IpDetectionMethod -taskContext $distributedTaskContext
Write-Verbose ($ipAddress | Format-List | Out-String) -Verbose

$startIp =$ipAddress.StartIPAddress
$endIp = $ipAddress.EndIPAddress

Try
{
    # Importing required version of azure cmdlets according to azureps installed on machine
    $azureUtility = Get-AzureUtility

    Write-Verbose -Verbose "Loading $azureUtility"
    Import-Module ./$azureUtility -Force

    if ($connectedServiceNameSelector -eq "ConnectedServiceNameARM")
    {
        $connectedServiceName = $connectedServiceNameARM
    }

    # Getting connection type (Certificate/UserNamePassword/SPN) used for the task
    $connectionType = Get-ConnectionType -connectedServiceName $connectedServiceName -taskContext $distributedTaskContext

    # creating firewall rule for agent on sql server
    $firewallSettings = Create-AzureSqlDatabaseServerFirewallRule -startIP $startIp -endIP $endIp -serverName $serverFriendlyName -connectionType $connectionType
    Write-Verbose ($firewallSettings | Format-List | Out-String) -Verbose

    $firewallRuleName = $firewallSettings.RuleName
    $isFirewallConfigured = $firewallSettings.IsConfigured

    # getting script arguments to execute sqlpackage.exe
    Write-Verbose "Creating SQLPackage.exe arguments" -Verbose
    $scriptArgument = Get-SqlPackageCommandArguments -dacpacFile $DacpacFilePath -targetMethod "server" -serverName $ServerName -databaseName $DatabaseName `
                                                     -sqlUsername $SqlUsername -sqlPassword $SqlPassword -publishProfile $PublishProfilePath -additionalArguments $AdditionalArguments
    Write-Verbose "Created SQLPackage.exe arguments" -Verbose

    $sqlDeploymentScriptPath = Join-Path "$env:AGENT_HOMEDIRECTORY" "Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\Scripts\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Sql.ps1"
    $SqlPackageCommand = "& '$(`"$sqlDeploymentScriptPath`" -replace "['`]", '$&$&')' '$($scriptArgument -replace "['`]", '$&$&')'"

    Write-Verbose "Executing SQLPackage.exe"  -Verbose

    $ErrorActionPreference = 'Continue'
    Invoke-Expression -Command $SqlPackageCommand
    $ErrorActionPreference = 'Stop'
}
Finally
{
    # deleting firewall rule for agent on sql server
    Delete-AzureSqlDatabaseServerFirewallRule -serverName $serverFriendlyName -firewallRuleName $firewallRuleName -connectionType $connectionType `
                                              -isFirewallConfigured $isFirewallConfigured -deleteFireWallRule $DeleteFirewallRule
}

Write-Verbose "Leaving script DeploySqlAzure.ps1" -Verbose