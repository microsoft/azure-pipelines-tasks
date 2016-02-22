
function HandleCodeAnalysisReporting
{	
    Write-Verbose "HandleCodeAnalysisReporting"
    if (IsPrBuild)
    {   
        Write-Host "Fetching code analysis issues and posting them to the PR..."  
         
        Import-Module -Name "$PSScriptRoot/ReportProcessor-Module.psm1"
        Import-Module -Name "$PSScriptRoot/PostComments-Module.psm1"
             
        $newIssues = FetchAnnotatedNewIssues                
        
        if ( ($newIssues -eq $null) -or ($newIssues.Length -eq 0))
        {
            Write-Host "The SonarQube analysis did not find any new issues."
            return
        }
        
        $vssConnection = GetVssConnection 
        InitPostCommentsModule $vssConnection
        $comments = GetCommentsFromIssues $newIssues
        PostCommentsToPR $comments
    }	
}


#region Private 

function GetVssConnection
{
    $vssConnection = [Microsoft.TeamFoundation.DistributedTask.Task.Internal.Core.TaskContextHelper]::GetVssConnection($distributedTaskContext); 
    Assert ( $vssConnection -ne $null ) "Internal error: could not retrieve the VssConnection object"

    return $vssConnection
}

#endregion
