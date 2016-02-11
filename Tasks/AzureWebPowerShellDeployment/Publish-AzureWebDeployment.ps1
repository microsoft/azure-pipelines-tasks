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
    $DoNotDelete,

    [String] [Parameter(Mandatory = $false)]
    $AdditionalArguments
)

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

[bool]$DoNotDelete = Convert-String $DoNotDelete Boolean
Write-Verbose "DonotDelete (converted) = $DoNotDelete"

# adding System.Web explicitly, since we use http utility
Add-Type -AssemblyName System.Web

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

Write-Host "packageFile= Find-Files -SearchPattern $Package"
$packageFile = Find-Files -SearchPattern $Package
Write-Host "packageFile= $packageFile"

#Ensure that at most a single package (.zip) file is found
$packageFile = Get-SingleFile $packageFile $Package
$azureWebSiteError = $null

#If we're provided a WebSiteLocation, check for it and create it if necessary
if($WebSiteLocation)
{
    if ($Slot)
    {
        Write-Host "Get-AzureWebSite -Name $WebSiteName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError"
        $azureWebSite = Get-AzureWebSite -Name $WebSiteName -Slot $Slot -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError
    }
    else
    {
        Write-Host "Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError"
        $azureWebSite = Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError
    }
    
    if($azureWebSiteError){
        $azureWebSiteError | ForEach-Object { Write-Warning $_.Exception.ToString() }
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

if($DoNotDelete) {
   $AdditionalArguments = $AdditionalArguments + " -DoNotDelete"
}

if ($Slot)
{
    $azureCommandArguments = "-Name `"$WebSiteName`" -Package `"$packageFile`" -Slot `"$Slot`" $AdditionalArguments -ErrorVariable publishAzureWebsiteError"
}
else
{
    $azureCommandArguments = "-Name `"$WebSiteName`" -Package `"$packageFile`" $AdditionalArguments -ErrorVariable publishAzureWebSiteError"
}

$finalCommand = "$azureCommand $azureCommandArguments"
Write-Host "$finalCommand"
Invoke-Expression -Command $finalCommand

#Update Deployment status - https://github.com/projectkudu/kudu/wiki/REST-API#deployment

if($azureWebSite) {
    
    $status = 3 #failed
    if(!$publishAzureWebsiteError) {
        $status = 4 #succeeded
    }

    $username = $azureWebSite.PublishingUsername
    $securePwd = ConvertTo-SecureString $azureWebSite.PublishingPassword -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential ($username, $securePwd)
    
    $author = Get-TaskVariable $distributedTaskContext "build.sourceVersionAuthor"
    $deploymentId = Get-TaskVariable $distributedTaskContext "build.sourceVersion" #let's use commitId as unique deploymentId
    $message = Get-TaskVariable $distributedTaskContext "build.sourceVersionMessage"
    $buildId = Get-TaskVariable $distributedTaskContext "build.buildId"
    
    $collectionUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI".TrimEnd('/')
    $teamproject = "$env:SYSTEM_TEAMPROJECTID"
    $buildUrl = [string]::Format("{0}/{1}/_build#buildId={2}&_a=summary", $collectionUrl, $teamproject, $buildId)
    
    $body = ConvertTo-Json (New-Object -TypeName psobject -Property @{
        status = $status
        message = $message
        author = $author
        deployer = 'VSTS'
        details = $buildUrl       
    })
    
    $url = [string]::Format("https://{0}.scm.azurewebsites.net/deployments/{1}",[System.Web.HttpUtility]::UrlEncode($WebSiteName),[System.Web.HttpUtility]::UrlEncode($deploymentId))

    Write-Verbose "Invoke-RestMethod $url -Credential $credential  -Method PUT -Body $body -ContentType `"application/json`" -UserAgent `"myuseragent`""
    Write-Host "Updating deployment status"
    try {
        Invoke-RestMethod $url -Credential $credential  -Method PUT -Body $body -ContentType "application/json" -UserAgent "myuseragent"
    } 
    catch {
        Write-Verbose $_.Exception.ToString()        
        $response = $_.Exception.Response
        $responseStream =  $response.GetResponseStream()
        $streamReader = New-Object System.IO.StreamReader($responseStream)
        $streamReader.BaseStream.Position = 0
        $streamReader.DiscardBufferedData()
        $responseBody = $streamReader.ReadToEnd()
        $streamReader.Close()
        Write-Warning "Cannot update deployment status for $WebSiteName - $responseBody"        
    }
}
else {
     Write-Warning "Cannot get azurewebsite, deployment status is not updated"
}

Write-Verbose "Leaving script Publish-AzureWebDeployment.ps1"