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

. $PSScriptRoot/PostComments-Server.ps1

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

$script:messageSource = $null
$script:messageToCommentListMap = $null
$script:resolvedComment = $null
#endregion

#region Public

#InitPostCommentsModule and Test-InitPostCommentsModule are defined in PostComments-Server.ps1

#
# Posts new messages, ignoring duplicate comments and resolves comments that were open in an old iteration of the PR.
# Comment source is used to decorate comments created by this logic. Only comments with the same source will be resolved.
# The "resolvedCommentString" is added to a comment that gets resolved.
function PostAndResolveComments
{
    param ([Array][ValidateNotNull()]$messages, [string][ValidateNotNullOrEmpty()]$messageSource, [string][ValidateNotNullOrEmpty()]$resolvedCommentString)
    
    $script:messageSource = $messageSource
    $script:resolvedComment = $resolvedCommentString
    
    ValidateMessages $messages    
    Write-Host "Processing $($messages.Count) new messages"        
    InternalPostAndResolveComments $messages
}

#endregion

#region Private

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

function InternalPostAndResolveComments
{
    param ([ValidateNotNull()][Array]$messages, [string][ValidateNotNullOrEmpty()]$messageSource)
    
    Write-Verbose "Fetching existing threads and comments..."
    
    # TODO: are these needed here or can the build dictionary fetch them? 
    $existingThreads = FetchDiscussionThreads 
    $existingComments = FetchDiscussionComments $existingThreads    

    BuildMessageToCommentDictonary $messages $existingThreads $existingComments
    
    # Comments that were created by this logic but do not have corresponding messages can be marked as 'Resolved'
    ResolveExistingComments $messages $existingThreads $existingComments
    
    # Remove messages that cannot be posted
    $messages = FilterMessages $messages 
        
    # Debug: print remaining messages 
    #$messages | ForEach {Write-Verbose $_} 
    
    $newDiscussionThreads = CreateDiscussionThreads $messages
    PostDiscussionThreads $newDiscussionThreads 
}

#region Resolve Comments

function ResolveExistingComments
{
    param ([Array]$messages,     
    [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads, 
    [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments) 
    
    if ( ($existingComments -eq $null) -or ($existingComments.Count -eq 0) )
    {
        Write-Verbose "There are no existing messages. Not attempting to resolve any."
        return    
    }
    
    # Comments that do not match any input messages are said to be resolved
    $resolvedComments = GetResolvedComments $existingComments
    Write-Verbose "Found $($resolvedComments.Count) existing comments that do not match any new message and can be resolved"
    
    foreach ($resolvedComment in $resolvedComments)
    {
        $thread = GetExistingCommentThread
        
        # the resolving comment is a new comment that markes the thread as resolved when pushed to the server
        $resolvingComment = MarkThreadAsResolved $thread
        
        $script:discussionClient.AddCommentAsync($resolvingComment, $resolvingComment.DiscussionId, $null, [System.Threading.CancellationToken]::None).Wait();
        $script:discussionClient.UpdateThreadAsync($thread, $thread.DiscussionId, $null, [System.Threading.CancellationToken]::None).Wait();
    }
}

function MarkThreadAsResolved
{
    param([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]$thread)
     
    $thread.IsDirty = $true
    $resolvedComment = New-Object "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment"
                        
    $resolvedComment.DiscussionId = $thread.DiscussionId
    $resolvedComment.CommentId = -1
    $resolvedComment.CommentType = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.CommentType]::System
    $resolvedComment.PublishedDate = [System.DateTime]::Now
    $resolvedComment.IsDeleted = $false    
    $resolvedComment.Content = $script:resolvedComment
    
    return $resolvedComment
}

function GetExistingCommentThread
{
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]$comment, 
    [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads)
    
    $thread = $existingThreads | Where-Object {$_DiscussionId -eq $comment.DiscussionId}
    
    Assert (($thread -ne $null) -and ($thread.Count -eq 1)) "Expecting to find a (single) thread for this comment "
    return $thread
}

