# This file contains functions that are part of the PostComments-Module 
# and that interact only with the TFS Client objects  

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
# Remark: for test only
#
function Test-InitPostCommentsModule
{
    param ([Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient]$gitClient,
    [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient]$discussionClient, 
    [Microsoft.TeamFoundation.SourceControl.WebApi.GitPullRequest]$pullRequest, 
    [string]$artifactUri)
    
    $script:gitClient = $gitClient
    $script:discussionClient = $discussionClient
    $script:pullRequest = $pullRequest
    $script:artifactUri = $artifacturi
}

function InternalInit
{
    Write-Verbose "Fetching VSS clients"
    $script:gitClient = $vssConnection.GetClient("Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient")            
    $script:discussionClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient")    
    $script:codeReviewClient = $vssConnection.GetClient("Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewHttpClient") 
        
    Assert ( $script:gitClient -ne $null ) "Internal error: could not retrieve the GitHttpClient object"
    Assert ( $script:discussionClient -ne $null ) "Internal error: could not retrieve the DiscussionHttpClient object"
    Assert ( $script:codeReviewClient -ne $null ) "Internal error: could not retrieve the CodeReviewHttpClient object"
                 
    Write-Verbose "Fetching data from build variables"
    $repositoryId = GetTaskContextVariable "build.repository.id"    
    $script:project = GetTaskContextVariable "system.teamProject"

    Assert (![String]::IsNullOrWhiteSpace($repositoryId)) "Internal error: could not determine the build.repository.id"
    Assert (![String]::IsNullOrWhiteSpace($script:project)) "Internal error: could not determine the system.teamProject"   

    $pullRequestId = GetPullRequestId
    $repositoryIdGuid = [Guid]::Parse($repositoryId);
    Write-Verbose "Fetching the pull request object with id $pullRequestId"

    $script:pullRequest = [PsWorkarounds.Helper]::GetPullRequestObject($script:gitClient, $script:project, $repositoryIdGuid, $pullRequestId);
     
    Assert ($script:pullRequest -ne $null) "Internal error: could not retrieve the pull request object" 
    Assert ($script:pullRequest.CodeReviewId -ne $null) "Internal error: could not retrieve the code review id" 
    Assert ($script:pullRequest.Repository -ne $null) "Internal error: could not retrieve the repository object" 
    Assert ($script:pullRequest.Repository.ProjectReference -ne $null) "Internal error: could not retrieve the project reference object" 
    Assert ($script:pullRequest.Repository.ProjectReference.Id -ne $null) "Internal error: could not retrieve the project reference ID " 
     
    $script:artifactUri = GetArtifactUri $script:pullRequest.CodeReviewId $script:pullRequest.Repository.ProjectReference.Id $pullRequestId
}

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
    
    # Workaround: PowerShell 4 seems to have a problem finding the right method from a list of overloaded .net methods. This is because
    # PS converts variables to its own PSObject type and it then gets confused when trying to coerce the values to determine the right method candidate.
    # To work around this I create a .net helper method that calls the actual helper. The code bellow is built into an temp assembly
    # and it can be accessed directly from this script.
    $source = @"

using Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi;
using Microsoft.TeamFoundation.SourceControl.WebApi;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace PsWorkarounds
{
    public class Helper
    {
        public static GitPullRequest GetPullRequestObject(GitHttpClient gitClient, string project, Guid repositoryId, int pullRequestId)
        {
            return gitClient.GetPullRequestAsync(project, repositoryId, pullRequestId).Result;
        }
        
        public static Dictionary<string, List<DiscussionThread>> GetThreadsDictionary(DiscussionHttpClient discussionClient, string artifactUri)
        {
            return discussionClient.GetThreadsAsync(new string[] { artifactUri }).Result;
        }
        
        public static DiscussionCommentCollection GetComments(DiscussionHttpClient discussionClient, int discussionId)
        {
            return discussionClient.GetCommentsAsync(discussionId).Result;
        }
    }
}
"@
    
    (Add-Type -TypeDefinition $source -ReferencedAssemblies $externalAssemblyPaths) | out-null
}


