#
# Top-level orchestrating logic
# 
function BreakBuildOnQualityGateFailure
{    
    $breakBuild = GetTaskContextVariable "MSBuild.SonarQube.Internal.BreakBuild"
    $breakBuildEnabled = [System.Convert]::ToBoolean($breakBuild)

    if ($breakBuildEnabled)
    {
        if (IsPRBuild)
        {
            Write-Host (Get-VstsLocString -Key 'Info_Breaker_Pr')
            return;
        }
        
        WaitForAnalysisToFinish
        $qualityGateStatus = GetOrFetchQualityGateStatus
        FailBuildOnQualityGateStatus $qualityGateStatus
    }
    else
    {
        Write-Host (Get-VstsLocString -Key 'Info_Breaker_Disabled')
    }
}

#
# Fails the build when the quality gate is set to Error. Possible quality gate results: OK, WARN, ERROR, NONE
#
function FailBuildOnQualityGateStatus
{
    param ([string]$qualityGateStatus)

    if ($qualityGateStatus -eq "error")
    {        
        $dashboardUrl = GetTaskContextVariable "MSBuild.SonarQube.ProjectUri"
        Write-VstsTaskError "The SonarQube quality gate associated with this build has failed. For more details see $dashboardUrl"
        Write-VstsSetResult -Result Failed
    }
    else
    {
        Write-Host (Get-VstsLocString -Key 'Info_Breaker_Passed' -ArgumentList $qualityGateStatus)
    }
}
