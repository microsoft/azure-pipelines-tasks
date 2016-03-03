#region constants

$script:discussionWebApiNS = "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi"

# Limit the number of issues to be posted to this number 
$PostCommentsModule_MaxIssuesToPost = 100

$CodeReviewSourceCommit = "CodeReviewSourceCommit"
$CodeReviewTargetCommit = "CodeReviewTargetCommit"

#endregion

#region Private Members

$script:gitClient = $null
$script:discussionClient = $null
$script:codeReviewClient = $null
$script:project = $null
$script:pullRequest = $null
$script:artifactUri = $null 

#endregion

#region Public

#
# Initializes the module for posting to the current PR. Usses both vssConnection and env variables to initialize internal actors
# This function should be called again for a different PR.
#
function InitPostCommentsModule
{
    param ([Microsoft.VisualStudio.Services.Client.VssConnection][ValidateNotNull()]$vssConnection)
    
    Write-Verbose "Initializing the PostComments-Module"
    
    $tfsClientAssemblyDir = GetTaskContextVariable "agent.serveromdirectory"
    LoadTfsClientAssemblies $tfsClientAssemblyDir
    InternalInit            
}

#
# Initializes the module. 
#
# Remark: for test purposes only
#
function Test-InitPostCommentsModule
{
    param ([Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient]$gitClient, 
    [Microsoft.TeamFoundation.SourceControl.WebApi.GitPullRequest]$pullRequest, 
    [string]$artifactUri)
    
    $script:gitClient = $gitClient
    $script:pullRequest = $pullRequest
    $script:artifactUri = $artifacturi
}

#
# Posts new comments, ignoring duplicate comments and resolves comments that were open in an old iteration of the PR
#
function PostAndResolveComments
{
    param ([Array][ValidateNotNull()]$comments)
    
    ValidateComments $comments
    
    Write-Host "Processing $($comments.Count) new comments"
    
    #TODO: ResolveExistingIssues
    
    if ($comments.Count -gt 0)
    {
        InternalPostNewComments $comments
    }
}

