#
# Orchestrates the pre build task logic
#
function InvokePreBuildTask
{
    $serviceEndpoint = GetEndpointData $connectedServiceName
    Write-Verbose "Server Url: $($serviceEndpoint.Url)"

    $currentDir = (Get-Item -Path ".\" -Verbose).FullName
    $bootstrapperDir = [System.IO.Path]::Combine($currentDir, "MSBuild.SonarQube.Runner-1.1") # the MSBuild.SonarQube.Runner is version specific
    $bootstrapperPath = [System.IO.Path]::Combine($bootstrapperDir, "MSBuild.SonarQube.Runner.exe")
    $dashboardUrl = GetDashboardUrl $serviceEndpoint.Url $projectKey
    Write-Verbose "Dashboard Url: $dashboardUrl"
    
    StoreParametersInTaskContext $serviceEndpoint.Url $bootstrapperPath $dashboardUrl $includeFullReport $breakBuild
    StoreSensitiveParametersInTaskContext $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUsername $dbPassword

    $cmdLineArgs = UpdateArgsForPullRequestAnalysis $cmdLineArgs $serviceEndpoint
    Write-Verbose -Verbose $cmdLineArgs

    $arguments = CreateCommandLineArgs $projectKey $projectName $projectVersion $serviceEndpoint.Url $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUrl $dbUsername $dbPassword $cmdLineArgs $configFile

    Invoke-BatchScript $bootstrapperPath -Arguments $arguments
}

#
# Store some parameters as context variables so that they can be picked by other tasks, mainly by the "end task"
#
function StoreParametersInTaskContext
{    
	param(
		  [string]$hostUrl,
		  [string]$bootstrapperPath,
		  [string]$dahsboardUrl,
          [string]$includeFullReport, 
          [string]$breakBuild)
	
    SetTaskContextVariable "MSBuild.SonarQube.Internal.BootstrapperPath" $bootstrapperPath    
    SetTaskContextVariable "MSBuild.SonarQube.HostUrl" $hostUrl
    SetTaskContextVariable "MSBuild.SonarQube.ProjectUri" $dahsboardUrl   
    SetTaskContextVariable "MSBuild.SonarQube.Internal.BreakBuild" $breakBuild
    SetTaskContextVariable "MSBuild.SonarQube.Internal.IncludeFullReport" $includeFullReport        
}


#
# Remarks: Some sensitive parameters cannot be stored on the agent between the 2 steps so 
# we'll store them in the task context and pass them to the post-test step
#
function StoreSensitiveParametersInTaskContext
{ 
	param(
		  [string]$serverUsername,
		  [string]$serverPassword,
		  [string]$dbUsername,
		  [string]$dbPassword)

	SetTaskContextVariable "MSBuild.SonarQube.ServerUsername" $serverUsername
	SetTaskContextVariable "MSBuild.SonarQube.ServerPassword" $serverPassword
	SetTaskContextVariable "MSBuild.SonarQube.DbUsername" $dbUsername
	SetTaskContextVariable "MSBuild.SonarQube.DbPassword" $dbPassword
}

function CreateCommandLineArgs
{
    param(
          [ValidateNotNullOrEmpty()][string]$projectKey,
          [ValidateNotNullOrEmpty()][string]$projectName,
          [ValidateNotNullOrEmpty()][string]$projectVersion,
          [string]$serverUrl,
	      [string]$serverUsername,
		  [string]$serverPassword,
		  [string]$dbUrl,
		  [string]$dbUsername,
		  [string]$dbPassword,
          [string]$additionalArguments,
          [string]$configFile)
	

    $sb = New-Object -TypeName "System.Text.StringBuilder"; 

    # Append is a fluent API, i.e. it returns the StringBuilder. However powershell will return-capture the data and use it in the return value of this function.
    # To avoid this, ignore the Append return value using [void]
    [void]$sb.Append("begin");

    [void]$sb.Append(" /k:" + (EscapeArg($projectKey)) + " /n:" + (EscapeArg($projectName)) + " /v:" + (EscapeArg($projectVersion)));

    if ([String]::IsNullOrWhiteSpace($serverUrl))
    {   
		throw "Please setup a generic endpoint and specify the SonarQube Url as the Server Url" 
	}

	[void]$sb.Append(" /d:sonar.host.url=" + (EscapeArg($serverUrl))) 

    if (![String]::IsNullOrWhiteSpace($serverUsername))
    {
        [void]$sb.Append(" /d:sonar.login=" + (EscapeArg($serverUsername))) 
    }

    if (![String]::IsNullOrWhiteSpace($serverPassword))
    {
        [void]$sb.Append(" /d:sonar.password=" + (EscapeArg($serverPassword))) 
    }

    if (![String]::IsNullOrWhiteSpace($dbUrl))
    {
        [void]$sb.Append(" /d:sonar.jdbc.url=" + (EscapeArg($dbUrl))) 
    }

    if (![String]::IsNullOrWhiteSpace($dbUsername))
    {
        [void]$sb.Append(" /d:sonar.jdbc.username=" + (EscapeArg($dbUsername))) 
    }

    if (![String]::IsNullOrWhiteSpace($dbPassword))
    {
        [void]$sb.Append(" /d:sonar.jdbc.password=" + (EscapeArg($dbPassword))) 
    }

    if (![String]::IsNullOrWhiteSpace($additionalArguments))
    {
        [void]$sb.Append(" " + $additionalArguments) # the user should take care of escaping the extra settings
    }

    if (IsFilePathSpecified $configFile)
    {
        if (![System.IO.File]::Exists($configFile))
        {
            throw "Could not find the specified configuration file: $configFile" 
        }

        [void]$sb.Append(" /s:" + (EscapeArg($configFile))) 
    }

    return $sb.ToString();
}

function UpdateArgsForPullRequestAnalysis($cmdLineArgs)
{       
    if (IsPrBuild)
    {
        if ($cmdLineArgs -and $cmdLineArgs.ToString().Contains("sonar.analysis.mode"))
        {
            throw "Error: sonar.analysis.mode seems to be set already. Please check the properties of SonarQube build tasks and try again."
        }

        Write-Verbose "Detected a PR build - running the SonarQube analysis in issues / incremental mode"

        # For SQ version 5.2+ use issues mode, otherwise use incremental mode. Incremental mode is not supported in SQ 5.2+.         
        if ((CompareSonarQubeVersionWith52) -ge 0)
        {
            $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=issues" + " " + "/d:sonar.report.export.path=sonar-report.json"
        }
        else
        {
            $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=incremental"
        }
	}

	return $cmdLineArgs
}

# Retrieves the url, username and password from the specified generic endpoint.
# Only UserNamePassword authentication scheme is supported for SonarQube.
function GetEndpointData
{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)

	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}

	$authScheme = $serviceEndpoint.Authorization.Scheme
	if ($authScheme -ne 'UserNamePassword')
	{
		throw "The authorization scheme $authScheme is not supported for a SonarQube server."
	}

    return $serviceEndpoint
}

function GetDashboardUrl
{
    param ([Uri]$serviceEndpointUrl, [string]$projectKey)
    
    Write-Verbose $projectKey
    Write-Verbose $serviceEndpointUrl
    Write-Verbose $serviceEndpointUrl.ToString()
    
    $serviceUrlString = $serviceEndpointUrl.ToString().TrimEnd('/')
    return "$serviceUrlString/dashboard/index?id=$($projectKey)"
}