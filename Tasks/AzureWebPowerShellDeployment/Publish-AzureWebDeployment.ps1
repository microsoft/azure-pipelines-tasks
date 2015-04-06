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

function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw "Found more than one file to deploy with search pattern $pattern.  There can be only one."
    }
    else
    {
        if (!$files)
        {
            throw "No files were found to deploy with search pattern $pattern"
        }
        return $files
    }
}

Write-Host "Entering script Publish-AzureWebDeployment.ps1"

Write-Host "ConnectedServiceName= $ConnectedServiceName"
Write-Host "WebSiteName= $WebSiteName"
Write-Host "Package= $Package"
Write-Host "AdditionalArguments= $AdditionalArguments"

#Find the package to deploy
Write-Host "packageFile= Find-Files -SearchPattern $Package"
$packageFile = Find-Files -SearchPattern $Package
Write-Host "packageFile= $packageFile"

#Ensure that at most a single package (.zip) file is found
$packageFile = Get-SingleFile $packageFile $Package

#If we're provided a WebSiteLocation, check for it and create it if necessary
if($WebSiteLocation)
{
    Write-Host "Get-AzureWebSite -Name `"$WebSiteName`" -ErrorAction SilentlyContinue"
    $azureWebSite = Get-AzureWebSite -Name `"$WebSiteName`" -ErrorAction SilentlyContinue
    if(!$azureWebSite)
    {
        Write-Host "New-AzureWebSite -Name `"$WebSiteName`" -Location $WebSiteLocation"
        $azureWebSite = New-AzureWebSite -Name `"$WebSiteName`" -Location $WebSiteLocation
    }
}

#Deploy the package
$azureCommand = "Publish-AzureWebsiteProject"
$azureCommandArguments = "-Name `"$WebSiteName`" -Package `"$packageFile`" $AdditionalArguments"
$finalCommand = "$azureCommand $azureCommandArguments"
Write-Host "$finalCommand"
Invoke-Expression -Command $finalCommand

Write-Host "Leaving script Publish-AzureWebDeployment.ps1"