
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