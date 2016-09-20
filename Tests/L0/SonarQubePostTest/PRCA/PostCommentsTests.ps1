[CmdletBinding()]
param()

#
# The tests do not have access to the TFS client assemblies because those live only on the build agent. As such instead of mocking 
# types such as DiscussionThread, these need to be completly replaced. Since the client API is binary compatible with future versions, this 
# should not cause a test hole. 
#
$source = @"

using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using System.Linq;
using System;

namespace Microsoft.VisualStudio.Services.WebApi
{
    public class PropertiesCollection : Dictionary<string, object>
    {
        
    }
    
    public class VssJsonCollectionWrapper<T>
    {
        #region test interface
        
        public IEnumerable Value { get; set; }
        
        #endregion
        
        public VssJsonCollectionWrapper(IEnumerable source)
        {
            Value = source;
        }
    }
}

namespace Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi
{

    using System;
    using System.Collections;
    using System.Collections.Generic;
    using System.Linq;
    using Microsoft.VisualStudio.Services.WebApi;
    
    public enum DiscussionStatus
    {
        Unknown = 0,
        Active = 1,
        Fixed = 2,
        WontFix = 3,
        Closed = 4,
        ByDesign = 5,
        Pending = 6
    }
    
    public class DiscussionThreadPropertyNames
    {
        public const string EndLine = "Microsoft.TeamFoundation.Discussion.Position.EndLine";
        public const string ItemPath = "Microsoft.TeamFoundation.Discussion.ItemPath";
        public const string PositionContext = "Microsoft.TeamFoundation.Discussion.Position.PositionContext";
        public const string StartColumn = "Microsoft.TeamFoundation.Discussion.Position.StartColumn";
        public const string StartLine = "Microsoft.TeamFoundation.Discussion.Position.StartLine";
    }
    
    public class DiscussionThread
    {
        public bool IsDirty { get; set; }
        public string ArtifactUri { get; set; }
        public int DiscussionId { get; set; }
        public DiscussionStatus Status { get; set; }
        public string ItemPath { get; set; }
        public DiscussionComment[] Comments { get; set; }
        
        public Microsoft.VisualStudio.Services.WebApi.PropertiesCollection Properties { get; set; }
    }
    
    public class ArtifactDiscussionThread : DiscussionThread
    {
        
    }
    
    public class DiscussionThreadCollection : List<DiscussionThread>
    {
        public DiscussionThreadCollection() {}
        public DiscussionThreadCollection(IList<DiscussionThread> collection) :base(collection) {}
    }
    
    public class DiscussionCommentCollection : List<DiscussionComment>
    {
        public DiscussionCommentCollection() {}
        public DiscussionCommentCollection(IList<DiscussionComment> collection) : base(collection) {}
    }
           
    public enum CommentType
    {
        Unknown = 0,
        Text = 1,
        CodeChange = 2,
        System = 3
    }
    
    public class DiscussionComment
    {
        public short CommentId { get; set; }
        public int DiscussionId { get; set; }
        
        public CommentType CommentType { get; set; }
        public string Content { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime PublishedDate { get; set; }
    }
    
    public class DiscussionHttpClient
    {
        // The mock implementation keeps a list of threads that were posted and uses it to get requests
        List<DiscussionThread> postedThreads = new List<DiscussionThread>();
        int lastDiscussionId = 1;
        
        // For test - to be able to easily get to the threads that were posted
        public List<DiscussionThread> GetPostedThreads()
        {
            return postedThreads;
        }
        
        // This mock implementation simply records the threads that are posted to the PR
        // It also rewrites the discussion IDs as the server would do and links the comment's discussion id to the parent thread discussion id
        public Task<DiscussionThreadCollection> CreateThreadsAsync(VssJsonCollectionWrapper<DiscussionThreadCollection> newThreads, object userState = null, CancellationToken cancellationToken = default(CancellationToken))
        {
            TaskCompletionSource<DiscussionThreadCollection> tsc = new TaskCompletionSource<DiscussionThreadCollection>();
            DiscussionThreadCollection threads = newThreads.Value as DiscussionThreadCollection;
            
            foreach (var thread in threads)
            {
                thread.DiscussionId = lastDiscussionId++;
                foreach (var comment in thread.Comments)
                {
                    comment.DiscussionId = thread.DiscussionId;
                }
                
                // Note that ItemPath only has a getter on the actual object so it's being set from elsewhere
                object itemPath;
                if ((thread.Properties as IDictionary<string, object>).TryGetValue("Microsoft.VisualStudio.Services.CodeReview.ItemPath", out itemPath))
                {
                    thread.ItemPath = (string)itemPath;
                }
                else if (thread.Properties.TryGetValue(DiscussionThreadPropertyNames.ItemPath, out itemPath))
                {
                    thread.ItemPath = (string)itemPath;
                }
                else
                {
                    throw new InvalidOperationException("Cannot create thread - no location specified");
                }
            }
            
            this.postedThreads.AddRange(threads);
            tsc.SetResult(threads);

            return tsc.Task;
        }

