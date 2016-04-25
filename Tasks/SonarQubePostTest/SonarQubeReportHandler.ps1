
#region Public 

function UploadSummaryMdReport
{    
    if ((IsPrBuild) -or ((IsReportEnabled) -eq $false) -or ((CompareSonarQubeVersionWith52) -le 0))
    {
        Write-host "Uploading the legacy summary report. The new report is not uploaded if not enabled, if the SonarQube server version is 5.2 or lower or if the build was triggered by a pull request"
        UploadLegacySummaryMdReport
    }
    else
    {        
        WaitForAnalysisToFinish
        UploadSummaryReportInternal
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
         UploadReport $legacySummaryReportPath
	}
	else
	{
		 Write-Warning "Could not find the summary report file $legacySummaryReportPath"
	}
}

function UploadSummaryReportInternal
{
    Assert ((IsReportEnabled) -eq $true) "The summary report is disabled"
    Assert ((IsPrBuild) -eq $false) "Cannot produce a report because the analysis was done in issues mode"

    Write-Host "Creating a summary report"        
    $reportPath = CreateReport
    Write-Host "Uploading the report"
    UploadReport $reportPath
}

function IsReportEnabled
{
    $includeReport = GetTaskContextVariable "MSBuild.SonarQube.Internal.IncludeFullReport"
    $reportEnabled = [System.Convert]::ToBoolean($includeReport)
    
    return $reportEnabled
}

function UploadReport
{
    param($reportPath)
    
    Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report;]$reportPath"
}

function CreateReport
{
    $dashboardUri = GetTaskContextVariable "MSBuild.SonarQube.ProjectUri"
    
    Assert (![String]::IsNullOrEmpty($dashboardUri)) "Could not find the dashboard uri"
    
    $qualityGateStatus = GetOrFetchQualityGateStatus
    $qualityGateColor = "" 
    $qualityGateLabel = ""
    GetQualityGateVisualDetails $qualityGateStatus ([ref]$qualityGateColor) ([ref]$qualityGateLabel)
    
    $reportTemplate  = '<div style="padding:5px 0px">
<span>Quality Gate</span>
<span style="padding:4px 10px; margin-left: 5px; background-color:{0}; color:#fff; display:inline-block">{1}</span>
</div>
<div>
<a target="_blank" href="{2}">Detailed report &gt;</a>
</div>'
    
    $reportContents = [String]::Format($reportTemplate, $qualityGateColor, $qualityGateLabel, $dashboardUri)    
    $sonarQubeOutDir = GetSonarQubeOutDirectory
    $reportPath = [IO.Path]::Combine($sonarQubeOutDir, "newSummaryReport.md");
    
    [IO.File]::WriteAllText($reportPath, $reportContents)
    Write-Verbose "Produced a summary report at $reportPath"
    
    return $reportPath
}

function GetQualityGateVisualDetails
{
    param([string]$qualityGateStatus, [ref][string]$color, [ref][string]$label)
    
    
    switch ($qualityGateStatus) {
        {$_ -eq "ok"} 
        { 
            $color.Value = "#85BB43"
            $label.Value = "Passed" 
            break;           
        }
        {$_ -eq "warn"} 
        {
            $color.Value = "#f90"
            $label.Value = "Warning" 
            break;            
        }
        {$_ -eq "error"} 
        {
            $color.Value = "#d4333f"
            $label.Value = "Failed"
            break;  
        }
        {$_ -eq "none"} 
        {
            $color.Value = "#bbb" 
            $label.Value = "None"
            break;  
        }
        Default 
        {
            Write-Warning "Could not detect the quality gate status or a new status has been introduced."
            $color.Value = "#bbb" 
            $label.Value = "Unknown"
            break;  
        }
    }
    
}

#endregion
