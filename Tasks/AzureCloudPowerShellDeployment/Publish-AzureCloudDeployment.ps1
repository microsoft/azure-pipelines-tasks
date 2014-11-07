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
    $ServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ServiceLocation,

    [String] [Parameter(Mandatory = $true)]
    $StorageAccount,

    [String] [Parameter(Mandatory = $true)]
    $CsPkg,  #of the form **\*.cspkg (or a path right to a cspkg file, if possible)

    [String] [Parameter(Mandatory = $true)]
    $CsCfg,  #of the form **\*.cscfg (or a path right to a cscfg file, if possible)

    [String] [Parameter(Mandatory = $true)]  #default to Production
    $Slot,

    [String] [Parameter(Mandatory = $true)]
    $AllowUpgrade
)

Write-Verbose "Entering script Publish-AzureCloudDeployment.ps1"


Write-Verbose "ServiceName= $ServiceName"
Write-Verbose "ServiceLocation= $ServiceLocation"
Write-Verbose "StorageAccount= $StorageAccount"
Write-Verbose "CsPkg= $CsPkg"
Write-Verbose "CsCfg= $CsCfg"
Write-Verbose "Slot= $Slot"
Write-Verbose "AllowUpgrade=$AllowUpgrade"

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

$allowUpgrade = Convert-String $AllowUpgrade Boolean

Write-Host "Find-Files -SearchPattern $CsCfg"
$serviceConfigFile = Find-Files -SearchPattern "$CsCfg"
Write-Host "serviceConfigFile= $serviceConfigFile" -ForegroundColor Yellow
$serviceConfigFile = Get-SingleFile $serviceConfigFile

Write-Host "Find-Files -SearchPattern $CsPkg"
$servicePackageFile = Find-Files -SearchPattern "$CsPkg"
Write-Host "servicePackageFile= $servicePackageFile" -ForegroundColor Yellow
$servicePackageFile = Get-SingleFile $servicePackageFile

Write-Host "Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue"
$azureService = Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue
if(!$azureService)
{
    Write-Host "New-AzureService -ServiceName $ServiceName -Location $ServiceLocation"
    $azureService = New-AzureService -ServiceName $ServiceName -Location $ServiceLocation
}

Write-Host "Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue"
$azureDeployment = Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue
if(!$azureDeployment)
{
    Write-Host "New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot"
    $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot
} 
elseif ($allowUpgrade -eq $true)
{
    #use upgrade
    Write-Host "Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot"
    $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot
}
else
{
    #delete and then re-create
    Write-Host "Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force"
    Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force
    Write-Host "New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot"
    $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot
}

Write-Verbose "Leaving script Publish-AzureCloudDeployment.ps1"