        public Task<Dictionary<string, List<DiscussionThread>>> GetThreadsAsync(string[] artifactUris, object userState = null, CancellationToken cancellationToken = default(CancellationToken))
        {
            Dictionary<string, List<DiscussionThread>> result = new Dictionary<string, List<DiscussionThread>>();
            var tsc = new TaskCompletionSource<Dictionary<string, List<DiscussionThread>>>();

            foreach (string artifactUri in artifactUris)
            {
                result.Add(artifactUri, postedThreads.Where(pt => pt.ArtifactUri == artifactUri).ToList());
            }

            tsc.SetResult(result);

            return tsc.Task;
        }

        public Task<DiscussionCommentCollection> GetCommentsAsync(int discussionId, object userState = null, CancellationToken cancellationToken = default(CancellationToken))
        {
            TaskCompletionSource<DiscussionCommentCollection> tsc = new TaskCompletionSource<DiscussionCommentCollection>();

            var comments = postedThreads.Where(t => t.DiscussionId == discussionId).SelectMany(t => t.Comments).ToList();
            tsc.SetResult(new DiscussionCommentCollection(comments));

            return tsc.Task;        
        }
       
          public Task<DiscussionComment> AddCommentAsync(DiscussionComment newComment, int discussionId, object userState = null, CancellationToken cancellationToken = default(CancellationToken))
            {
                TaskCompletionSource<DiscussionComment> tsc = new TaskCompletionSource<DiscussionComment>();

                DiscussionThread existingThread = this.postedThreads.Single(t => discussionId == t.DiscussionId);
                newComment.DiscussionId = existingThread.DiscussionId;

                // quick and dirty way of adding an element to an array
                var list = existingThread.Comments.ToList();
                list.Add(newComment);
                existingThread.Comments = list.ToArray();

                tsc.SetResult(newComment);
                return tsc.Task;
            }
            
            
           public Task<DiscussionThread> UpdateThreadAsync(DiscussionThread newThread, int discussionId, object userState = null, CancellationToken cancellationToken = default(CancellationToken))
            {
                // Nothing to do really because the mock implementation exposes the actual threads so they are already updated

                TaskCompletionSource<DiscussionThread> tsc = new TaskCompletionSource<DiscussionThread>();
                if (newThread.DiscussionId != discussionId)
                {
                    throw new InvalidOperationException("Use CreateThreadsAsync to create new threads");
                }

                DiscussionThread existingThread = this.postedThreads.Single(t => discussionId == t.DiscussionId);
                
                if (!existingThread.IsDirty)
                {
                    throw new InvalidOperationException("Threads should be marked as dirty before changing them");
                }
                
                if (existingThread != newThread)
                {
                    throw new InvalidOperationException("Expecting the existing thread to be the same as the existing thread");
                }
                
                existingThread.IsDirty = false;
                
                tsc.SetResult(existingThread);
                return tsc.Task;
            }
    }   
}

namespace Microsoft.TeamFoundation.SourceControl.WebApi
{
    public class GitHttpClient
    {
        public Task<GitPullRequest> GetPullRequestAsync (string project, Guid repositoryId, int pullRequestId)
        {
            return null;
        }
    }
    
    public class GitPullRequest
    {
        public int CodeReviewId { get; set; }
            
