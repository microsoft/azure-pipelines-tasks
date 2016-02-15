#
# Store some parameters as context variables so that they can be picked by other tasks, mainly by the "end task"
#
function StoreParametersInTaskContext
{    
	param(
		  [string]$hostUrl,
		  [string]$bootstrapperPath,
		  [string]$dahsboardUrl, 
          [string]$breakBuild)
	
    SetTaskContextVariable "MSBuild.SonarQube.BootstrapperPath" $bootstrapperPath    
    SetTaskContextVariable "MSBuild.SonarQube.HostUrl" $hostUrl   
    SetTaskContextVariable "MSBuild.SonarQube.BreakBuild" $breakBuild    
    SetTaskContextVariable "MSBuild.SonarQube.ProjectUri" $dahsboardUrl
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

        $sqServerVersion = GetSonarQubeServerVersion     

        Write-Verbose "SonarQube server version:$sqServerVersion"

        #strip out '-SNAPSHOT' if it is present in version (developer versions of SonarQube might return version in this format: 5.2-SNAPSHOT)
        $sqServerVersion = ([string]$sqServerVersion).split("-")[0]

        $sqVersion = New-Object -TypeName System.Version -ArgumentList $sqServerVersion
        $sqVersion5dot2 = New-Object -TypeName System.Version -ArgumentList "5.2"

        #For SQ version 5.2+ use issues mode, otherwise use incremental mode. Incremental mode is not supported in SQ 5.2+. -ge below calls the overloaded operator in System.Version class
        if ($sqVersion -ge $sqVersion5dot2)
        {
            $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=issues" + " " + "/d:sonar.report.export.path=sonar-report.json"
        }
        else
        {
            $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=incremental"
        }

		#use this variable in post-test task
		SetTaskContextVariable "MSBuild.SonarQube.AnalysisModeIsIncremental" "true"
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


################# Helpers ######################

#
# Helper that returns the version number of the SonarQube server
#
function GetSonarQubeServerVersion()
{         
    $command = {InvokeGetRestMethod "/api/server/version" }
    $version = Retry $command -maxRetries 2 -retryDelay 1 -Verbose
  
    Write-Verbose "Returning SonarQube server version:$version"

    return $version
}