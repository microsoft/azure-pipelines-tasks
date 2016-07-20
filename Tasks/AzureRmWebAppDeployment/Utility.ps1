$ErrorActionPreference = 'Stop'

function Get-MsDeployExePath
{
    $MSDeployExePath = $null
    try
    {
        $MSDeployExePath , $MSDeployVersion = Get-MSDeployOnTargetMachine
    }
    catch [System.Exception]
    {
         Write-Verbose ("MSDeploy is not installed in system." + $_.Exception.Message)
    }

    if( $MSDeployExePath -ne $null -and $MSDeployVersion -lt 3 ){
        throw  "Unsupported installed version : $MSDeployVersion found for MSDeploy,version should be alteast 3 or above"
    }

    if( [string]::IsNullOrEmpty($MSDeployExePath) )
    {

        Write-Verbose  (Get-VstsLocString -Key "UsinglocalMSDeployexe")  
        $currentDir = (Get-Item -Path ".\").FullName
        $msDeployExeDir = Join-Path $currentDir "MSDeploy3.6"
        $MSDeployExePath = Join-Path $msDeployExeDir "msdeploy.exe"
    
    }
 
    Write-Host (Get-VstsLocString -Key msdeployexeislocatedat0 -ArgumentList $MSDeployExePath)

    return $MSDeployExePath
}

function Get-SingleFile
{
    param([String][Parameter(Mandatory=$true)] $files,
          [String][Parameter(Mandatory=$true)] $pattern)

    if ($files -is [system.array])
    {
        throw (Get-VstsLocString -Key Foundmorethanonefiletodeploywithsearchpattern0Therecanbeonlyone -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-VstsLocString -Key Nofileswerefoundtodeploywithsearchpattern0 -ArgumentList $pattern)
        }

        return $files
    }
}

function Get-SingleFilePath
{
    param([String][Parameter(Mandatory=$true)] $file)

    Write-Host (Get-VstsLocString -Key filePathFindFilesSearchPattern0 -ArgumentList $file)
    $filePath = Find-VstsFiles -LegacyPattern $file
    Write-Host (Get-VstsLocString -Key filePath0 -ArgumentList $filePath)

    $filePath = Get-SingleFile -files $filePath -pattern $file
    return $filePath
}

function Get-WebAppNameForMSDeployCmd
{
    param([String][Parameter(Mandatory=$true)] $webAppName,
          [String][Parameter(Mandatory=$true)] $deployToSlotFlag,
          [String][Parameter(Mandatory=$false)] $slotName)

    $webAppNameForMSDeployCmd = $webAppName
    if($deployToSlotFlag -eq "true")
    {
        $webAppNameForMSDeployCmd += "(" + $SlotName + ")"
    }

    Write-Verbose "WebApp Name to be used in msdeploy command is: '$webAppNameForMSDeployCmd'"
    return $webAppNameForMSDeployCmd
}