        // These are actually of type GitCommitRef, but for test purposes strings are enough
        public string LastMergeSourceCommit { get; set; }
        public string LastMergeTargetCommit { get; set; }
    }        
}

namespace Microsoft.VisualStudio.Services.CodeReview.WebApi
{
    public class IterationChanges
    {
        
    }    
}

namespace PsWorkarounds
{
    using Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi;
    using Microsoft.TeamFoundation.SourceControl.WebApi;

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

Add-Type -TypeDefinition $source -Language CSharp


# import the module before initializing the test library to avoid "import-module" being mocked
Import-Module -Name "$PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\PRCA\PostComments-Module.psm1" -Verbose
. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1

# Builds the input, similar to the ReportProcessor module output 
function BuildTestMessage 
{
    param ($message, $line, $relativePath, $priority)
    
    $properties = @{
            Content = $message
            Line = $line
            RelativePath = $relativePath
            Priority = $priority 
        }
        
    $comment = new-object PSObject -Property $properties
    return $comment
}

#
# Returns an object with the exepcted message state - the message, the number of matching comments and the state of those comments (e.g. active / resolved)
#
function GetExpectedMessageState
{
    param ($message, [int]$numberOfMatchingComments, [string]$state)
    
    $properties = @{
            Message = $message
            NumberOfMatchingComments = $numberOfMatchingComments
            State = $state
        }
        
   return  (new-object PSObject -Property $properties)
}

#
# Validates the discussion threads that are to be posted to the PR
#
function ValidateDiscussionThreadCollection
{
    param (
        [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threadCollection,
        [Array]$messageStateArray,
        [string]$commentSource, 
        [bool]$legacyPr = $true)
    
    $endLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::EndLine
    $startLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartLine
    
    ValidateCommonThreadAttributes $threadCollection $commentSource $legacyPr
    
    foreach ($messageState in $messageStateArray)
    {
        $threads = $threadCollection | Where-Object {
            ($_.Comments[0].Content -eq $messageState.Message.Content) -and 
            ($_.ItemPath -eq $messageState.Message.RelativePath) }
            
        Assert-IsNotNullOrEmpty $threads "Could not find a thread associated with the comment on line $($messageState.Message.Line) with message $($messageState.Message.Content)"
        Assert-AreEqual $messageState.NumberOfMatchingComments $threads.Count "A single thread associated with this message should have been found"
        
        $threads | ForEach-Object {Assert-AreEqual $messageState.State $_.Status "Invalid message state"}
    }
}

#
# Validates static thread properties that are not tied to the original comment  
#
function ValidateCommonThreadAttributes
{
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threadCollection, [string]$commentSource, [bool]$legacyPr)
    
    $threadCollection | ForEach-Object {Assert-AreEqual "artifact uri" $_.ArtifactUri "Each thread should have the same ArtifactUri"}    
    $threadCollection | ForEach-Object {Assert-AreEqual $false $_.IsDirty "Not expecting dirty threads"}
    $threadCollection | ForEach-Object {Assert-AreEqual $commentSource $_.Properties[$PostCommentsModule_CommentSourcePropertyName] "Invalid CodeAnalysisThreadType property."}
    $threadCollection | ForEach-Object {Assert-AreEqual "CodeAnalysisIssue" $_.Properties["CodeAnalysisThreadType"] "Invalid CodeAnalysisThreadType property."}
    
    if ($legacyPr)
    {
        $threadCollection | ForEach-Object {ValidateLegacyProperties $_}
    }
    else
    {
        $threadCollection | ForEach-Object {ValidateCodeFlowProperties $_}        
    }
    
    $fixedThreads = $threadCollection | Where-Object {$_.Status -eq "Fixed"}
    foreach ($fixedThread in $fixedThreads)
    {
        Assert-AreEqual 1 $fixedThread.Comments.Count "Fixed threads should have only the original comment"
    }
}

function ValidateLegacyProperties
{
    param ($thread)
    
    $startColumnName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartColumn
    $positionContextName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::PositionContext
    $startLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartLine
    $endLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::EndLine
    
    Assert-AreEqual 9 $thread.Properties.Count "Each thread should have 9 properties"
    Assert-AreEqual $thread.Properties[$endLineName] $thread.Properties[$startLineName] "The StartLine should be the same as the comment's line"
    Assert-AreEqual "Source Commit" $thread.Properties["CodeReviewSourceCommit"] "Invalid CodeReviewSourceCommit property"
    Assert-AreEqual "Target Commit" $thread.Properties["CodeReviewTargetCommit"] "Invalid CodeReviewTargetCommit property"
    Assert-AreEqual 1 $thread.Properties[$startColumnName] "Invalid StartColumn property."
    Assert-AreEqual "RightBuffer" $thread.Properties[$positionContextName] "Invalid PositionContext property."
}

function ValidateCodeFlowProperties
{
    param ($thread)
    
    $properties = $thread.Properties
    
    Assert-AreEqual 10 $properties.Count "Each thread should have 10 properties"
    
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.ItemPath") "No ItemPath"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.Right.StartLine") "No Start Line"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.Right.EndLine") "No End Line"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.Right.StartOffset") "No StartOffset"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.Right.EndOffset") "No EndOffset"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.FirstComparingIteration") "No FirstComparingIteration"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.SecondComparingIteration") "No SecondComparingIteration"
    Assert-AreEqual $true $properties.ContainsKey("Microsoft.VisualStudio.Services.CodeReview.ChangeTrackingId") "No ChangeTrackingId"
    
    Assert-AreEqual $properties["Microsoft.VisualStudio.Services.CodeReview.StartLine"] $properties["Microsoft.VisualStudio.Services.CodeReview.EndLine"] "Invalid line"
    Assert-AreEqual $properties["Microsoft.VisualStudio.Services.CodeReview.FirstComparingIteration"] $properties["Microsoft.VisualStudio.Services.CodeReview.SecondComparingIteration"] "Invalid iteration id"
    Assert-AreEqual 0 $properties["Microsoft.VisualStudio.Services.CodeReview.Right.StartOffset"] "Invalid StartOffset"
    Assert-AreEqual 1 $properties["Microsoft.VisualStudio.Services.CodeReview.Right.EndOffset"] "Invalid EndOffset"
}


