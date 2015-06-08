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
    $Slot, 

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

Write-Host "ConnectedServiceName= $ConnectedServiceName"
Write-Host "WebSiteName= $WebSiteName"
Write-Host "Package= $Package"
Write-Host "Slot= $Slot"
Write-Host "AdditionalArguments= $AdditionalArguments"

#Find the package to deploy
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Host "packageFile= Find-Files -SearchPattern $Package"
$packageFile = Find-Files -SearchPattern $Package
Write-Host "packageFile= $packageFile"

#Ensure that at most a single package (.zip) file is found
$packageFile = Get-SingleFile $packageFile $Package

#If we're provided a WebSiteLocation, check for it and create it if necessary
if($WebSiteLocation)
{
    if ($Slot)
    {
        Write-Host "Get-AzureWebSite -Name $WebSiteName -Slot $Slot -ErrorAction SilentlyContinue"
        $azureWebSite = Get-AzureWebSite -Name $WebSiteName -Slot $Slot -ErrorAction SilentlyContinue
    }
    else
    {
        Write-Host "Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue"
        $azureWebSite = Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue
    }
    
    if(!$azureWebSite)
    {
        if ($Slot)
        {
            Write-Host "New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation -Slot $Slot"
            $azureWebSite = New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation -Slot $Slot
        }
        else
        {
            Write-Host "New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation"
            $azureWebSite = New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation
        }
    }
}

#Deploy the package
$azureCommand = "Publish-AzureWebsiteProject"
if ($Slot)
{
    $azureCommandArguments = "-Name `"$WebSiteName`" -Package `"$packageFile`" -Slot `"$Slot`" $AdditionalArguments"
}
else
{
    $azureCommandArguments = "-Name `"$WebSiteName`" -Package `"$packageFile`" $AdditionalArguments"
}
$finalCommand = "$azureCommand $azureCommandArguments"
Write-Host "$finalCommand"
Invoke-Expression -Command $finalCommand

Write-Verbose "Leaving script Publish-AzureWebDeployment.ps1"
