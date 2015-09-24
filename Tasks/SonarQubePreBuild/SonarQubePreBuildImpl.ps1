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

function UpdateArgsForPullRequestAnalysis($cmdLineArgs, $serviceEndpoint)
{
    $prcaEnabled = GetTaskContextVariable "PullRequestSonarQubeCodeAnalysisEnabled"
    if ($prcaEnabled -ieq "true")
    {
        if ($cmdLineArgs -and $cmdLineArgs.ToString().Contains("sonar.analysis.mode"))
        {
            throw "Error: sonar.analysis.mode seems to be set already. Please check the properties of SonarQube build tasks and try again."
        }

        Write-Verbose "PullRequestSonarQubeCodeAnalysisEnabled is true, setting command line args for sonar-runner."
        $sqServerVersion = GetSonarQubeServerVersion $serviceEndpoint.Url

        if (!$sqServerVersion)
        {
            #we want to fail the build step if SonarQube server version isn't fetched
            throw "Error: Unable to fetch SonarQube server version. Please make sure SonarQube server is reachable at $($serviceEndpoint.Url)"
        }

        Write-Verbose "SonarQube server version:$sqServerVersion"

        #strip out '-SNAPSHOT' if it is present in version (developer versions of SonarQube might return version in this format: 5.2-SNAPSHOT)
        $sqServerVersion = $sqServerVersion.ToUpper().Replace("-SNAPSHOT", "")

        $sqVersion = New-Object -TypeName System.Version -ArgumentList $sqServerVersion
        $sqVersion5dot2 = New-Object -TypeName System.Version -ArgumentList "5.2"

        #For SQ version 5.2+ use issues mode, otherwise use incremental mode. Incremental mode is not supported in SQ 5.2+. -ge below calls the overloaded operator in System.Version class
        if ($sqServerVersion -ge $sqVersion5dot2)
        {
            $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=issues" + " " + "/d:sonar.report.export.path=sonar-report.json"
        }
        else
        {
            $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=incremental"
        }

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


function GetVersionString($uri)
{
    $version = $null

    Try
    {
        $version = Invoke-RestMethod -Uri $uri -Method Get
    }
    Catch [System.Net.WebException]
    {
        Write-Verbose "WebException while trying to invoke $uri. Exception msg:$($_.Exception.Message)"
    }

    return $version
}

#
# Helper that returns the version number of the SonarQube server
#
function GetSonarQubeServerVersion()
{
    param([String][ValidateNotNullOrEmpty()]$serverUrl)

    Write-Host "Fetching SonarQube server version.."

    $serverUri = New-Object -TypeName System.Uri -ArgumentList $serverUrl
    $serverApiUri = New-Object -TypeName System.Uri -ArgumentList ($serverUri, "/api/server/version")

    $sqVersion = GetVersionString $serverApiUri

    if(!$sqVersion)
    {
        Write-Verbose "Trying to fetch SonarQube version number again.."
        Start-Sleep -s 2

        $sqVersion = GetVersionString $serverApiUri
    }

    Write-Verbose "Returning SonarQube server version:$sqVersion"
    return $sqVersion
}