function InitPostCommentsModule 
{
    param ([bool]$useLegacyPr)
    
    $mockGitClient = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient"
    $mockDiscussionClient = New-Object -TypeName "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient"
    $mockPullRequest = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitPullRequest"
    
    if ($useLegacyPr)
    {
        $mockPullRequest.CodeReviewId = 0
        $mockPullRequest.LastMergeSourceCommit = "Source Commit"
        $mockPullRequest.LastMergeTargetCommit = "Target Commit"
    }
    else 
    {
        $mockPullRequest.CodeReviewId = 1
    }
    
    Test-InitPostCommentsModule $mockGitClient $mockDiscussionClient $mockPullRequest "artifact uri"
    
    return $mockDiscussionClient
}

function GetResponseForGetChanges
{        
    # It's simpler to deserialize json than to create an actual object that mocks the GetChangesAsync response 
    $json = Get-Content "$PSScriptRoot\data\GetChangesResponse.json" | Out-String
    return (ConvertFrom-Json $json)
}

#
# Test - E2E test that goes through several iterations of posting messages.   
#

# Arrange
$mockDiscussionClient = InitPostCommentsModule $true
$modifiedFilesinPr = @("some/path1/file.cs", "some/path2/file.cs") # p1 and p2 are the only files modified by this PR
Register-Mock GetModifiedFilesInPR { $modifiedFilesinPr }

# Iteration 1: 
# - Current state: {no existing comments}
# - Messages to be posted: path1:A, path2:B, otherPath:C
# - Expected comments after posting: path1:A, path2:B

$p1A = BuildTestMessage "A" 14 "some/path1/file.cs" 1 
$p2B = BuildTestMessage "B" 15 "some/path2/file.cs" 5
$messageFromOtherFile = BuildTestMessage "C" 15 "some/path3/file.cs" 5  # issue in a file not changed by the PR so it should be ignored

# Act
PostAndResolveComments @($p1A, $p2B, $messageFromOtherFile) "TestSource"

# Assert
$postedThreads = $mockDiscussionClient.GetPostedThreads()
# GetExpectedMessageState params: the message itself, the number of matching comments, the state of those comments
ValidateDiscussionThreadCollection $postedThreads @((GetExpectedMessageState $p1a 1 "Active"), (GetExpectedMessageState $p2B 1 "Active")) "TestSource" 

# Iteration 2: post the same message and check that new comments are not created 
# - Current state:                      path1:A, path2:B
# - Messages to be posted:              path1:A, path1:A (different line), path2:B
# - Expected comments after posting:    path1:A, path2:B  

$p1A = BuildTestMessage "A" 14 "some/path1/file.cs" 1  
$p1ABis = BuildTestMessage "A" 18 "some/path1/file.cs" 1  # same as p1A but on a different line
$p2B = BuildTestMessage "B" 14 "some/path2/file.cs" 1  # same message as comment 1 but different file

# Act 
PostAndResolveComments @($p1A, $p1ABis, $p2B) "TestSource"

# Assert
$postedThreads = $mockDiscussionClient.GetPostedThreads()
ValidateDiscussionThreadCollection $postedThreads @( (GetExpectedMessageState $p1A 1 "Active") , (GetExpectedMessageState $p2B 1 "Active") ) "TestSource"


# Iteration 3: 
# - Current state:                      path1:A, path2:B
# - Messages to be posted:              path1:A
# - Expected comments after posting:    path1:A, path2:B (resolved) 
 
$p1A = BuildTestMessage "A" 24 "some/path1/file.cs" 1  # same message as message1 and the same line

# Act
PostAndResolveComments @($p1A) "TestSource"