function GetResolvedComments
{
    param ([System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments)
    
    # start with all the existing comments
    $existingCommentSet = New-Object "System.Collections.Generic.HashSet[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]"
    $existingComments | ForEach-Object {[void]$existingCommentSet.Add($_)}
    Assert ($existingComments.Count -eq $existingCommentSet.Count) "Expecting existing messages to be different objects"

    # take all the comments that were matched by messages since we have a dictionary that holds them  
    # note that 2 messages can point to the same comment so a set struture is needed to eliminate duplicates     
    $matchedCommentSet = New-Object "System.Collections.Generic.HashSet[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]"
    
    foreach ($matchedCommentList in $script:messageToCommentListMap.Values)
    {
        foreach ($matchedComment in $matchedCommentList)
        {          
            [void]$matchedCommentSet.Add($matchedComment)  
        }                     
    }
    
    # the comments that need to be resolved are existing comments minus the matched comments
    # note that we're comparing objects, not message contents ...    
    $existingCommentSet.ExceptWith($matchedCommentSet)
    return $existingCommentSet
}

#endregion

# region Filter Comments

function FilterMessages 
{
    param ([Array]$messages) 
    
    Write-Verbose "Filtering messages before posting"
    
    $messages = FilterMessagesByPath $messages
    $messages = FilterPreExistingComments $messages
    $messages = FilterMessagesByNumber $messages
    
    return $messages
}

function FilterMessagesByPath
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
     param ([Array]$messages) 
     
     $sw = new-object "Diagnostics.Stopwatch"
     $sw.Start();
     
     $countBefore = $messages.Count
     $messages = $messages | Where-Object { !(MessageHasMatchingComments $_)}
     $commentsFiltered = $countBefore - $messages.Count 
     
     Write-Host "$commentsFiltered message(s) were filtered because they were already present"
     Write-Verbose "Filtering out $($existingComments.Count) existing comments took $($sw.ElapsedMilliseconds) ms"
     
     return $messages
}

# Limit the number of messages so as to not overload the PR with too many comments
function FilterMessagesByNumber
{
    param ([Array]$messages)
    
    $countBefore = $messages.Count
    $messages = $messages | Sort-Object Priority | Select-Object -first $PostCommentsModule_MaxMessagesToPost
    $commentsFiltered = $countBefore - $messages.Count
    
    Write-Host "$commentsFiltered message(s) were filtered to match the maximum $PostCommentsModule_MaxMessagesToPost comments limit"
    
    return $messages
}

#endregion

#region Message <-> Comment 

function MessageHasMatchingComments
{
    param ([ValidateNotNull()][PSObject]$message)
    
    Assert ($script:messageToCommentListMap -ne $null ) "The map can be empty but not null"
        
    if ($script:messageToCommentListMap.ContainsKey($message))
    {
        $matchingComments = $script:messageToCommentListMap[$message]
        return ($matchingComments.Count -gt 0)
    }
    
    return $false
}

function BuildMessageToCommentDictonary
{
    param ([ValidateNotNull()][Array]$messages,      
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads,
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments)
     
     # reset any previous map
     $script:messageToCommentListMap = @{}
     
     $sw = new-object "Diagnostics.Stopwatch"
     $sw.Start();
     
     foreach ($message in $messages)
     {
         $matchingComments = GetMatchingComments $message $existingThreads $existingComments
         
         if (($matchingComments -ne $null ) -and ($matchingComments.Count -gt 0))
         {
             [void]$script:messageToCommentListMap.Add($message, $matchingComments)
         }
     }
     
     # TODO: Write-Verbose
     Write-Host "Built a message to comment dictionary in $($sw.ElapsedMilliseconds) ms"
}

#TODO: can be optimized by using a map of <Thread,List<Comments>> instead of 2 flat lists
function GetMatchingComments
{
     param ([ValidateNotNull()][PSObject]$message,      
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThread]]$existingThreads,
     [System.Collections.Generic.List[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionComment]]$existingComments)         
     
     $resultList = @()
     
     # select threads that are not "fixed", that point to the same file and have been marked with the given comment source
     $matchingThreads = $existingThreads | Where-Object {
            ($_ -ne $null) -and
            (ThreadMatchesCommentSource $_ $script:messageSource) -and
            (ThreadMatchesItemPath $_ $message.RelativePath) -and 
            ($_.Status -ne [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionStatus]::Fixed)}

     #TODO: verbose            
     Write-Host "Found $($matchingThreads.Count) matching thread(s) for the message at $($message.RelativePath) line $($message.Line)"
        
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
            #todo: verbose
            Write-Host "Found $($matchingComments.Count) matching comment(s) for the message $($message.Content) at $($message.RelativePath) line $($message.Line)"
            
            foreach ($matchingComment in $matchingComments)
            {
                $resultList += $matchingComment
            }
        }
     }
        
     return $resultList
}



#endregion

function CreateDiscussionThreads
{
    param ([ValidateNotNull()][Array]$messages)
    
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
        $properties.Add($PostCommentsModule_CommentSourcePropertyName, $script:messageSource)
        
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
Export-ModuleMember -Function InitPostCommentsModule, Test-InitPostCommentsModule, GetModifiedFilesInPR, PostAndResolveComments