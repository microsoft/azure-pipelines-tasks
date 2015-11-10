function ConfigureJDK
{
	param([string]$javaHomeSelection, [string]$jdkVersion, [string]$jdkArchitecture,  [string]$jdkUserInputPath)

	# If JAVA_HOME is being set by choosing a JDK version find the path to that specified version else use the path given by the user
	$jdkPath = $null
	if($javaHomeSelection -eq 'JDKVersion')
	{
		Write-Verbose "Using JDK version to find and set JAVA_HOME"
		# If the JDK version is not the deafult set the jdkPath to the new JDK version selected
		if($jdkVersion -and ($jdkVersion -ne "default"))
		{
			$jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
			if (!$jdkPath) 
			{
				throw (Get-LocalizedString -Key 'Could not find JDK {0} {1}. Please make sure the selected JDK is installed properly.' -ArgumentList $jdkVersion, $jdkArchitecture)
			}
		}
	}
	else
	{
		Write-Verbose "Using path from user input to set JAVA_HOME"
		if($jdkUserInputPath -and (Test-Path -LiteralPath $jdkUserInputPath))
		{
			$jdkPath = $jdkUserInputPath
		}
		else
		{
			 throw (Get-LocalizedString -Key "The specified JDK path does not exist. Please provide a valid path.")
		}
	}

	# If jdkPath is set to something other than the default then update JAVA_HOME
	if ($jdkPath)
	{
		Write-Host "Setting JAVA_HOME to $jdkPath"
		$env:JAVA_HOME = $jdkPath
		Write-Verbose "JAVA_HOME set to $env:JAVA_HOME"
	}
}

function PublishTestResults
{
	param([string]$publishJUnitResults,
		  [string]$testResultsFiles,
		  [string]$testRunTitle)

	$publishJUnitResultsFromAntBuild = Convert-String $publishJUnitResults Boolean

	if($publishJUnitResultsFromAntBuild)
	{
	   # check for JUnit test result files
		$matchingTestResultsFiles = Find-Files -SearchPattern $testResultsFiles
		if (!$matchingTestResultsFiles)
		{
			Write-Host "No JUnit test results files were found matching pattern '$testResultsFiles', so publishing JUnit test results is being skipped."
		}
		else
		{
			Write-Verbose "Calling Publish-TestResults"
			if([string]::IsNullOrWhiteSpace($testRunTitle))
			{
				Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext
			}
			else
			{
				Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext -RunTitle $testRunTitle
			}
		}    
	}
	else
	{
		Write-Verbose "Option to publish JUnit Test results produced by Maven build was not selected and is being skipped."
	}
}

function RunSonarQubeAnalysis
{
	param([string]$sqAnalysisEnabled,
		  [string]$sqConnectedServiceName,
		  [string]$sqDbDetailsRequired,
		  [string]$sqDbUrl,
		  [string]$sqDbUsername,
		  [string]$sqDbPassword, 
		  [string]$userOptions,
		  [string]$mavenPOMFile)

	# SonarQube Analysis - there is a known issue with the SonarQube Maven plugin that the sonar:sonar goal should be run independently
	$sqAnalysisEnabledBool = Convert-String $sqAnalysisEnabled Boolean

	if ($sqAnalysisEnabledBool)
	{
		Write-Host "SonarQube analysis is enabled"

		$sqServiceEndpoint = GetSonarQubeEndpointData $sqConnectedServiceName
		$sqDbDetailsRequiredBool = Convert-String $sqDbDetailsRequired Boolean 

		if ($sqDbDetailsRequiredBool)
		{
			$sqArguments = CreateSonarQubeArgs $sqServiceEndpoint.Url $sqServiceEndpoint.Authorization.Parameters.UserName $sqServiceEndpoint.Authorization.Parameters.Password $sqDbUrl $sqDbUsername $sqDbPassword
		}
		else
		{
			# The platform may cache the db details values so we force them to be empty
			$sqArguments = CreateSonarQubeArgs $sqServiceEndpoint.Url $sqServiceEndpoint.Authorization.Parameters.UserName $sqServiceEndpoint.Authorization.Parameters.Password "" "" ""
		}

		$sqArguments = $userOptions + " " + $sqArguments
		Write-Verbose "Running Maven with goal sonar:sonar and options: $sqArguments"

		Invoke-Maven -MavenPomFile $mavenPOMFile -Options $sqArguments -Goals "sonar:sonar"
	 }
}

# Retrieves the url, username and password from the specified generic endpoint.
# Only UserNamePassword authentication scheme is supported for SonarQube.
function GetSonarQubeEndpointData
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