# Assert
$postedThreads = $mockDiscussionClient.GetPostedThreads()
ValidateDiscussionThreadCollection $postedThreads @( (GetExpectedMessageState $p1A 1 "Active") , (GetExpectedMessageState $p2B 1 "Fixed") ) "TestSource"

# Iteration 4: 
# - Current state:                      path1:A, path2:B (resolved)
# - Messages to be posted:              path1:C:50 path1:C:60
# - Expected comments after posting:    path1:C, path1:C, path1:A (resolved), path2:B (resolved) 
 
$p1C50 = BuildTestMessage "C" 50 "some/path1/file.cs" 1
$p1C60 = BuildTestMessage "C" 60 "some/path1/file.cs" 1

# Act
PostAndResolveComments @($p1C50, $p1C60) "TestSource"

# Assert
$postedThreads = $mockDiscussionClient.GetPostedThreads()
$expectedComments = @( (GetExpectedMessageState $p1C50 2 "Active"), (GetExpectedMessageState $p1A 1 "Fixed"), (GetExpectedMessageState $p2B 1 "Fixed") )

ValidateDiscussionThreadCollection $postedThreads $expectedComments "TestSource"

# Iteration 5: 
# - Current state:                      path1:A (resolved), path2:B (resolved),  path1:C:50,  path1:C:60
# - Messages to be posted:              
# - Expected comments after posting:    path1:A (resolved), path2:B (resolved),  path1:C:50 (resolved),  path1:C:60 (resolved) 

# Act
PostAndResolveComments $null "TestSource"

# Assert
$postedThreads = $mockDiscussionClient.GetPostedThreads()
$expectedComments = @( (GetExpectedMessageState $p1C50 2 "Fixed"), (GetExpectedMessageState $p1A 1 "Fixed"), (GetExpectedMessageState $p2B 1 "Fixed") )

ValidateDiscussionThreadCollection $postedThreads $expectedComments "TestSource"

#Cleanup 
Unregister-Mock GetModifiedFilesInPR 


#
# Test 2 - Post more than the maximum allowed comments and test that the comments posted are ordered by priority
#

# Arrange 
$mockDiscussionClient = InitPostCommentsModule $true
Register-Mock GetModifiedFilesInPR { @("some/path/file.cs") }

$messages = New-Object "Collections.ArrayList"

# Add max number of allowed comments 
for($i=1; $i -le $PostCommentsModule_MaxMessagesToPost; $i++)
{
    $priority = Get-Random -Minimum 1 -Maximum 10
    $message = BuildTestMessage "CA issue $i" $i "some/path/file.cs" $priority
    [void]$messages.Add($message) 
}

$message2 = BuildTestMessage "CA issue that will be ignored 1" 20 "some/path/file.cs" 15
$message3 = BuildTestMessage "CA issue that will be ignored 2" 10 "some/path/file.cs" 16

[void]$messages.Add($message2)
[void]$messages.Add($message3)

# Shuffle the array 
$messages = [System.Collections.ArrayList]($messages | Sort-Object {Get-Random})

# Act
PostAndResolveComments $messages "SQ Test Source" "Created by the PRCA module"

# Assert
[void]$messages.Remove($message2)
[void]$messages.Remove($message3)
$postedThreads = $mockDiscussionClient.GetPostedThreads()

$expected = $messages | ForEach-Object { GetExpectedMessageState $_ 1 "Active"} 

ValidateDiscussionThreadCollection $postedThreads $expected "SQ Test Source"

# Cleanup 
Unregister-Mock GetModifiedFilesInPR 


#
# Test 3 - Post a code flow style message
#
$mockDiscussionClient = InitPostCommentsModule $false
Register-Mock GetModifiedFilesInPR { @("some/path1/file.cs", "path/not/in/changes/response") }
Register-Mock GetCodeFlowLatestIterationId 
Register-Mock GetCodeFlowChanges {(GetResponseForGetChanges)} 
Register-Mock Write-Warning

# Iteration 1: 
# - Current state: {no existing comments}
# - Messages to be posted: path1:A, path2:B, otherPath:C
# - Expected comments after posting: path1:A, path2:B

$pA = BuildTestMessage "A" 14 "some/path1/file.cs" 1
$pB = BuildTestMessage "B" 33 "path/not/in/changes/response" 1  

# Act
PostAndResolveComments @($pA, $pB) "TestSource"

# Assert
$postedThreads = $mockDiscussionClient.GetPostedThreads()

# GetExpectedMessageState params: the message itself, the number of matching comments, the state of those comments
ValidateDiscussionThreadCollection $postedThreads @((GetExpectedMessageState $pA 1 "Active")) "TestSource" $false
Assert-WasCalled Write-Warning 