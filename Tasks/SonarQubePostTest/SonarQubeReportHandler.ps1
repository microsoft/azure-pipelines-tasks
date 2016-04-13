
#region Public 

function UploadSummaryMdReport
{    
    if ((IsPrBuild) -or ((IsReportEnabled) -eq $false) -or ((CompareSonarQubeVersionWith52) -le 0))
    {
        UploadLegacySummaryMdReport
    }
    else
    {
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

function UploadSummaryReportInternal
{
    Assert ((IsReportEnabled) -eq $true) "The summary report is disabled"
    Assert ((IsPrBuild) -eq $false) "Cannot produce a report because the analysis was done in issues mode"
        
    $qualityGateStatus = GetOrFetchQualityGateStatus
        
    #TODO: actually upload a report
    Write-Host "The quality gate status is $qualityGateStatus"
}

function IsReportEnabled
{
    $includeReport = GetTaskContextVariable "MSBuild.SonarQube.IncludeReport"
    $reportEnabled = [System.Convert]::ToBoolean($includeReport)
    
    return $reportEnabled
}

#endregion
