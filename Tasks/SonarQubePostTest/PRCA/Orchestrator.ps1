
. $PSScriptRoot/ReportProcessor.ps1

function HandleCodeAnalysisReporting
{	
    Write-Verbose "HandleCodeAnalysisReporting..."
    if (IsPrBuild)
    {   
        Write-Host "Fetching code analysis issues and posting them to the PR..." 
        $newIssues = FetchAnnotatedNewIssues                
        
        if ($newIssues.Length -eq 0)
        {            
            Write-Host "The SonarQube analysis did not find any new issues."
            return            
        }
    }	
}
