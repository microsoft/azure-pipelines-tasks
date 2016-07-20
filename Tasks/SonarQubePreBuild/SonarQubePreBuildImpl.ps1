#
# Orchestrates the pre build task logic
#
function InvokePreBuildTask
{
    $serviceEndpoint = GetEndpointData $connectedServiceName
    Write-VstsTaskVerbose "Server Url: $($serviceEndpoint.Url)"

    $currentDir = (Get-Item -Path ".\" -Verbose).FullName
    $bootstrapperDir = [System.IO.Path]::Combine($currentDir, "SonarQube.Bootstrapper") 
    $bootstrapperPath = [System.IO.Path]::Combine($bootstrapperDir, "MSBuild.SonarQube.Runner.exe")
    $dashboardUrl = GetDashboardUrl $serviceEndpoint.Url $projectKey
    Write-VstsTaskVerbose "Dashboard Url: $dashboardUrl"
    
    ResetTaskContext
    StoreParametersInTaskContext $serviceEndpoint.Url $bootstrapperPath $dashboardUrl $includeFullReport $breakBuild
    StoreSensitiveParametersInTaskContext $serviceEndpoint.Auth.Parameters.UserName $serviceEndpoint.Auth.Parameters.Password $dbUsername $dbPassword

    $cmdLineArgs = UpdateArgsForPullRequestAnalysis $cmdLineArgs $serviceEndpoint
    Write-VstsTaskVerbose -Verbose $cmdLineArgs

    $arguments = CreateCommandLineArgs $projectKey $projectName $projectVersion $serviceEndpoint.Url $serviceEndpoint.Auth.Parameters.UserName $serviceEndpoint.Auth.Parameters.Password $dbUrl $dbUsername $dbPassword $cmdLineArgs $configFile

    Invoke-VstsTool -FileName $bootstrapperPath -Arguments $arguments -RequireExitCodeZero
}

#
# Store some parameters as context variables so that they can be picked by other tasks, mainly by the "end task"
#
function StoreParametersInTaskContext
{    
	param(
		  [string]$hostUrl,
		  [string]$bootstrapperPath,
		  [string]$dashboardUrl,
          [string]$includeFullReport, 
          [string]$breakBuild)
	
    SetTaskContextVariable "MSBuild.SonarQube.Internal.BootstrapperPath" $bootstrapperPath    
    SetTaskContextVariable "MSBuild.SonarQube.HostUrl" $hostUrl
    SetTaskContextVariable "MSBuild.SonarQube.ProjectUri" $dashboardUrl   
    SetTaskContextVariable "MSBuild.SonarQube.Internal.BreakBuild" $breakBuild
    SetTaskContextVariable "MSBuild.SonarQube.Internal.IncludeFullReport" $includeFullReport        
}

#
# Some data is cached into the task context so it needs to be reset 
#
function ResetTaskContext
{
    SetTaskContextVariable "MSBuild.SonarQube.AnalysisId" ""
    SetTaskContextVariable "MSBuild.SonarQube.QualityGateStatus" ""
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
		throw (Get-VstsLocString -Key "Error_Endpoint") 
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
            throw (Get-VstsLocString -Key "Error_Config" -ArgumentList $configFile) 
        }

        [void]$sb.Append(" /s:" + (EscapeArg($configFile))) 
    }

    return $sb.ToString();
}

function UpdateArgsForPullRequestAnalysis($cmdLineArgs)
{       
    if (IsPRBuild)
    {
        if ($cmdLineArgs -and $cmdLineArgs.ToString().Contains("sonar.analysis.mode"))
        {
             throw (Get-VstsLocString -Key "Error_Pr_Config")
        }

        Write-VstsTaskVerbose "Detected a PR build - running the SonarQube analysis in issues / incremental mode"

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

	$serviceEndpoint = Get-VstsEndpoint -Name $connectedServiceName

	if (!$serviceEndpoint)
	{
        throw (Get-VstsLocString -Key "Error_Endpoint_Name" -ArgumentList $connectedServiceName)
	}

	$authScheme = $serviceEndpoint.Auth.Scheme
	if ($authScheme -ne 'UsernamePassword')
	{
        throw (Get-VstsLocString -Key "Error_Endpoint_Auth" -ArgumentList $authScheme)
	}

    return $serviceEndpoint
}

function GetDashboardUrl
{
    param ([Uri]$serviceEndpointUrl, [string]$projectKey)
    
    $serviceUrlString = $serviceEndpointUrl.ToString().TrimEnd('/')
    return "$serviceUrlString/dashboard/index?id=$($projectKey)"
}