# Creates a string with command line params that the SQ-Maven plugin understands 
function CreateSonarQubeArgs
{
    param(
          [string]$serverUrl,
	      [string]$serverUsername,
		  [string]$serverPassword,
		  [string]$dbUrl,
		  [string]$dbUsername,
		  [string]$dbPassword)
	
    $sb = New-Object -TypeName "System.Text.StringBuilder"; 

    # Append is a fluent API, i.e. it returns the StringBuilder. However powershell will return the data and use it in the return value.
    # To avoid this, force it to ignore the Append return value using [void]

    if (![String]::IsNullOrWhiteSpace($serverUrl))
    {    
        [void]$sb.Append("-Dsonar.host.url=""$serverUrl""")
    }

    if (![String]::IsNullOrWhiteSpace($serverUsername))
    {
        [void]$sb.Append(" -Dsonar.login=""$serverUsername""")
    }

    if (![String]::IsNullOrWhiteSpace($serverPassword))
    {
        [void]$sb.Append(" -Dsonar.password=""$serverPassword""")
    }

    if (![String]::IsNullOrWhiteSpace($dbUrl))
    {
        [void]$sb.Append(" -Dsonar.jdbc.url=""$dbUrl""")
    }

    if (![String]::IsNullOrWhiteSpace($dbUsername))
    {
        [void]$sb.Append(" -Dsonar.jdbc.username=""$dbUsername""")
    }

    if (![String]::IsNullOrWhiteSpace($dbPassword))
    {
        [void]$sb.Append(" -Dsonar.jdbc.password=""$dbPassword""")
    }

    return $sb.ToString();
}


function PublishCodeCoverageJacoco
{
    param(
          [Boolean]$isCoverageEnabled,
	      [string]$mavenPOMFile,
		  [string]$CCReportTask,
		  [string]$summaryFile,
		  [string]$reportDirectory,
		  [string]$codeCoverageTool,
		  [string]$reportPOMFile)
	
     # check if code coverage has been enabled
    if($isCoverageEnabled)
    {
		# run report code coverage task which generates code coverage reports.
		$reportsGenerationFailed = $false
		Write-Verbose "Collecting code coverage reports" -Verbose
		try
		{
			if(Test-Path $reportPOMFile)
			{
				#multi module project
				Invoke-Maven -MavenPomFile $reportPOMFile -Goals "verify"
			}
			else
			{
				Invoke-Maven -MavenPomFile $mavenPOMFile -Goals $CCReportTask
			}
        }
		catch
		{
			$reportsGenerationFailed = $true
		}
       
       if(-not $reportsGenerationFailed -and (Test-Path $summaryFile))
       {
    		Write-Verbose "Summary file = $summaryFile" -Verbose
    		Write-Verbose "Report directory = $reportDirectory" -Verbose
    		Write-Verbose "Calling Publish-CodeCoverage" -Verbose
    		Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
       }
       else
       {
    		Write-Warning "No code coverage found to publish. There might be a build failure resulting in no code coverage or there might be no tests." -Verbose
       }
    }

}

function PublishCodeCoverageCobertura
{
    param(
          [Boolean]$isCoverageEnabled,
	      [string]$mavenPOMFile,
		  [string]$summaryFile,
		  [string]$reportDirectory,
		  [string]$codeCoverageTool)
	
     # check if code coverage has been enabled
    if($isCoverageEnabled)
    {       
       if(Test-Path $summaryFile)
       {
    		Write-Verbose "Summary file = $summaryFile" -Verbose
    		Write-Verbose "Report directory = $reportDirectory" -Verbose
    		Write-Verbose "Calling Publish-CodeCoverage" -Verbose
    		Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
       }
       else
       {
    		Write-Warning "No code coverage found to publish. There might be a build failure resulting in no code coverage or there might be no tests." -Verbose
       }
    }

}


function EnableCodeCoverage
{
    param(
          [Boolean]$isCoverageEnabled,
	      [string]$mavenPOMFile,
		  [string]$codeCoverageTool,
		  [string]$classFilter,
		  [string]$classFilesDirectories,
	      [string]$srcDirectories,
		  [string]$summaryFileName,
		  [string]$reportDirectory,
		  [string]$reportPOMFile)

     
     # check if code coverage has been enabled
     if($isCoverageEnabled)
     {
		if(Test-Path $reportPOMFile)
		{
			# delete any previous reportPOMFile
			rm $reportPOMFile -force | Out-Null
		}
		
        # Enable code coverage in build file
        Enable-CodeCoverage -BuildTool 'Maven' -BuildFile $mavenPOMFile -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectories $classFilesDirectories -SourceDirectories $srcDirectories -SummaryFile $summaryFileName -ReportDirectory $reportDirectory -ReportBuildFile $reportPOMFile -ErrorAction Stop
        Write-Verbose "Code coverage is successfully enabled." -Verbose
     }
     else
     {
         Write-Verbose "Option to enable code coverage was not selected and is being skipped." -Verbose
     }
	 
}
