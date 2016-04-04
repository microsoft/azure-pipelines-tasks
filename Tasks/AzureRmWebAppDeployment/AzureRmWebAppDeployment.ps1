param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $WebSiteName,

    [String] [Parameter(Mandatory = $true)]
    $File,

    [String] [Parameter(Mandatory = $false)]
    $RemoveAdditionalFilesFlag,

    [String] [Parameter(Mandatory = $false)]
    $DeleteFilesInAppDataFlag,

    [String] [Parameter(Mandatory = $false)]
    $TakeAppOfflineFlag,

    [String] [Parameter(Mandatory = $false)]
    $PhysicalPath
)

Write-Verbose "Starting AzureRM WebApp Deployment Task" -Verbose

Write-Verbose "ConnectedServiceName = $ConnectedServiceName" -Verbose
Write-Verbose "WebSiteName = $WebSiteName" -Verbose
Write-Verbose "File = $File" -Verbose
Write-Verbose "RemoveAdditionalFilesFlag = $RemoveAdditionalFilesFlag" -Verbose
Write-Verbose "DeleteFilesInAppDataFlag = $DeleteFilesInAppDataFlag" -Verbose
Write-Verbose "TakeAppOfflineFlag = $TakeAppOfflineFlag" -Verbose
Write-Verbose "PhysicalPath = $PhysicalPath" -Verbose

# Import all the dlls and modules which have cmdlets we need
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# Load all dependent files for execution
Import-Module ./AzureUtility.ps1 -Force
Import-Module ./Utility.ps1 -Force

$ErrorActionPreference = 'Stop'

# enabling detailed logging only when system.debug is true
$enableDetailedLoggingFlag = $env:system_debug
if ($enableDetailedLoggingFlag -ne "true")
{
    $enableDetailedLoggingFlag = "false"
}

#### MAIN EXECUTION OF AZURERM WEBAPP DEPLOYMENT TASK BEGINS HERE ####

# Get msdeploy.exe path
$msDeployExePath = Get-MsDeployExePath

# Get destination azureRM website connection details
$azureRMWebsiteConnectionDetails = Get-AzureRMWebsiteConnectionDetails -websiteName $WebSiteName

# Construct arguments for msdeploy command
$msDeployCmdArgs = Get-MsDeployCmdArgs -file $File -webSiteName $WebSiteName -azureRMWebsiteConnectionDetails $azureRMWebsiteConnectionDetails -removeAdditionalFilesFlag $RemoveAdditionalFilesFlag `
                                       -deleteFilesInAppDataFlag $DeleteFilesInAppDataFlag -takeAppOfflineFlag T$akeAppOfflineFlag -physicalPath $PhysicalPath

# Deploy azureRM WebApp using msdeploy Command
Run-MsDeployCommand -msDeployExePath $msDeployExePath -msDeployCmdArgs $msDeployCmdArgs

Write-Verbose "Completed AzureRM WebApp Deployment Task" -Verbose
