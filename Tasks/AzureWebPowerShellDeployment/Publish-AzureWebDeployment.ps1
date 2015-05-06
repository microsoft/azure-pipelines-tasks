[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $WebSiteName,

    [String] [Parameter(Mandatory = $false)]
    $WebSiteLocation,

    [String] [Parameter(Mandatory = $true)]
    $Package,

    [String] [Parameter(Mandatory = $false)]
    $AdditionalArguments
)

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

function Get-SingleFile($files, $pattern)
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
        return $files
    }
}

Write-Verbose "Entering script Publish-AzureWebDeployment.ps1"

Write-Verbose "ConnectedServiceName= $ConnectedServiceName"
Write-Verbose "WebSiteName= $WebSiteName"
Write-Verbose "Package= $Package"
Write-Verbose "AdditionalArguments= $AdditionalArguments"

#Find the package to deploy
Write-Verbose "packageFile= Find-Files -SearchPattern $Package"
$packageFile = Find-Files -SearchPattern $Package
Write-Verbose "packageFile= $packageFile"

#Ensure that at most a single package (.zip) file is found
$packageFile = Get-SingleFile $packageFile $Package

#If we're provided a WebSiteLocation, check for it and create it if necessary
if($WebSiteLocation)
{
    Write-Host "Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue"
    $azureWebSite = Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue
    if(!$azureWebSite)
    {
        Write-Host "New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation"
        $azureWebSite = New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation
    }
}

#Deploy the package
$azureCommand = "Publish-AzureWebsiteProject"
$azureCommandArguments = "-Name `"$WebSiteName`" -Package `"$packageFile`" $AdditionalArguments"
$finalCommand = "$azureCommand $azureCommandArguments"
Write-Host "$finalCommand"
Invoke-Expression -Command $finalCommand

Write-Verbose "Leaving script Publish-AzureWebDeployment.ps1"