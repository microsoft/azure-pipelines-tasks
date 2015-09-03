function InvokeMsBuildRunnerPostTest
{
	$bootstrapperPath = GetBootsrapperPath
	$arguments = GetMsBuildRunnerPostTestArgs

	Invoke-BatchScript $bootstrapperPath -Arguments $arguments
}

function GetBootsrapperPath
{
	$bootstrapperPath = GetTaskContextVariable "MsBuild.SonarQube.BootstrapperPath" 

	if (!$bootstrapperPath -or ![System.IO.File]::Exists($bootstrapperPath))
	{
		throw "The MSBuild.SonarQube.Runner executable could not be found. Check that the build definition includes a SonarQube Pre-Build step"
	}

	Write-Verbose "bootstrapperPath: $bootstrapperPath"
	return $bootstrapperPath;
}

#
# Remarks: Normally all the settings are stored in a file on the build agent, but some well-known sensitive settings need to 
# be passed again as they cannot be stored in non-encrypted files
#
function GetMsBuildRunnerPostTestArgs()
{
	  $serverUsername = GetTaskContextVariable "MsBuild.SonarQube.ServerUsername" 
	  $serverPassword = GetTaskContextVariable "MsBuild.SonarQube.ServerPassword" 
	  $dbUsername = GetTaskContextVariable "MsBuild.SonarQube.DbUsername" 
	  $dbPassword = GetTaskContextVariable "MsBuild.SonarQube.DbPassword" 

	  $sb = New-Object -TypeName "System.Text.StringBuilder"; 
      [void]$sb.Append("end");

	
      if (![String]::IsNullOrWhiteSpace($serverUsername))
      {
          [void]$sb.Append(" /d:sonar.login=""$serverUsername""")
      }
	  
      if (![String]::IsNullOrWhiteSpace($serverPassword))
      {
          [void]$sb.Append(" /d:sonar.password=""$serverPassword""")
      }
	  
	   if (![String]::IsNullOrWhiteSpace($dbUsername))
      {
          [void]$sb.Append(" /d:sonar.jdbc.username=""$dbUsername""")
      }
	  
      if (![String]::IsNullOrWhiteSpace($dbPassword))
      {
          [void]$sb.Append(" /d:sonar.jdbc.password=""$dbPassword""")
      }

	return $sb.ToString();
}

function UploadSummaryMdReport
{
	$agentBuildDirectory = GetTaskContextVariable "Agent.BuildDirectory" 
	if (!$agentBuildDirectory)
	{
		throw "Could not retrieve the Agent.BuildDirectory variable";
	}

	# Upload the summary markdown file
	$summaryMdPath = [System.IO.Path]::Combine($agentBuildDirectory, ".sonarqube", "out", "summary.md")
	Write-Verbose "summaryMdPath = $summaryMdPath"

	if ([System.IO.File]::Exists($summaryMdPath))
	{
		Write-Verbose "Uploading the summary.md file"
		Write-Host "##vso[build.uploadsummary]$summaryMdPath"
	}
	else
	{
		 Write-Warning "Could not find the summary report file $summaryMdPath"
	}
}

function HandleCodeAnalysisReporting
{
	$agentBuildDirectory = GetTaskContextVariable "Agent.BuildDirectory" 
	if (!$agentBuildDirectory)
	{
		throw "Could not retrieve the Agent.BuildDirectory variable.";
	}

	$sonarQubeAnalysisModeIsIncremental = GetTaskContextVariable "MsBuild.SonarQube.AnalysisModeIsIncremental"
	if ($sonarQubeAnalysisModeIsIncremental -ieq "true")
	{
		GenerateCodeAnalysisReport $agentBuildDirectory
	}
}


################# Helpers ######################


function GetTaskContextVariable()
{
	param([string][ValidateNotNullOrEmpty()]$varName)
	return Get-TaskVariable -Context $distributedTaskContext -Name $varName -Global $FALSE
}