function Get-MsDeployCmdArgs
{
    param([String][Parameter(Mandatory=$true)] $packageFile,
          [String][Parameter(Mandatory=$true)] $webAppNameForMSDeployCmd,
          [Object][Parameter(Mandatory=$true)] $azureRMWebAppConnectionDetails,
          [String][Parameter(Mandatory=$true)] $removeAdditionalFilesFlag,
          [String][Parameter(Mandatory=$true)] $excludeFilesFromAppDataFlag,
          [String][Parameter(Mandatory=$true)] $takeAppOfflineFlag,
          [String][Parameter(Mandatory=$false)] $virtualApplication,
          [String][Parameter(Mandatory=$false)] $setParametersFile,
          [String][Parameter(Mandatory=$false)] $AdditionalArguments)

    $msDeployCmdArgs = [String]::Empty
    Write-Verbose "Constructing msdeploy command arguments to deploy to azureRM WebApp:'$webAppNameForMSDeployCmd' `nfrom source Wep App zip package:'$packageFile'."

    # msdeploy argument containing source and destination details to sync
    $msDeployCmdArgs = [String]::Format('-verb:sync -source:package="{0}" -dest:auto,ComputerName="https://{1}/msdeploy.axd?site={2}",UserName="{3}",Password="{4}",AuthType="Basic"' `
                                        , $packageFile, $azureRMWebAppConnectionDetails.KuduHostName, $webAppNameForMSDeployCmd, $azureRMWebAppConnectionDetails.UserName, $azureRMWebAppConnectionDetails.UserPassword)

    # msdeploy argument to set destination IIS App Name for deploy
    if($virtualApplication)
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}/{1}"', $webAppNameForMSDeployCmd, $virtualApplication)
    }
    else
    {
        $msDeployCmdArgs += [String]::Format(' -setParam:name="IIS Web Application Name",value="{0}"', $webAppNameForMSDeployCmd)
    }

    # msdeploy argument to block deletion from happening
    if($removeAdditionalFilesFlag -ne "true")
    {
        $msDeployCmdArgs += " -enableRule:DoNotDeleteRule"
    }

    # msdeploy argument to take app offline
    if($takeAppOfflineFlag -eq "true")
    {
        $msDeployCmdArgs += " -enableRule:AppOffline"
    }

    # msdeploy argument to exclude files in App_Data folder
    if($excludeFilesFromAppDataFlag -eq "true")
    {
        $msDeployCmdArgs += [String]::Format(' -skip:Directory="\\App_Data"')
    }

    if( -not [String]::IsNullOrEmpty($setParametersFile)){
        $msDeployCmdArgs += [String]::Format(' -setParamFile:"{0}"', $setParametersFile)
    }
    
    # msploy additional arguments 
    if( -not [String]::IsNullOrEmpty($AdditionalArguments)){
        $msDeployCmdArgs += ( " " + $AdditionalArguments)
    }
	
	$userAgent = Get-VstsTaskVariable -Name AZURE_HTTP_USER_AGENT
	if (!([string]::IsNullOrEmpty($userAgent))) {
	    $msDeployCmdArgs += [String]::Format(' -userAgent:"{0}"', $userAgent)
	}

    Write-Verbose "Constructed msdeploy command arguments to deploy to azureRM WebApp:'$webAppNameForMSDeployCmd' `nfrom source Wep App zip package:'$packageFile'."
    return $msDeployCmdArgs
}

function Run-Command
{
    param([String][Parameter(Mandatory=$true)] $command)

    try
	{
        if( $psversiontable.PSVersion.Major -le 4)
        {
           cmd.exe /c "`"$command`"" 2>&1
        }
        else
        {
           cmd.exe /c "$command" 2>&1
        }

    }
	catch [System.Exception]
    {
        $exception = $_.Exception
        Write-Verbose "Error occured is $($exception.Message)"
        throw $_.Exception.Message    
    }

}

function Get-MsDeployCmdForLogs
{
    param([String][Parameter(Mandatory=$true)] $msDeployCmd)

    $msDeployCmdSplitByComma = $msDeployCmd.Split(',')
    $msDeployCmdHiddingSensitiveData = $msDeployCmdSplitByComma | ForEach-Object {if ($_.StartsWith("Password")) {$_.Replace($_, "Password=****")} else {$_}}

    $msDeployCmdForLogs = $msDeployCmdHiddingSensitiveData -join ","
    return $msDeployCmdForLogs
}

function Run-MsDeployCommand
{
    param([String][Parameter(Mandatory=$true)] $msDeployExePath,
          [String][Parameter(Mandatory=$true)] $msDeployCmdArgs)

    $msDeployCmd = "`"$msDeployExePath`" $msDeployCmdArgs"
    $msDeployCmdForLogs = Get-MsDeployCmdForLogs -msDeployCmd $msDeployCmd

    Write-Host (Get-VstsLocString -Key Runningmsdeploycommand0 -ArgumentList $msDeployCmdForLogs)
    Run-Command -command $msDeployCmd
    Write-Host (Get-VstsLocString -Key msdeploycommandransuccessfully )
}

function Update-DeploymentStatus
{

    param([Parameter(Mandatory=$true)] $azureRMWebAppConnectionDetails,
          [Parameter(Mandatory=$true)] $deployAzureWebsiteError)

        $webAppPublishKuduUrl = $azureRMWebAppConnectionDetails.KuduHostName
        if ($webAppPublishKuduUrl) {
            # Set status of deployment to failed
            $status = 3 #failed
            $status_text = "failed"

			
            # If there is no error in deployment then set status to success
            if(!$deployAzureWebsiteError) {
                $status = 4 #succeeded
                $status_text = "succeeded"
            }

            $username = $azureRMWebAppConnectionDetails.UserName
            $securePwd = ConvertTo-SecureString $azureRMWebAppConnectionDetails.UserPassword -AsPlainText -Force
            $credential = New-Object System.Management.Automation.PSCredential ($username, $securePwd)

            # Get autor of build or release
            $author = Get-VstsTaskVariable -Name "build.sourceVersionAuthor"
            if([string]::IsNullOrEmpty($author)) {
                # fall back to build/release requestedfor
                $author = Get-VstsTaskVariable -Name "build.requestedfor"
                if([string]::IsNullOrEmpty($author)) {
                    $author = Get-VstsTaskVariable -Name "release.requestedfor"
                }
                # At this point if this is still null, let's use agent name
                if([string]::IsNullOrEmpty($author)) {
                    $author = Get-VstsTaskVariable -Name "agent.name"
                }
            }

            # using buildId/releaseId to update deployment status
            # using buildUrl/releaseUrl to update deployment message
            $buildUrlTaskVar = Get-VstsTaskVariable -Name "build.buildUri"
            $releaseUrlTaskVar = Get-VstsTaskVariable -Name "release.releaseUri"
            $buildIdTaskVar = Get-VstsTaskVariable -Name "build.buildId"
            $releaseIdTaskVar = Get-VstsTaskVariable -Name "release.releaseId"
			
            $collectionUrl = Get-VstsTaskVariable -Name System.TeamFoundationCollectionUri -Require
            $teamproject = Get-VstsTaskVariable -Name System.TeamProject -Require
            $buildOrReleaseUrl = "";
            $uniqueId = Get-Date -Format ddMMyyhhmmss

            if(-not [string]::IsNullOrEmpty($releaseUrlTaskVar)) {
                $deploymentId = $releaseIdTaskVar + $uniqueId
                $buildOrReleaseUrl = [string]::Format("{0}{1}/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId={2}&_a=release-summary", $collectionUrl, $teamproject, $releaseIdTaskVar)
                $message = Get-VstsLocString -Key "Updatingdeploymenthistoryfordeployment0" -ArgumentList $buildOrReleaseUrl
            }
            else
            {
               $deploymentId = $buildIdTaskVar + $uniqueId
               $buildOrReleaseUrl = [string]::Format("{0}{1}/_build#buildId={2}&_a=summary", $collectionUrl, $teamproject, $buildIdTaskVar)
               $message = Get-VstsLocString -Key "Updatingdeploymenthistoryfordeployment0" -ArgumentList $buildOrReleaseUrl
            }

            

            if([string]::IsNullOrEmpty($deploymentId)) {
                #No point in proceeding further
                Write-Warning (Get-VstsLocString -Key "CannotupdatedeploymentstatusuniquedeploymentIdcannotberetrieved")  
                Return
            }

            Write-Verbose "Using deploymentId as: '$deploymentId' to update deployment Status"
            Write-Verbose "Using message as: '$message' to update deployment Status"

            $body = ConvertTo-Json (New-Object -TypeName psobject -Property @{
                status = $status
                status_text = $status_text
                message = $message
                author = $author
                deployer = 'VSTS'
                details = $buildOrReleaseUrl
            })

            $webAppHostUrl = $webAppPublishKuduUrl.split(':')[0]
            $url = [string]::Format("https://{0}/deployments/{1}",[System.Web.HttpUtility]::UrlEncode($webAppHostUrl),[System.Web.HttpUtility]::UrlEncode($deploymentId))

            Write-Verbose "Invoke-RestMethod $url -Credential $credential  -Method PUT -Body $body -ContentType `"application/json`" -UserAgent `"myuseragent`""
            Write-Host (Get-VstsLocString -Key "Updatingdeploymentstatus")
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
                Write-Warning (Get-VstsLocString -Key "Cannotupdatedeploymentstatusfor01" -ArgumentList $WebSiteName, $responseBody)        
            }
        }
        else {
            Write-Warning (Get-VstsLocString -Key "CannotupdatedeploymentstatusSCMendpointisnotenabledforthiswebsite")      
        }
    
}