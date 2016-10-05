Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-VstsLocString -Key "Foundmorethanonefiletodeploywithsearchpattern0Therecanbeonlyone" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-VstsLocString -Key "Nofileswerefoundtodeploywithsearchpattern0" -ArgumentList $pattern)
        }
        return $files
    }
}

try{

    $WebSiteName = Get-VstsInput -Name WebSiteName -Require
    $WebSiteLocation = Get-VstsInput -Name WebSiteLocation
    $Package = Get-VstsInput -Name Package -Require
    $Slot = Get-VstsInput -Name Slot 
    $DoNotDelete = Get-VstsInput -Name DoNotDelete -AsBool
    $AdditionalArguments = Get-VstsInput -Name AdditionalArguments

    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-Azure

    # adding System.Web explicitly, since we use http utility
    Add-Type -AssemblyName System.Web

    Write-Host "Finding $Package"
    $packageFile = Find-VstsFiles -LegacyPattern $Package
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

        Write-Host "##[command]Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError $(if ($Slot) { "-Slot $Slot" })"
        $azureWebSite = Get-AzureWebSite -Name $WebSiteName -ErrorAction SilentlyContinue -ErrorVariable azureWebSiteError @extraParameters
        if($azureWebSiteError){
            $azureWebSiteError | ForEach-Object { Write-Verbose $_.Exception.ToString() }
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
                Write-Host "##[command]New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation -Slot $Slot"
                $azureWebSite = New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation -Slot $Slot
            }
            else
            {
                Write-Host "##[command]New-AzureWebSite -Name $WebSiteName -Location $WebSiteLocation"
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

            $author = Get-VstsTaskVariable -Name "build.sourceVersionAuthor"
            if(!$author) {
                # fall back to build/release requestedfor
                $author = Get-VstsTaskVariable -Name "build.requestedfor"
                if(!$author) {
                    $author = Get-VstsTaskVariable -Name "release.requestedfor"
                }
                # At this point if this is still null, let's use agent name
                if(!$author) {
                    $author = Get-VstsTaskVariable -Name "agent.name"
                }
            }

            # using buildId/releaseId to update deployment status
            # using buildUrl/releaseUrl to update deployment message
            $buildUrlTaskVar = Get-VstsTaskVariable -Name "build.buildUri"
            $releaseUrlTaskVar = Get-VstsTaskVariable -Name "release.releaseUri"
            $buildIdTaskVar = Get-VstsTaskVariable -Name "build.buildId"
            $releaseIdTaskVar = Get-VstsTaskVariable -Name "release.releaseId"
            if($releaseUrlTaskVar) {
                $deploymentId = $releaseIdTaskVar
                $message = Get-VstsLocString -Key "Updatingdeploymenthistoryfordeployment0" -ArgumentList $releaseUrlTaskVar
            }
            else
            {
               $deploymentId = $buildIdTaskVar
               $message = Get-VstsLocString -Key "Updatingdeploymenthistoryfordeployment0" -ArgumentList $buildUrlTaskVar
            }

            Write-Verbose "Using deploymentId as: '$deploymentId' to update deployment Status"
            Write-Verbose "Using message as: '$message' to update deployment Status"

            if(!$deploymentId) {
                #No point in proceeding further
                Write-Warning (Get-VstsLocString -Key "CannotupdatedeploymentstatusuniquedeploymentIdcannotberetrieved")  
                Return
            }

            $collectionUrl = Get-VstsTaskVariable -Name System.TeamFoundationCollectionUri -Require
            $teamproject = Get-VstsTaskVariable -Name System.TeamProject -Require
            $buildUrl = [string]::Format("{0}/{1}/_build#buildId={2}&_a=summary", $collectionUrl, $teamproject, $buildIdTaskVar)

            $body = ConvertTo-Json (New-Object -TypeName psobject -Property @{
                status = $status
                message = $message
                author = $author
                deployer = 'VSTS'
                details = $buildUrl
            })

            $userAgent = Get-VstsTaskVariable -Name AZURE_HTTP_USER_AGENT

            $url = [string]::Format("https://{0}/deployments/{1}",[System.Web.HttpUtility]::UrlEncode($matchedWebSiteName),[System.Web.HttpUtility]::UrlEncode($deploymentId))

            Write-Verbose "##[command]Invoke-RestMethod $url -Credential $credential  -Method PUT -Body $body -ContentType `"application/json`" -UserAgent `"myuseragent`""
            Write-Host (Get-VstsLocString -Key "Updatingdeploymentstatus")
            try {
                Invoke-RestMethod $url -Credential $credential  -Method PUT -Body $body -ContentType "application/json" -UserAgent $userAgent
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
                Write-Warning (Get-VstsLocString -Key "Cannotupdatedeploymentstatusfor01" -ArgumentList $WebSiteName, $responseBody)        
            }
        }
        else {
            Write-Warning (Get-VstsLocString -Key "CannotupdatedeploymentstatusSCMendpointisnotenabledforthiswebsite")      
        }
    }
    else {
         Write-Warning (Get-VstsLocString -Key "Cannotgetwebsitedeploymentstatusisnotupdated")
    }


} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
