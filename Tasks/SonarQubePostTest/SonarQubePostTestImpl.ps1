function InvokeMSBuildRunnerPostTest
{
	$bootstrapperPath = GetBootsrapperPath
	$arguments = GetMSBuildRunnerPostTestArgs

	Invoke-BatchScript $bootstrapperPath -Arguments $arguments
}

function GetBootsrapperPath
{
	$bootstrapperPath = GetTaskContextVariable "MSBuild.SonarQube.BootstrapperPath" 

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
function GetMSBuildRunnerPostTestArgs()
{
	  $serverUsername = GetTaskContextVariable "MSBuild.SonarQube.ServerUsername" 
	  $serverPassword = GetTaskContextVariable "MSBuild.SonarQube.ServerPassword" 
	  $dbUsername = GetTaskContextVariable "MSBuild.SonarQube.DbUsername" 
	  $dbPassword = GetTaskContextVariable "MSBuild.SonarQube.DbPassword" 

	  $sb = New-Object -TypeName "System.Text.StringBuilder"; 
      [void]$sb.Append("end");

	
      if (![String]::IsNullOrWhiteSpace($serverUsername))
      {
          [void]$sb.Append(" /d:sonar.login=" + (EscapeArg($serverUsername))) 
      }
	  
      if (![String]::IsNullOrWhiteSpace($serverPassword))
      {
          [void]$sb.Append(" /d:sonar.password=" + (EscapeArg($serverPassword))) 
      }
	  
	  if (![String]::IsNullOrWhiteSpace($dbUsername))
      {
          [void]$sb.Append(" /d:sonar.jdbc.username=" + (EscapeArg($dbUsername))) 
      }
	  
      if (![String]::IsNullOrWhiteSpace($dbPassword))
      {
          [void]$sb.Append(" /d:sonar.jdbc.password=" + (EscapeArg($dbPassword))) 
      }

	return $sb.ToString();
}

function UploadSummaryMdReport
{    
	$sonarQubeOutDir = GetSonarQubeOutDirectory

	# Upload the summary markdown file
	$summaryMdPath = [System.IO.Path]::Combine($sonarQubeOutDir, "summary.md")
	Write-Verbose "Looking for a summary report at $summaryMdPath"

	if ([System.IO.File]::Exists($summaryMdPath))
	{
		Write-Verbose "Uploading the summary.md file"
        Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report;]$summaryMdPath"
	}
	else
	{
		 Write-Warning "Could not find the summary report file $summaryMdPath"
	}
}
