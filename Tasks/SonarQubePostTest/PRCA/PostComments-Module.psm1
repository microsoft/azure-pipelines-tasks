# Terminology: 
#
# Message - input data structure that should have: 
#    content - the actual string message
#    relativePath - path to the file where the message should be posted; the path should be relative to the repo root
#    line - where the message should be posted in the file
#    priority - used to filter out message if there are too many of them so as to not overwhelm the user
#         
# Comment or DiscussionComment - TFS data structure that describes the comment. Has properties such as content or state (e.g. Active, Resolved) 
# Thread or DiscussionThread - TFS data structure that encapsulates a collection of comments. Threads have properties such as Path
# Comment Source - a custom property used to identify comments that were posted using the same logic.   
#
# Note: this module will create a separate thread and comment for each message 
#
# Module logic:  
#
# PRs have iterations, i.e. if the user pushes another commit to branch then the PR is re-evaluated (e.g. new PR build occurs) and new comments might be added
# This modules does not re-post a message if it already exists. 
# If a message no longer exists, this module will mark the message as resolved.   
#
# Note that in order to tie a message to a comment the line number cannot be used because comments move around as code is inserted / deleted. Only the
# message content and the file path can be used, which is likely to create conflicts if the same message is posted multiple times in the same file.    
# This might be improved in the future by storing the line content with the message.

#region Public Constants

# Limit the number of issues to be posted to this number
$PostCommentsModule_MaxMessagesToPost = 100

# Annotate threads with this property 
$PostCommentsModule_CommentSourcePropertyName = "CommentSource"

#endregion

#region private constants

$script:discussionWebApiNS = "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi"
 
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

#
# Posts new messages, ignoring duplicate comments and resolves comments that were open in an old iteration of the PR.
# Comment source is used to decorate comments created by this logic. Only comments with the same source will be resolved.
#
function PostAndResolveComments
{
    param ([Array][ValidateNotNull()]$messages, [string][ValidateNotNullOrEmpty()]$commentSource)
    
    ValidateMessages $messages
    
    Write-Host "Processing $($messages.Count) new messages"
    
    #TODO: ResolveExistingIssues
    
    if ($messages.Count -gt 0)
    {
        InternalPostNewMessages $messages $commentSource
    }
}

#endregion

#region Private


