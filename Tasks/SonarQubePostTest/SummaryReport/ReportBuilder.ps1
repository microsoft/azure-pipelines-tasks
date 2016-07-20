. $PSScriptRoot/DashboardUriSection.ps1
. $PSScriptRoot/QualityGateSection.ps1

#region Public 

function CreateAndUploadReport
{    
    if ((IsPRBuild) -or ((IsReportEnabled) -eq $false) -or ((CompareSonarQubeVersionWith52) -le 0))
    {
        
        Write-host (Get-VstsLocString -Key "Info_Legacy_Report")
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
	Write-VstsTaskVerbose "Looking for a summary report at $legacySummaryReportPath"

	if ([System.IO.File]::Exists($legacySummaryReportPath))
	{
         FireUploadReportCommand $legacySummaryReportPath
	}
	else
	{
		 Write-VstsTaskWarning (Get-VstsLocString -Key "Warn_Report_Missing" -ArgumentList $legacySummaryReportPath)
	}
}

function CreateAndUploadReportInternal
{
    Assert ((IsReportEnabled) -eq $true) "The summary report is disabled"
    Assert ((IsPRBuild) -eq $false) "Cannot produce a report because the analysis was done in issues mode"
 
    Write-Host (Get-VstsLocString -Key "Info_Report_Create")  
    $reportPath = CreateReport
    Write-Host (Get-VstsLocString -Key "Info_Report_Upload")  
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
    Write-VstsTaskVerbose "Produced a summary report at $reportPath"
    
    return $reportPath
}

function FireUploadReportCommand
{
    param($reportPath)
    
    Write-VstsAddAttachment -Type "Distributedtask.Core.Summary" -Name "SonarQube Analysis Report" -Path $reportPath
}


#endregion
