[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $DeploymentEnvironmentName,

    [String] [Parameter(Mandatory = $false)] #false since it can be passed in via JSON
    $CollectionUrl,

    [String] [Parameter(Mandatory = $false)] #false since it can be passed in via JSON
    $TeamProject,

    [String] [Parameter(Mandatory = $true)]
    $CsPkg,  #of the form **\*.cspkg (or a path right to a cspkg file, if possible)

    [String] [Parameter(Mandatory = $true)]
    $CsCfg,  #of the form **\*.cscfg (or a path right to a cscfg file, if possible)

    [String] [Parameter(Mandatory = $false)]
    $StorageAccount,

    [String] [Parameter(Mandatory = $false)]  #default to Production
    $Slot,

    [String] [Parameter(Mandatory = $false)]
    $AdditionalArguments
)

Write-Verbose "Entering script Publish-AzureCloudDeployment.ps1"

Write-Verbose "CsPkg= $CsPkg"
Write-Verbose "CsCfg= $CsCfg"
Write-Verbose "StorageAccount= $StorageAccount"
Write-Verbose "Slot= $Slot"
Write-Verbose "AdditionalArguments= $AdditionalArguments"

if (!$distributedTaskContext)
{
    import-module "..\..\..\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.Common"
    import-module "..\..\..\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.Build"
    import-module "..\..\..\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Azure\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Azure.psm1"

    Write-Host "Using CollectionUrl and TeamProject from script parameters" -ForegroundColor Yellow
    $collectionUrl = $CollectionUrl
    $teamProject = $TeamProject

    if(!$collectionUrl)
    {
        throw "CollectionUrl was not passed on the command line and no distributedTaskContext was found."
    }
    if (!$teamProject)
    {
        throw "TeamProject was not passed on the command line and no distributedTaskContext was found."
    }

    #Call the function in the module to get the deployment environment set up here.  Function name is Setup-AzureSubscription
    Setup-AzureSubscription -DeploymentEnvironmentName $DeploymentEnvironmentName -CollectionUrl $collectionUrl -TeamProject $teamProject
}

Write-Host "Find-Files -SearchPattern $CsCfg"
$serviceConfigFile = Find-Files -SearchPattern "$CsCfg"
Write-Host "serviceConfigFile= $serviceConfigFile" -ForegroundColor Yellow
$serviceConfigFile = Get-SingleFile $serviceConfigFile

Write-Host "Find-Files -SearchPattern $CsPkg"
$servicePackageFile = Find-Files -SearchPattern "$CsPkg"
Write-Host "servicePackageFile= $servicePackageFile" -ForegroundColor Yellow
$servicePackageFile = Get-SingleFile $servicePackageFile

$azureCommand = "Publish-AzureServiceProject"
$azureCommandArguments = "$servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -Verbose"
if($StorageAccount)
{
    $azureCommandArguments = "$azureCommandArguments -StorageAccountName $StorageAccount"
}
$azureCommandArguments = "$azureCommandArguments $AdditionalArguments"

$finalCommand = "$azureCommand $azureCommandArguments"
Write-Host "finalCommand= $finalCommand"
Invoke-Expression -Command $finalCommand

Write-Verbose "Leaving script Publish-AzureCloudDeployment.ps1"