
#region Public


function ProcessIssues
{
    param ([ValidateNotNull()][Array]$issues,
        [ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewHttpClient]$codeReviewClient,
        [ValidateNotNull()][Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient]$gitClient,
        [ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient]$discussionClient,
        [ValidateNotNull()][Microsoft.TeamFoundation.SourceControl.WebApi.GitPullRequest]$pullRequest,
        [ValidateNotNullOrEmpty()][string]$project,
        [ValidateNotNull()][System.Guid]$repositoryId,
        [ValidateNotNullOrEmpty()][string]$sourceBranch,
        [ValidateNotNullOrEmpty()][string]$artifactUri)
                        
        
        
}

#endregion

#region Private

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


function PostIssuesToCodeReview
{       
    param ([Microsoft.VisualStudio.Services.Client.VssConnection][ValidateNotNull()]$vssConnection, [string]$newIssues, [int]$pullRequestId)     
        
    $gitClient = $vssConnection.GetClient("Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient")            
    $discussionClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient")    
    $codeReviewClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewHttpClient") # ???
        
    Assert ( $gitClient -ne $null ) "Internal error: could not retrieve the GitHttpClient object"
    Assert ( $discussionClient -ne $null ) "Internal error: could not retrieve the DiscussionHttpClient object"
    Assert ( $codeReviewClient -ne $null ) "Internal error: could not retrieve the CodeReviewHttpClient object"
             
 
    
    $repositoryId = GetTaskContextVariable "build.repository.id"    
    $teamProject = GetTaskContextVariable "system.teamProject"

    Assert (![String]::IsNullOrWhiteSpace($repositoryId)) "Internal error: could not determine the build.repository.id"
    Assert (![String]::IsNullOrWhiteSpace($teamProject)) "Internal error: could not determine the system.teamProject"   

    $pullRequest = $gitClient.GetPullRequestAsync($project, $repositoryId, $pullRequestId).Result;
    $artifactUri = GetArtifactUri $pullRequest.CodeReviewId $pullRequest.Repository.ProjectReference.Id $pullRequestId
           
    ProcessIssues $newIssues $codeReviewClient $gitClient $discussionClient $pullRequest $teamProject $repositoryId $sourceBranch $artifactUri        
}

#endregion