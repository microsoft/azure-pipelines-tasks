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
    $WebSiteName,

    [String] [Parameter(Mandatory = $true)]
    $Package,

    [String] [Parameter(Mandatory = $false)]
    $AdditionalArguments
)

Write-Host "Entering script Publish-AzureWebDeployment.ps1"

Write-Host "DeploymentEnvironmentName= $DeploymentEnvironmentName"
Write-Host "WebSiteName= $WebSiteName"
Write-Host "Package= $Package"
Write-Verbose "AdditionalArguments= $AdditionalArguments"

if (!$distributedTaskContext) #running directly via command line
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

#Find the package to deploy
Write-Host "packageFile = Find-Files -SearchPattern $Package"
$packageFile = Find-Files -SearchPattern $Package
Write-Host "packageFile= $packageFile"

#Ensure that at most a single package (.zip) file is found
$packageFile = Get-SingleFile $packageFile

#Deploy the package
$azureCommand = "Publish-AzureWebsiteProject"
$azureCommandArguments = "-Name $WebSiteName -Package $packageFile -Verbose $AdditionalArguments"
$finalCommand = "$azureCommand $azureCommandArguments"
Write-Host "finalCommand= $finalCommand"
Invoke-Expression -Command $finalCommand

Write-Host "Leaving script Publish-AzureWebDeployment.ps1"