#
# Posts the discussion threads loaded with comments to the PR
# Remark: public for test purposes
function PostDiscussionThreads
{
    param ([ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threads)
    
    $vssJsonThreadCollection = New-Object -TypeName "Microsoft.VisualStudio.Services.WebApi.VssJsonCollectionWrapper[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]" -ArgumentList @(,$threads)
    $script:discussionClient.CreateThreadsAsync($vssJsonThreadCollection, $null, [System.Threading.CancellationToken]::None).Result
    
    Write-Host "Posted $($threads.Count) discussion threads"
}


#endregion

#region Private


function LoadTfsClientAssemblies
{
    param ([ValidateNotNullOrEmpty()][string]$tfsClientAssemblyDir)   
                     
    Write-Verbose "Loading TFS client object model assemblies packaged with the build agent"      
    
    $externalAssemblyNames = (             
        "Microsoft.TeamFoundation.Common.dll",
        "Microsoft.TeamFoundation.Core.WebApi.dll",
        "Microsoft.TeamFoundation.SourceControl.WebApi.dll",             
        "Microsoft.VisualStudio.Services.CodeReview.Common.dll",
        "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.dll",    
        "Microsoft.VisualStudio.Services.CodeReview.WebApi.dll",        
        "Microsoft.VisualStudio.Services.Common.dll",
        "Microsoft.VisualStudio.Services.WebApi.dll")
       
    $externalAssemblyPaths = $externalAssemblyNames | foreach { [System.IO.Path]::Combine($tfsClientAssemblyDir, $_)}                        
    $externalAssemblyPaths | foreach {Add-Type -Path $_} 
    
    Write-Verbose "Loaded $externalAssemblyPaths"
}

function InternalInit
{
    $script:gitClient = $vssConnection.GetClient("Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient")            
    $script:discussionClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient")    
    $script:codeReviewClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewHttpClient") 
        
    Assert ( $script:gitClient -ne $null ) "Internal error: could not retrieve the GitHttpClient object"
    Assert ( $script:discussionClient -ne $null ) "Internal error: could not retrieve the DiscussionHttpClient object"
    Assert ( $script:codeReviewClient -ne $null ) "Internal error: could not retrieve the CodeReviewHttpClient object"
                 
    $repositoryId = GetTaskContextVariable "build.repository.id"    
    $script:project = GetTaskContextVariable "system.teamProject"

    Assert (![String]::IsNullOrWhiteSpace($repositoryId)) "Internal error: could not determine the build.repository.id"
    Assert (![String]::IsNullOrWhiteSpace($script:project)) "Internal error: could not determine the system.teamProject"   

    $pullRequestId = GetPullRequestId
    $script:pullRequest = $script:gitClient.GetPullRequestAsync($script:project, $repositoryId, $pullRequestId).Result;    
    $script:artifactUri = GetArtifactUri $script:pullRequest.CodeReviewId $script:pullRequest.Repository.ProjectReference.Id $pullRequestId
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

function ValidateComments
{
    param ([ValidateNotNull()][Array]$comments)
    
    foreach ($comment in $comments)
    {
        Assert (![String]::IsNullOrEmpty($comment.RelativePath)) "A comment doesn't have a RelativePath property"
        Assert (![String]::IsNullOrEmpty($comment.Priority)) "A comment doesn't have a Priority property"
        Assert (![String]::IsNullOrEmpty($comment.Content)) "A comment doesn't have content "
    }
}

function GetPullRequestId 
{
    $sourceBranch =  GetTaskContextVariable "Build.SourceBranch"
    Assert ($sourceBranch.StartsWith("refs/pull/", [StringComparison]::OrdinalIgnoreCase)) "Internal Error: source branch $sourceBranch is not in a recognized format"  
    
    $parts = $sourceBranch.Split('/');
    Assert ($parts.Count -gt 2) "Internal Error: source branch $sourceBranch is not in a recognized format"
    
    $prId = ""
    $idIsValid = [int]::TryParse($parts[2], [ref]$prId);
    
    Assert ($idIsValid -eq $true) "Internal Error: source branch $sourceBranch is not in a recognized format"
    Assert ($prId -gt 0) "Internal Error: source branch $sourceBranch is not in a recognized format"
    
    return $prId    
}


function InternalPostNewComments
{
    param ([ValidateNotNull()][Array]$comments)
    
    # Limit the number of messages so as to not overload the PR with too many comments
    $comments = $comments | Sort-Object Priority | Select-Object -first $PostCommentsModule_MaxIssuesToPost
    Write-Host "Sorting comments and filtering before postng"
    
    $comments | ForEach {Write-Verbose $_} 
    
    # TODO: check that the comments aren't already present before posting
    
    $newDiscussionThreads = CreateDiscussionThreads $comments
    PostDiscussionThreads $newDiscussionThreads 
}

function CreateDiscussionThreads
{
    param ([ValidateNotNull()][Array]$comments)
    
    Write-Verbose "Creating new discussion threads"
    $discussionThreadCollection = New-Object "$script:discussionWebApiNS.DiscussionThreadCollection"
    $discussionId = -1
    
    #TODO: add support for new style PR 
    if ($script:pullRequest.CodeReviewId > 0)
    {
        throw "This PR engine is not supported yet"
    }
    
    foreach ($comment in $comments)
    {
        Write-Host "Creating a discussion comment for the comment at line $($comment.Line) from $($comment.RelativePath)"
        
        $newThread = New-Object "$script:discussionWebApiNS.ArtifactDiscussionThread"
        $newThread.DiscussionId = $discussionId
        $newThread.ArtifactUri = $script:artifactUri        
        $newThread.Status = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionStatus]::Active;
        
        $discussionComment = New-Object "$script:discussionWebApiNS.DiscussionComment"
        $discussionComment.CommentId = $newThread.DiscussionId
        $discussionComment.CommentType = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.CommentType]::System
        $discussionComment.IsDeleted = $false;
        $discussionComment.Content = $comment.Content
     
        $properties = New-Object -TypeName "Microsoft.VisualStudio.Services.WebApi.PropertiesCollection"
        AddLegacyProperties $comment $properties 
        
        # TODO: these could be inputs to the module
        $properties.Add("CodeAnalysisThreadType", "CodeAnalysisIssue")
        
        $newThread.Properties = $properties
        
        $newThread.Comments = @($discussionComment)
        $discussionThreadCollection.Add($newThread)
        $discussionId--
    }
    
    return $discussionThreadCollection
}

function AddLegacyProperties
{
    param ([object]$comment, [Microsoft.VisualStudio.Services.WebApi.PropertiesCollection]$properties)
 
    $properties.Add($CodeReviewSourceCommit, $script:pullRequest.LastMergeSourceCommit.ToString())
    $properties.Add($CodeReviewTargetCommit, $script:pullRequest.LastMergeTargetCommit.ToString())
    
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::ItemPath), 
        $comment.RelativePath)
        
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartLine), 
        $comment.Line)
        
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::EndLine), 
        $comment.Line)
        
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartColumn), 
        1)
        
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::PositionContext), 
        "RightBuffer")
}



#region Common Helpers 

function GetTaskContextVariable
{
	param([string][ValidateNotNullOrEmpty()]$varName)
	return Get-TaskVariable -Context $distributedTaskContext -Name $varName
}

#
# C# like assert based on a condition
# 
function Assert
{
    param ([bool]$condition, [string]$message)

    if (!$condition)
    {
        throw $message
    }
}

#endregion


#endregion

# Export the public functions 
Export-ModuleMember -Function 'InitPostCommentsModule', 'Test-InitPostCommentsModule', 'PostAndResolveComments', 'PostDiscussionThreads' -Variable 'PostCommentsModule_MaxIssuesToPost'