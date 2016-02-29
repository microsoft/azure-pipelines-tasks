. $PSScriptRoot/ReportProcessor.ps1
. $PSScriptRoot/IssuesProcessor.ps1

function HandleCodeAnalysisReporting
{	
    Write-Verbose "HandleCodeAnalysisReporting..."
    if (IsPrBuild)
    {   
        Write-Host "Fetching code analysis issues and posting them to the PR..."        
        $newIssues = FetchAnnotatedNewIssues                
        
        if ( ($newIssues -eq $null) -or ($newIssues.Length -eq 0))
        {
            Write-Host "The SonarQube analysis did not find any new issues."
            return
        }

        LoadClientOMAssemblies 
        PostIssuesToCodeReview $newIssues   
    }	
}

#region Private 

function PostIssuesToCodeReview
{       
    param ([string]$newIssues)     
    
    $vssConnection = [Microsoft.TeamFoundation.DistributedTask.Task.Internal.Core.TaskContextHelper]::GetVssConnection($distributedTaskContext); 
    Assert ( $vssConnection -ne $null ) "Internal error: could not retrieve the VssConnection object"
        
    $gitClient = $vssConnection.GetClient("Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient")            
    $discussionClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient")    
    $codeReviewClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewHttpClient") # ???
        
    Assert ( $gitClient -ne $null ) "Internal error: could not retrieve the GitHttpClient object"
    Assert ( $discussionClient -ne $null ) "Internal error: could not retrieve the DiscussionHttpClient object"
    Assert ( $codeReviewClient -ne $null ) "Internal error: could not retrieve the CodeReviewHttpClient object"
             
    $sourceBranch =  GetTaskContextVariable "Build.SourceBranch"
    $pullRequestId = RetrievePullRequestId $sourceBranch
    Write-Verbose  "Pull Request Id $pullRequestId"
    
    $repositoryId = GetTaskContextVariable "build.repository.id"    
    $teamProject = GetTaskContextVariable "system.teamProject"

    Assert (![String]::IsNullOrWhiteSpace($repositoryId)) "Internal error: could not determine the build.repository.id"
    Assert (![String]::IsNullOrWhiteSpace($teamProject)) "Internal error: could not determine the system.teamProject"   

    $pullRequest = $gitClient.GetPullRequestAsync($project, $repositoryId, $pullRequestId).Result;
    $artifactUri = GetArtifactUri $pullRequest.CodeReviewId $pullRequest.Repository.ProjectReference.Id $pullRequestId
           
    ProcessIssues $newIssues $codeReviewClient $gitClient $discussionClient $pullRequest $teamProject $repositoryId $sourceBranch $artifactUri        
}

function LoadClientOMAssemblies
{                    
    Write-Verbose "Loading TFS client object model assemblies packaged with the build agent"
    
    $tfsClientOMDir = $env:AGENT_SERVEROMDIRECTORY
    
    $externalAssemblyNames = (             
        "Microsoft.TeamFoundation.Common.dll",
        "Microsoft.TeamFoundation.Core.WebApi.dll",
        "Microsoft.TeamFoundation.SourceControl.WebApi.dll",             
        "Microsoft.VisualStudio.Services.CodeReview.Common.dll",
        "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.dll",    
        "Microsoft.VisualStudio.Services.CodeReview.WebApi.dll",        
        "Microsoft.VisualStudio.Services.Common.dll",
        "Microsoft.VisualStudio.Services.WebApi.dll",
        "Newtonsoft.Json.dll")
       
    $externalAssemblyPaths = $externalAssemblyNames | foreach { [System.IO.Path]::Combine($tfsClientOMDir, $_)}                        
    $externalAssemblyPaths | foreach {Add-Type -Path $_}    
    
    Write-Verbose "Loaded $externalAssemblyPaths"
}

function RetrievePullRequestId 
{
    param ([ValidateNotNullOrEmpty()][string]$sourceBranch)
    
    Assert ($sourceBranch.StartsWith("refs/pull/", [StringComparison]::OrdinalIgnoreCase)) "Internal Error: source branch $sourceBranch is not in a recognized format"  
    
    $parts = $sourceBranch.Split('/');
    Assert ($parts.Count -gt 2) "Internal Error: source branch $sourceBranch is not in a recognized format"
    
    $prId = ""
    $idIsValid = [int]::TryParse($parts[2], [ref]$prId);
    
    Assert ($idIsValid -eq $true) "Internal Error: source branch $sourceBranch is not in a recognized format"
    Assert ($prId -gt 0) "Internal Error: source branch $sourceBranch is not in a recognized format"
    
    return $prId    
}
 
function GetArtifactUri
{
    param ([int]$codeReviewId, [Guid]$teamProjectId, [int]$pullRequestId)
    
    if ($codeReviewId -eq 0)
    {        
        $artifactUri = [String]::Format("vstfs:///CodeReview/CodeReviewId/{0}%2f{1}", $teamProjectId, $pullRequestId);        
        Write-Verbose "Legacy code review. The artifact uri is $artifactUri"
        return $artifactUri
    }

    $artifactUri = [Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewSdkArtifactId]::GetArtifactUri($teamProjectId, $pullRequestId)
    Write-Verbose "New style code review. The artifact uri is $artifactUri"
    return $artifactUri
}

#endregion