#
# Returns a list of files that have been changed in this PR
# 
# Remark: public for test purposes
function GetModifiedFilesInPR 
{
    Write-Verbose "Computing the list of files changed in this PR"
    $sourceFiles = @()

    $targetVersionDescriptor = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitTargetVersionDescriptor"
    $targetVersionDescriptor.VersionType = [Microsoft.TeamFoundation.SourceControl.WebApi.GitVersionType]::Commit
    $targetVersionDescriptor.Version = $script:pullRequest.LastMergeSourceCommit.CommitId
    
    $baseVersionDescriptor = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitBaseVersionDescriptor"
    $baseVersionDescriptor.VersionType = [Microsoft.TeamFoundation.SourceControl.WebApi.GitVersionType]::Commit
    $baseVersionDescriptor.Version = $script:pullRequest.LastMergeTargetCommit.CommitId
    
    $commitDiffs = $script:gitClient.GetCommitDiffsAsync(
        $script:project, # string project 
        $script:pullRequest.Repository.Name, # string repositoryId 
        $true, # bool? diffCommonCommit
        $null, # int? top 
        $null, # int? skip
        $baseVersionDescriptor, 
        $targetVersionDescriptor, 
        $null, # object userState
        [System.Threading.CancellationToken]::None # CancellationToken cancellationToken
        ).Result
    
    if ($commitDiffs.ChangeCounts.Count -gt 0)
    {
        Write-Verbose "Found $($commitDiffs.ChangeCounts.Count) changed file(s) in the PR"
        
        $sourceFiles = $commitDiffs.Changes | 
            Where-Object { ($_ -ne $null) -and ($_.Item.IsFolder -eq $false) }  | 
            ForEach-Object { $_.Item.Path.Replace("\", "/") }
    }

    return $sourceFiles
}

#
# Posts the discussion threads loaded with comments to the PR
#
function PostDiscussionThreads
{
    param ([ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threads)
    
    $vssJsonThreadCollection = New-Object -TypeName "Microsoft.VisualStudio.Services.WebApi.VssJsonCollectionWrapper[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]" -ArgumentList @(,$threads)
    [void]$script:discussionClient.CreateThreadsAsync($vssJsonThreadCollection, $null, [System.Threading.CancellationToken]::None).Result
    
    Write-Host "Posted $($threads.Count) discussion threads"
}

#
# Retrieve existing discussion threads that were created by this module and that are active (i.e. not fixed)
#
function FetchActiveDiscussionThreads
{
    $threadsDictionary = [PsWorkarounds.Helper]::GetThreadsDictionary($script:discussionClient, $script:artifactUri)
    $threadList = New-Object "System.Collections.Generic.List[$script:discussionWebApiNS.DiscussionThread]"
    
    foreach ($threads in $threadsDictionary.Values)
    {
        foreach ($thread in $threads)
        {
            if ((ThreadMatchesCommentSource $thread) -and ($thread.Status -eq [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionStatus]::Active))
            {            
                [void]$threadList.Add($thread);
            }
        }
    }
    
    Write-Verbose "Found $($threadList.Count) discussion thread(s)"
    return $threadList;
}

#
# Fetch the discussion comments from the given threads
#
function FetchDiscussionComments
{
    param ([System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$discussionThreads)
    
    $comments = New-Object "System.Collections.Generic.List[$script:discussionWebApiNS.DiscussionComment]"
    
    foreach ($discussionThread in $discussionThreads)
    {
        $commentsFromThread = [PsWorkarounds.Helper]::GetComments($script:discussionClient, $discussionThread.DiscussionId)
        
        if ($commentsFromThread -ne $null)
        {
            $comments.AddRange($commentsFromThread)
        }
    }
    
    Write-Verbose "Found $($comments.Count) existing comment(s)" 
    return $comments
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

    $artifactUri = [Microsoft.VisualStudio.Services.CodeReview.WebApi.CodeReviewSdkArtifactId]::GetArtifactUri($teamProjectId, $codeReviewId)
    Write-Verbose "New style code review. The artifact uri is $artifactUri"
    
    return $artifactUri
}

# Returns the PR id from the source branch name 
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

# Returns true if a discussion thread was decorated with the given comment source
function ThreadMatchesCommentSource
{
    param ([ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]$thread)
    
    return (($thread.Properties -ne $null) -and
             ($thread.Properties.ContainsKey($PostCommentsModule_CommentSourcePropertyName)) -and
             ($thread.Properties[$PostCommentsModule_CommentSourcePropertyName] -eq $script:messageSource))
}

#region Code Flow

function GetCodeFlowLatestIterationId
{
    $review = $script:codeReviewClient.GetReviewAsync(
        $script:pullRequest.Repository.ProjectReference.Id,  # Guid project
        $script:pullRequest.CodeReviewId, # int reviewId
        $null, # bool? includeAllProperties
        $null, # int? maxChangesCount
        $null, # DateTimeOffset? ifModifiedSince
        $null, # object userState
        [System.Threading.CancellationToken]::None).Result
    
    Assert ($review -ne $null) "Could not retrieve the review"
    Assert (HasElements $review.Iterations) "No iterations found on the review"
    
    $lastIterationId = ($review.Iterations.Id | Measure -Maximum).Maximum

    return $lastIterationId
}

function GetCodeFlowChanges
{
     param ([int]$iterationId)
     
     $changes = $script:codeReviewClient.GetChangesAsync(
        $script:pullRequest.Repository.ProjectReference.Id, 
        $script:pullRequest.CodeReviewId, 
        $iterationId,
        $null, $null, $null, [System.Threading.CancellationToken]::None).Result
     
     Write-Verbose "Change count: $($changes.Count)"
     
     return $changes
}

function GetCodeFlowChangeTrackingId
{
    param ([Microsoft.VisualStudio.Services.CodeReview.WebApi.IterationChanges]$changes, [string]$path)
    
    $change = $changes.ChangeEntries | Where-Object {$_.Modified.Path -eq $path}
    
    Assert ($change -ne $null) "No changes found for $path"
    Assert ($change.Count -eq 1) "Expecting exactly 1 change for $path but found $($change.Count)"
    
    return $change.ChangeTrackingId
} 

#endregion 


     

