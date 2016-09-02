. $PSScriptRoot/DashboardUriSection.ps1
. $PSScriptRoot/QualityGateSection.ps1

#region Public 

function CreateAndUploadReport
{    
    if ((IsPrBuild) -or ((IsReportEnabled) -eq $false) -or ((CompareSonarQubeVersionWith52) -le 0))
    {
        Write-host "Uploading the legacy summary report. The new report is not uploaded if not enabled, if the SonarQube server version is 5.2 or lower or if the build was triggered by a pull request"
        UploadLegacySummaryMdReport
    }
    else
    {        
        WaitForAnalysisToFinish
        CreateAndUploadReportInternal
    }    
}

#endregion

#region Private

#
# The MSBuild Scanner produces a simple md report that details the status of each project 
#
function UploadLegacySummaryMdReport
{
	$sonarQubeOutDir = GetSonarQubeOutDirectory

	# Upload the summary markdown file
	$legacySummaryReportPath = [System.IO.Path]::Combine($sonarQubeOutDir, "summary.md")
	Write-Verbose "Looking for a summary report at $legacySummaryReportPath"

	if ([System.IO.File]::Exists($legacySummaryReportPath))
	{
         FireUploadReportCommand $legacySummaryReportPath
	}
	else
	{
		 Write-Warning "Could not find the summary report file $legacySummaryReportPath"
	}
}

function CreateAndUploadReportInternal
{
    Assert ((IsReportEnabled) -eq $true) "The summary report is disabled"
    Assert ((IsPrBuild) -eq $false) "Cannot produce a report because the analysis was done in issues mode"

    Write-Host "Creating a summary report"        
    $reportPath = CreateReport
    Write-Host "Uploading the report"
    FireUploadReportCommand $reportPath
}

function IsReportEnabled
{
    $includeReport = GetTaskContextVariable "MSBuild.SonarQube.Internal.IncludeFullReport"
    $reportEnabled = [System.Convert]::ToBoolean($includeReport)
    
    return $reportEnabled
}

function CreateReport
{
    $content = BuildReportContent
    $reportPath = CreateReportFile $content
    
    return $reportPath
}

function BuildReportContent
{
    $qualityGateSection = GetQualityGateSectionContent
    $dashboardUriSection = GetDashboardUriSectionContent
    
    return "$qualityGateSection $dashboardUriSection"
}

function CreateReportFile
{
    param ($reportContents)
    
    $sonarQubeOutDir = GetSonarQubeOutDirectory
    $reportPath = [IO.Path]::Combine($sonarQubeOutDir, "newSummaryReport.md");
    
    [IO.File]::WriteAllText($reportPath, $reportContents)
    Write-Verbose "Produced a summary report at $reportPath"
    
    return $reportPath
}

function FireUploadReportCommand
{
    param($reportPath)
    
    Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report;]$reportPath"
}


#endregion
