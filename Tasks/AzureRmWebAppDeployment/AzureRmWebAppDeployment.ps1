param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $WebAppName,

    [String] [Parameter(Mandatory = $true)]
    $DeployToSlotFlag,

    [String] [Parameter(Mandatory = $false)]
    $ResourceGroupName,

    [String] [Parameter(Mandatory = $false)]
    $SlotName,

    [String] [Parameter(Mandatory = $true)]
    $Package,

    [String] [Parameter(Mandatory = $false)]
    $RemoveAdditionalFilesFlag,

    [String] [Parameter(Mandatory = $false)]
    $ExcludeFilesFromAppDataFlag,

    [String] [Parameter(Mandatory = $false)]
    $TakeAppOfflineFlag,

    [String] [Parameter(Mandatory = $false)]
    $VirtualApplication,

[String] [Parameter(Mandatory = $false)]
[String] $AdditionalArguments
)

Write-Verbose "Starting AzureRM WebApp Deployment Task"

Write-Verbose "ConnectedServiceName = $ConnectedServiceName"
Write-Verbose "WebAppName = $WebAppName"
Write-Verbose "DeployToSlotFlag = $DeployToSlotFlag"
Write-Verbose "ResourceGroupName = $ResourceGroupName"
Write-Verbose "SlotName = $SlotName"
Write-Verbose "Package = $Package"
Write-Verbose "RemoveAdditionalFilesFlag = $RemoveAdditionalFilesFlag"
Write-Verbose "ExcludeFilesFromAppDataFlag = $ExcludeFilesFromAppDataFlag"
Write-Verbose "TakeAppOfflineFlag = $TakeAppOfflineFlag"
Write-Verbose "VirtualApplication = $VirtualApplication"

# Import all the dlls and modules which have cmdlets we need
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# Load all dependent files for execution
Import-Module ./AzureUtility.ps1 -Force
Import-Module ./Utility.ps1 -Force

$ErrorActionPreference = 'Stop'

#### MAIN EXECUTION OF AZURERM WEBAPP DEPLOYMENT TASK BEGINS HERE ####

# Get msdeploy.exe path
$msDeployExePath = Get-MsDeployExePath

# Ensure that at most a package (.zip) file is found
$packageFile = Get-SinglePackageFile -package $Package

# Get destination azureRM webApp connection details
$azureRMWebAppConnectionDetails = Get-AzureRMWebAppConnectionDetails -webAppName $WebAppName -deployToSlotFlag $DeployToSlotFlag `
                                                                       -resourceGroupName $ResourceGroupName -slotName $SlotName

# webApp Name to be used in msdeploy command
$webAppNameForMSDeployCmd = Get-WebAppNameForMSDeployCmd -webAppName $WebAppName -deployToSlotFlag $DeployToSlotFlag -slotName $SlotName

# Construct arguments for msdeploy command
$msDeployCmdArgs = Get-MsDeployCmdArgs -packageFile $packageFile -webAppNameForMSDeployCmd $webAppNameForMSDeployCmd -azureRMWebAppConnectionDetails $azureRMWebAppConnectionDetails -removeAdditionalFilesFlag $RemoveAdditionalFilesFlag `
                                       -excludeFilesFromAppDataFlag $ExcludeFilesFromAppDataFlag -takeAppOfflineFlag $TakeAppOfflineFlag -virtualApplication $VirtualApplication -AdditionalArguments $AdditionalArguments

# Deploy azureRM webApp using msdeploy Command
Run-MsDeployCommand -msDeployExePath $msDeployExePath -msDeployCmdArgs $msDeployCmdArgs

Write-Verbose "Completed AzureRM WebApp Deployment Task"
