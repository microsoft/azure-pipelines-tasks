[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $DeploymentEnvironmentName,

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