#
# Posts the discussion threads loaded with comments to the PR
# Remark: public for test purposes
function PostDiscussionThreads
{
    param ([ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threads)
    
    $vssJsonThreadCollection = New-Object -TypeName "Microsoft.VisualStudio.Services.WebApi.VssJsonCollectionWrapper[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]" -ArgumentList @(,$threads)
    [void]$script:discussionClient.CreateThreadsAsync($vssJsonThreadCollection, $null, [System.Threading.CancellationToken]::None).Result
    
    Write-Host "Posted $($threads.Count) discussion threads"
}

#
# Returns a list of files that have been changed in this PR 
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
# Retrieve existing discussion threads. 
#
# Remark: public for testing purposes
function FetchDiscussionThreads
{
    $a =  $script:discussionClient.GetPostedThreads()
    $threadsDictionary = $script:discussionClient.GetThreadsAsync( @($script:artifactUri)).Result
    
    $threadList = New-Object "System.Collections.Generic.List[$script:discussionWebApiNS.DiscussionThread]"
    
    foreach ($threads in $threadsDictionary.Values)
    {
        if ($threads -ne $null)
        {
            Write-Verbose "Threads in current pair $($threads.Count)"
            $threadList.AddRange($threads);
        }
    }
    
    Write-Verbose "Found $($threadList.Count) discussion thread(s)"
    return $threadList;
}

#
# Fetch existing discussion comments
#
# Remark: public for testing purposes
function FetchDiscussionComments
{
    param ([System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$discussionThreads)
    
    $comments = New-Object "System.Collections.Generic.List[$script:discussionWebApiNS.DiscussionComment]"
    
    foreach ($discussionThread in $discussionThreads)
    {
        $commentsFromThread = $script:discussionClient.GetCommentsAsync($discussionThread.DiscussionId).Result
        if ($commentsFromThread -ne $null)
        {
            $comments.AddRange($commentsFromThread)
        }
    }
    
    Write-Host "Found $($comments.Count) existing comment(s)" 
    return $comments
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

function ValidateMessages
{
    param ([ValidateNotNull()][Array]$messages)
    
    foreach ($message in $messages)
    {
        Assert (![String]::IsNullOrEmpty($message.RelativePath)) "A message doesn't have a RelativePath property"
        Assert (![String]::IsNullOrEmpty($message.Priority)) "A message doesn't have a Priority property"
        Assert (![String]::IsNullOrEmpty($message.Content)) "A message doesn't have content "
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


function InternalPostNewMessages
{
    param ([ValidateNotNull()][Array]$messages, [string][ValidateNotNullOrEmpty()]$commentSource)
    
    Write-Verbose "Fetching existing threads and comments..."
    $existingThreads = FetchDiscussionThreads 
    $existingComments = FetchDiscussionComments $existingThreads    
    
    $messages = FilterComments $messages $commentSource $existingThreads $existingComments
    
    $messages | ForEach {Write-Verbose $_} 
    
    # TODO: check that the comments aren't already present before posting
    
    $newDiscussionThreads = CreateDiscussionThreads $messages $commentSource
    PostDiscussionThreads $newDiscussionThreads 
}

# region Filter Comments
function FilterComments 
{
    param ([Array]$messages, 
    [ValidateNotNullOrEmpty()][string]$commentSource, 
    [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads,
    [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments)
    
    Write-Verbose "Filtering comments before posting"
    
    $messages = FilterCommentsByPath $messages
    $messages = FilterPreExistingComments $messages $commentSource $existingThreads $existingComments
    $messages = FilterMessagesByNumber $messages
    
    return $messages
}

function FilterCommentsByPath
{
    param ([Array]$messages)
    
    $modifiedFilesInPr = GetModifiedFilesInPR
    Write-Verbose "Files changed in this PR: $modifiedFilesInPr"
    
    $countBefore = $messages.Count
    $messages = $messages | Where-Object {$modifiedFilesInPr.Contains($_.RelativePath)}
    $commentsFiltered = $countBefore - $messages.Count 
    
    Write-Host "$commentsFiltered message(s) were filtered because they do not belong to files that were changed in this PR"
    
    return $messages
}

#
# A message is said to be pre-existing if:
# 1. a comment with the same content exists 
# 2. and it belongs to the same file 
# 3. and the thread was created by the same logic, i.e. the same commentSource 
#
# Remark: comments move arround so Line cannot be used. 
#
function FilterPreExistingComments
{
     param ([Array]$messages, 
     [ValidateNotNullOrEmpty()][string]$commentSource, 
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads,
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments)
     
     $sw = new-object "Diagnostics.Stopwatch"
     $sw.Start();
     
     $countBefore = $messages.Count
     $messages = $messages | Where-Object { !(MessageHasMatchingComments $_)}
     $commentsFiltered = $countBefore - $messages.Count 
     
     Write-Host "$commentsFiltered message(s) were filtered because they were already present"
     Write-Verbose "Filtering out $($existingComments.Count) existing comments took $($sw.ElapsedMilliseconds) ms"
     
     return $messages
}

function MessageHasMatchingComments
{
    param ([ValidateNotNull()][PSObject]$message)
    
    $matchingComments = GetMatchingComments $_ $commentSource $existingThreads $existingComments
    
    return ($matchingComments.Count -gt 0)
}

#TODO: can be optimized by using a map of <Thread,List<Comments>> instead of 2 flat lists
function GetMatchingComments
{
     param ([ValidateNotNull()][PSObject]$message, 
     [ValidateNotNullOrEmpty()][string]$commentSource, 
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads,
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments)
     
     $resultList = @()
     
     # select threads that are not "fixed", that point to the same file and have been marked with the given comment source
     $matchingThreads = $existingThreads | Where-Object {
            ($_ -ne $null) -and
            (ThreadMatchesCommentSource $_ $commentSource) -and
            (ThreadMatchesItemPath $_ $message.RelativePath) -and 
            ($_.Status -ne [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionStatus]::Fixed)}
            
     Write-Verbose "Found $($matchingThreads.Count) matching thread(s) for the message at $($message.RelativePath) line $($message.Line)"
        
     foreach ($matchingThread in $matchingThreads)
     {
         # select comments from this thread that are not deleted and that match the given message 
         $matchingComments = $existingComments | Where-Object { 
            ($_ -ne $null) -and
            ($_.DiscussionId -eq $matchingThread.DiscussionId) -and 
            (!$_.IsDeleted) -and 
            ($_.Content -eq $message.Content)}
                
        if ($matchingComments -ne $null)
        {
            Write-Host "Found $($matchingComments.Count) matching comment(s) for the message at $($message.RelativePath) line $($message.Line)"
            
            foreach ($matchingComment in $matchingComments)
            {
                $resultList += $matchingComment
            }
        }
     }
        
     return $resultList
}

# Returns true if a discussion thread was decorated with the given comment source
function ThreadMatchesCommentSource
{
    param ([ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]$thread, 
           [ValidateNotNullOrEmpty()][string]$commentSource)
    
    return (($thread.Properties -ne $null) -and
             ($thread.Properties.ContainsKey($PostCommentsModule_CommentSourcePropertyName)) -and
             ($thread.Properties[$PostCommentsModule_CommentSourcePropertyName] -eq $commentSource))
}

function ThreadMatchesItemPath
{
    param ([ValidateNotNull()][Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]$thread, 
           [ValidateNotNullOrEmpty()][string]$itemPath)
    
    $itemPathName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::ItemPath
    
    return (($thread.Properties -ne $null) -and
             ($thread.Properties.ContainsKey($itemPathName)) -and
             ($thread.Properties[$itemPathName] -eq $itemPath))
}

# Limit the number of messages so as to not overload the PR with too many comments
function FilterMessagesByNumber
{
    param ([ValidateNotNull()][Array]$messages)
    
    $countBefore = $messages.Count
    $messages = $messages | Sort-Object Priority | Select-Object -first $PostCommentsModule_MaxMessagesToPost
    $commentsFiltered = $countBefore - $messages.Count
    
    Write-Host "$commentsFiltered message(s) were filtered to match the maximum $PostCommentsModule_MaxMessagesToPost comments limit"
    
    return $messages
}

#endregion

function CreateDiscussionThreads
{
    param ([ValidateNotNull()][Array]$messages, [string][ValidateNotNullOrEmpty()]$commentSource)
    
    Write-Verbose "Creating new discussion threads"
    $discussionThreadCollection = New-Object "$script:discussionWebApiNS.DiscussionThreadCollection"
    $discussionId = -1
    
    #TODO: add support for new style PR 
    if ($script:pullRequest.CodeReviewId -gt 0)
    {
        throw "This PR engine is not supported yet"
    }
    
    foreach ($message in $messages)
    {
        Write-Host "Creating a discussion comment for the comment at line $($message.Line) from $($message.RelativePath)"
        
        $newThread = New-Object "$script:discussionWebApiNS.ArtifactDiscussionThread"
        $newThread.DiscussionId = $discussionId
        $newThread.ArtifactUri = $script:artifactUri        
        $newThread.Status = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionStatus]::Active;
        
        $discussionComment = New-Object "$script:discussionWebApiNS.DiscussionComment"
        $discussionComment.CommentId = $newThread.DiscussionId
        $discussionComment.CommentType = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.CommentType]::System
        $discussionComment.IsDeleted = $false;
        $discussionComment.Content = $message.Content
     
        $properties = New-Object -TypeName "Microsoft.VisualStudio.Services.WebApi.PropertiesCollection"
        AddLegacyProperties $message $properties 
        
        # add a custom property to be able to distinguish all comments created this way        
        $properties.Add($PostCommentsModule_CommentSourcePropertyName, $commentSource)
        
        $newThread.Properties = $properties
        
        $newThread.Comments = @($discussionComment)
        $discussionThreadCollection.Add($newThread)
        $discussionId--
    }
    
    return $discussionThreadCollection
}

function AddLegacyProperties
{
    param ([object]$message, [Microsoft.VisualStudio.Services.WebApi.PropertiesCollection]$properties)
 
    $properties.Add($CodeReviewSourceCommit, $script:pullRequest.LastMergeSourceCommit.ToString())
    $properties.Add($CodeReviewTargetCommit, $script:pullRequest.LastMergeTargetCommit.ToString())
    
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::ItemPath), 
        $message.RelativePath)
        
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartLine), 
        $message.Line)
        
    $properties.Add(
        ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::EndLine), 
        $message.Line)
        
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
Export-ModuleMember -Variable PostCommentsModule_CommentSourcePropertyName, PostCommentsModule_MaxMessagesToPost 
Export-ModuleMember -Function InitPostCommentsModule, Test-InitPostCommentsModule, PostAndResolveComments, PostDiscussionThreads, FetchDiscussionThreads, FetchDiscussionComments, GetModifiedFilesInPR 