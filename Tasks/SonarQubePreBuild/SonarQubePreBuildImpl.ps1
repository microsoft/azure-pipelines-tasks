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

	SetTaskContextVariable "MsBuild.SonarQube.ServerUsername" $serverUsername
	SetTaskContextVariable "MsBuild.SonarQube.ServerPassword" $serverPassword
	SetTaskContextVariable "MsBuild.SonarQube.DbUsername" $dbUsername
	SetTaskContextVariable "MsBuild.SonarQube.DbPassword" $dbPassword
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

    [void]$sb.Append(" /k:""$projectKey"" /n:""$projectName"" /v:""$projectVersion""");

    if ([String]::IsNullOrWhiteSpace($serverUrl))
    {   
		throw "Please setup a generic endpoint and specify the SonarQube Url as the Server Url" 
	}

	[void]$sb.Append(" /d:sonar.host.url=""$serverUrl""")

    if (![String]::IsNullOrWhiteSpace($serverUsername))
    {
        [void]$sb.Append(" /d:sonar.login=""$serverUsername""")
    }

    if (![String]::IsNullOrWhiteSpace($serverPassword))
    {
        [void]$sb.Append(" /d:sonar.password=""$serverPassword""")
    }

    if (![String]::IsNullOrWhiteSpace($dbUrl))
    {
        [void]$sb.Append(" /d:sonar.jdbc.url=""$dbUrl""")
    }

    if (![String]::IsNullOrWhiteSpace($dbUsername))
    {
        [void]$sb.Append(" /d:sonar.jdbc.username=""$dbUsername""")
    }

    if (![String]::IsNullOrWhiteSpace($dbPassword))
    {
        [void]$sb.Append(" /d:sonar.jdbc.password=""$dbPassword""")
    }

    if (![String]::IsNullOrWhiteSpace($additionalArguments))
    {
        [void]$sb.Append(" " + $additionalArguments)
    }

    if (IsFilePathSpecified $configFile)
    {
        if (![System.IO.File]::Exists($configFile))
        {
            throw "Could not find the specified configuration file: $configFile" 
        }

        [void]$sb.Append(" /s:$configFile")
    }

    return $sb.ToString();
}

function UpdateArgsForPullRequestAnalysis
{
	param([string]$cmdLineArgs)

	$prcaEnabled = GetTaskContextVariable "PullRequestSonarQubeCodeAnalysisEnabled"
	if ($prcaEnabled -ieq "true")
	{
		if ($cmdLineArgs -and $cmdLineArgs.ToString().Contains("sonar.analysis.mode"))
		{
			throw "Error: sonar.analysis.mode seems to be set already. Please check the properties of SonarQube build tasks and try again."
		}

		Write-Verbose "PullRequestSonarQubeCodeAnalysisEnabled is true, setting command line args for incremental mode for sonar-runner..."

		$cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=incremental"

		#use this variable in post-test task
		SetTaskContextVariable "MsBuild.SonarQube.AnalysisModeIsIncremental" "true"
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

# Set a variable in a property bag that is accessible by all steps
# To retrieve the variable use $val = Get-Variable $distributedTaskContext "varName"
function SetTaskContextVariable
{
    param([string][ValidateNotNullOrEmpty()]$varName, 
          [string]$varValue)
    
    Write-Host "##vso[task.setvariable variable=$varName;]$varValue"
}

function GetTaskContextVariable()
{
	param([string][ValidateNotNullOrEmpty()]$varName)
	return Get-TaskVariable -Context $distributedTaskContext -Name $varName
}

#
# Helper that informs if a "filePath" has been specified. The platform will return the root of the repo / workspace if the user enters nothing.
#
function IsFilePathSpecified
{
     param([string]$path)

     if ([String]::IsNullOrWhiteSpace($path))
     {
        return $false
     }

     return ![String]::Equals(
                [System.IO.Path]::GetFullPath($path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar),
                [System.IO.Path]::GetFullPath($env:BUILD_SOURCESDIRECTORY).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar),
                [StringComparison]::OrdinalIgnoreCase)
}

