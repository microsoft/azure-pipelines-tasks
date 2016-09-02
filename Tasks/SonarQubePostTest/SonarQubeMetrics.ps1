$script:qualityGateStatus = ""
$script:analysisId = ""

#region Public 

#
# Gets the cached quality gate status or queries the server to get the result of the quality gate if it is not cached
#
# Remark: this only works for SQ version 5.3+
#
function GetOrFetchQualityGateStatus
{    
    if ([String]::IsNullOrEmpty($script:qualityGateStatus))
    {
        $script:qualityGateStatus = FetchQualityGateStatus  
        SetTaskContextVariable "MSBuild.SonarQube.QualityGateStatus" $script:qualityGateStatus
    }
    
    Assert (![String]::IsNullOrEmpty($script:qualityGateStatus)) "Could not fetch the quality gate status"
    
    return $script:qualityGateStatus
}

#
# Waits for the SQ analysis to finish, i.e. to evaluate all the metrics including the quality gate. Calling this function more than once results in a NOP
#
# Remarks: this operation is only relevant for SQ 5.3+ and will fail if attempted with on an earlier server  
#
function WaitForAnalysisToFinish
{
    if ([String]::IsNullOrEmpty($script:analysisId))
    {
        $script:analysisId = WaitForAnalysisToFinishInternal
        SetTaskContextVariable "MSBuild.SonarQube.AnalysisId" $script:analysisId
    }    
    
    Assert (![String]::IsNullOrEmpty($script:analysisId)) "Could not fetch the analysis id"
}


function FetchQualityGateDetails
{
    param ([Array]$errors,[Array]$warnings)
    
    Assert (![String]::IsNullOrEmpty($script:analysisId)) "WaitForAnalysisToFinish should be called first."
       
    $response = InvokeGetRestMethod "/api/qualitygates/project_status?analysisId=$script:analysisId"
    return $response
}

#
# For all the metrics in the system, this method returns the key and the friendly name, as well as the type and the id   
#
function FetchMetricNames
{
    $response = InvokeGetRestMethod "/api/metrics/search?ps=500&f=name"
    Assert (HasElements $response) "No metrics were found"
    
    return $response.metrics
}

#endregion

#region Private

function FetchQualityGateStatus
{
    $response = FetchQualityGateDetails  
    return $response.projectStatus.status
}

#
# Polls the server until current analysis is complete or a timeout is hit. Returns the analysis id. Throws if the analysis times out.
#
function WaitForAnalysisToFinishInternal
{    
    Write-Host "Waiting on the SonarQube server to finish processing in order to determine the quality gate status."
       
    $reportPath = GetTaskStatusFile    
    $taskId = FetchTaskIdFromReportFile $reportPath
        
    $command = { IsAnalysisFinished $taskId }
    $timeout = GetAnalysisCompleteTimeout
    $taskFinished = RetryUntilTrue $command -timeout $timeout -retryDelay 1

    if (!$taskFinished)
    {
        throw "The analysis did not complete in the allotted time of $timeout seconds. Consider setting the build variable SonarQubeAnalysisTimeoutInSeconds to a higher value."

    }

    $analysisId = QueryAnalysisId $taskId

    Write-Host "The SonarQube analysis has finished processing."
    Write-Verbose "The analysis id is $analysisId"

    return $analysisId
}


#
# Reads the task id from task-report.txt that is dropped by the sonar-scanner to give the task id
#
function FetchTaskIdFromReportFile
{
    param ([string]$reportTaskFile)

    $content = [System.IO.File]::ReadAllText($reportTaskFile);

    # regex breakdown ^ceTaskId=(.+)$ 
    #
    #    ^ - assert beggining of line
    #    ceTaskId= - matches this token exactly
    #    () - capturing group 
    #    .+ - matches any char, one or multiple times
    #    $ - assert end of line
    #
    $matchResult = [System.Text.RegularExpressions.Regex]::Match($content, "^ceTaskId=(.+)$", [System.Text.RegularExpressions.RegexOptions]::Multiline);

    if (!$matchResult.Success -or !$matchResult.Groups -or $matchResult.Groups.Count -ne 2)
    {
        throw "Could not find the task Id in $reportTaskFile."
    }

    $taskId = $matchResult.Groups[1].Value.Trim()
    Write-Verbose "The analysis is associated with the task id $taskId"

    return $taskId
}

#
# Queries the server to determine if the task has finished, i.e. if the quality gate has been evaluated
#
function IsAnalysisFinished
{
    param ([string]$taskId)
    
    # response is in json and ps deserialize it automatically
    $response = InvokeGetRestMethod "/api/ce/task?id=$taskId" 
    $status = $response.task.status
    
    Write-Verbose "The task status is $status"

    if (!$status)
    {
        throw "Could not determine the task status - please raise a bug."
    }
    
    return $status -eq "success"   
}

#
# Query the server to determine the analysis id associated with the current analysis
#
function QueryAnalysisId
{
    param ([string]$taskId)
       
    $response = InvokeGetRestMethod "/api/ce/task?id=$taskId"
    return $response.task.analysisId      
}

#
# Returns the path to the report-task.txt file containing task details
#
function GetTaskStatusFile
{    
    $sonarDir = GetSonarScannerDirectory 
    $reportTaskFile = [System.IO.Path]::Combine($sonarDir, "report-task.txt");
    
    if (![System.IO.File]::Exists($reportTaskFile))
    {
        Write-Verbose "Could not find the task details file at $reportTaskFile"
        throw "Cannot determine if the analysis has finished. Possible cause: your SonarQube server version is lower than 5.3 - for more details see https://go.microsoft.com/fwlink/?LinkId=722407"
    }

    return $reportTaskFile
}

function GetAnalysisCompleteTimeout
{
    $defaultTimeout = 300; 

    if ($env:SonarQubeAnalysisTimeoutInSeconds)
    {
        $timeout = $env:SonarQubeAnalysisTimeoutInSeconds
        Write-Host "SonarQubeAnalysisTimeoutInSeconds is set to $timeout and will be used to poll for the SonarQube task completion."
        
    }
    else
    {
        $timeout = $defaultTimeout
    }

    return $timeout;
}

#endregion