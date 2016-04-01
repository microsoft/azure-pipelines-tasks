
function GetAnalysisId
{
    $breakBuild = GetTaskContextVariable "MSBuild.SonarQube.BreakBuild"
    $breakBuildEnabled = Convert-String $breakBuild Boolean

    $provideAnalysisId = GetTaskContextVariable "MSBuild.SonarQube.ProvideAnalysisId"
    $provideAnalysisIdEnabled = Convert-String $provideAnalysisId Boolean

    Write-Verbose "breakBuild $breakBuild"
    Write-Verbose "breakBuildEnabled $breakBuildEnabled"
    Write-Verbose "provideAnalysisId $provideAnalysisId"
    Write-Verbose "provideAnalysisIdEnabled $provideAnalysisIdEnabled"

    if($breakBuildEnabled -or $provideAnalysisIdEnabled)
    {
        Write-Verbose "Waiting for Analysis to complete"
        $analysisId = WaitForAnalysisToFinish
        if($provideAnalysisIdEnabled){
            SetTaskContextVariable "MSBuild.SonarQube.AnalysisId" $analysisId
        }
        return $analysisId
    } else {
        return -1
    }
}
