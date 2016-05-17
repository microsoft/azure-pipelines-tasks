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
Write-Verbose "DoNotDelete (converted) = $DoNotDelete"

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
    #using production slot for website if website name provided doesnot contain any slot
    if ([String]::IsNullOrEmpty($Slot))
    {
        if($WebSiteName -notlike '*(*)*')
        {
            $Slot  = 'Production'
        }
    }

    $extraParameters = @{ }
    if ($Slot) { $extraParameters['Slot'] = $Slot }

    Write-Host "Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError $(if ($Slot) { "-Slot $Slot" })"
    $azureWebSite = Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError @extraParameters
    if($azureWebSiteError){
        $azureWebSiteError | ForEach-Object { Write-Warning $_.Exception.ToString() }
    }

    if($azureWebSite)
    {
        Write-Host "WebSite '$($azureWebSite.Name)' found."
    }
    else
    {
        Write-Host "WebSite '$WebSiteName' not found. Creating it now."

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
    $matchedWebSiteName = $azureWebSite.EnabledHostNames | Where-Object { $_ -like '*.scm*azurewebsites.net*' } | Select-Object -First 1
    if ($matchedWebSiteName) {
        $status = 3 #failed
        if(!$publishAzureWebsiteError) {
            $status = 4 #succeeded
        }

        $username = $azureWebSite.PublishingUsername
        $securePwd = ConvertTo-SecureString $azureWebSite.PublishingPassword -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential ($username, $securePwd)

        $author = Get-TaskVariable $distributedTaskContext "build.sourceVersionAuthor"
        if([string]::IsNullOrEmpty($author)) {
            # fall back to build/release requestedfor
            $author = Get-TaskVariable $distributedTaskContext "build.requestedfor"
            if([string]::IsNullOrEmpty($author)) {
                $author = Get-TaskVariable $distributedTaskContext "release.requestedfor"
            }
            # At this point if this is still null, let's use agent name
            if([string]::IsNullOrEmpty($author)) {
                $author = Get-TaskVariable $distributedTaskContext "agent.name"
            }
        }

        # using buildId/releaseId to update deployment status
        # using buildUrl/releaseUrl to update deployment message
        $buildUrlTaskVar = Get-TaskVariable $distributedTaskContext "build.buildUri"
        $releaseUrlTaskVar = Get-TaskVariable $distributedTaskContext "release.releaseUri"
        $buildIdTaskVar = Get-TaskVariable $distributedTaskContext "build.buildId"
        $releaseIdTaskVar = Get-TaskVariable $distributedTaskContext "release.releaseId"
        if(-not [string]::IsNullOrEmpty($releaseUrlTaskVar)) {
            $deploymentId = $releaseIdTaskVar
            $message = Get-LocalizedString -Key "Updating deployment history for deployment {0}" -ArgumentList $releaseUrlTaskVar
        }
        else
        {
           $deploymentId = $buildIdTaskVar
           $message = Get-LocalizedString -Key "Updating deployment history for deployment {0}" -ArgumentList $buildUrlTaskVar
        }

        Write-Verbose "Using deploymentId as: '$deploymentId' to update deployment Status"
        Write-Verbose "Using message as: '$message' to update deployment Status"

        if([string]::IsNullOrEmpty($deploymentId)) {
            #No point in proceeding further
            Write-Warning (Get-LocalizedString -Key "Cannot update deployment status, unique deploymentId cannot be retrieved")  
            Return
        }

        $collectionUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI".TrimEnd('/')
        $teamproject = "$env:SYSTEM_TEAMPROJECTID"
        $buildUrl = [string]::Format("{0}/{1}/_build#buildId={2}&_a=summary", $collectionUrl, $teamproject, $buildIdTaskVar)

        $body = ConvertTo-Json (New-Object -TypeName psobject -Property @{
            status = $status
            message = $message
            author = $author
            deployer = 'VSTS'
            details = $buildUrl
        })

        $url = [string]::Format("https://{0}/deployments/{1}",[System.Web.HttpUtility]::UrlEncode($matchedWebSiteName),[System.Web.HttpUtility]::UrlEncode($deploymentId))

        Write-Verbose "Invoke-RestMethod $url -Credential $credential  -Method PUT -Body $body -ContentType `"application/json`" -UserAgent `"myuseragent`""
        Write-Host (Get-LocalizedString -Key "Updating deployment status")
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
            Write-Warning (Get-LocalizedString -Key "Cannot update deployment status for {0} - {1}" -ArgumentList $WebSiteName, $responseBody)        
        }
    }
    else {
        Write-Warning (Get-LocalizedString -Key "Cannot update deployment status, SCM endpoint is not enabled for this website")      
    }
}
else {
     Write-Warning (Get-LocalizedString -Key "Cannot get website, deployment status is not updated")
}

Write-Verbose "Leaving script Publish-AzureWebDeployment.ps1"