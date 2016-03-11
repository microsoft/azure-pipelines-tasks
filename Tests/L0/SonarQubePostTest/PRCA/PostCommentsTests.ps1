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
        public string ArtifactUri { get; set; }
        public int DiscussionId { get; set; }
        public DiscussionStatus Status { get; set; }
        
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
        public CommentType CommentType { get; set; }
        public string Content { get; set; }
        public bool IsDeleted { get; set; }
        
        public int DiscussionId { get; set; }
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
    }   
}

namespace Microsoft.TeamFoundation.SourceControl.WebApi
{
    public class GitHttpClient
    {
        
    }
    
    public class GitPullRequest
    {
        public int CodeReviewId { get; set; }
            
        // These are actually of type GitCommitRef, but for test purposes strings are enough
        public string LastMergeSourceCommit { get; set; }
        public string LastMergeTargetCommit { get; set; }
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
# Validates the discussion threads that are to be posted to the PR
#
function ValidateDiscussionThreadCollection
{
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threadCollection, [Array]$messages, [string]$commentSource)
    
    $endLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::EndLine
    $startLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartLine
    $itemPathName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::ItemPath
    
    ValidateCommonThreadAttributes $threadCollection $commentSource
    Assert-AreEqual $messages.Count $threadCollection.Count "Inconsistent number of threads. There should be 1 thread for each comment."    
    
    foreach ($message in $messages)
    {
        $thread = $threadCollection | Where-Object {
            ($_.Comments[0].Content -eq $message.Content) -and 
            ($_.Properties[$itemPathName] -eq $message.RelativePath) }
            
        Assert-IsNotNullOrEmpty $thread "Could not find a thread associated with the comment on line $($message.Line) with message $($message.Content)"
        Assert-AreEqual 1 $thread.Count "A single thread associated with this message should have been found"
        
        Assert-AreEqual $thread.Properties[$endLineName] $thread.Properties[$startLineName] "The StartLine should be the same as the comment's line"
    }
}

#
# Validates static thread properties that are not tied to the original comment  
#
function ValidateCommonThreadAttributes
{
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threadCollection, [string]$commentSource)
    
    $startColumnName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartColumn
    $positionContextName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::PositionContext
    
    $threadCollection | ForEach-Object {Assert-AreEqual "artifact uri" $_.ArtifactUri "Each thread should have the same ArtifactUri"}
    $threadCollection | ForEach-Object {Assert-AreEqual "Active" $_.Status "Each thread should be active"}
    $threadCollection | ForEach-Object {Assert-AreEqual 1 $_.Comments.Count "Each thread should have a single comment"}
    $threadCollection | ForEach-Object {Assert-AreEqual $false $_.Comments.IsDeleted "Each thread should be marked as not deleted"}
    
    $threadCollection | ForEach-Object {Assert-AreEqual 8 $_.Properties.Count "Each thread should have 8 properties"}
    
    $threadCollection | ForEach-Object {Assert-AreEqual "Source Commit" $_.Properties["CodeReviewSourceCommit"] "Invalid CodeReviewSourceCommit property"}
    $threadCollection | ForEach-Object {Assert-AreEqual "Target Commit" $_.Properties["CodeReviewTargetCommit"] "Invalid CodeReviewTargetCommit property"}
    $threadCollection | ForEach-Object { Assert-AreEqual 1 $_.Properties[$startColumnName] "Invalid StartColumn property."}
    $threadCollection | ForEach-Object { Assert-AreEqual "RightBuffer" $_.Properties[$positionContextName] "Invalid PositionContext property."}
    
    $threadCollection | ForEach-Object { Assert-AreEqual $commentSource $_.Properties[$PostCommentsModule_CommentSourcePropertyName] "Invalid CodeAnalysisThreadType property."}
}


function InitPostCommentsModule 
{
    $mockGitClient = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient"
    $mockDiscussionClient = New-Object -TypeName "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionHttpClient"
    $mockPullRequest = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitPullRequest"
    
    # Legacy PR
    $mockPullRequest.CodeReviewId = 0
    $mockPullRequest.LastMergeSourceCommit = "Source Commit"
    $mockPullRequest.LastMergeTargetCommit = "Target Commit"

    Test-InitPostCommentsModule $mockGitClient $mockDiscussionClient $mockPullRequest "artifact uri"
    
    return $mockDiscussionClient
}

#
# Test - E2E test that goes through several iterations of posting messages. Note  
#

# Arrange
$mockDiscussionClient = InitPostCommentsModule
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
ValidateDiscussionThreadCollection $postedThreads @($p1A, $p2B) "TestSource"

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
ValidateDiscussionThreadCollection $postedThreads @($p1A, $p2B) "TestSource"


# # Iteration 3: 
# # - Current state:                      path1:A, path2:B
# # - Messages to be posted:              path1:A, path1:A (different line), path2:A
# # - Expected comments after posting:    path1:A, path2:B (resolved), path2:A 
# 
# $message2A = BuildTestMessage "A" 14 "some/path1/file.cs" 1  # same message as message1 and the same line
# $message2AdifferentLine = BuildTestMessage "CA issue 1" 18 "some/path1/file.cs" 1  # same message as comment 1 and different line
# $message2B = BuildTestMessage "CA issue 1" 14 "some/path2/file.cs" 1  # same message as comment 1 but different file
# 
# # Act 
# PostAndResolveComments @($message2A, $message2AdifferentLine, $message2B) "TestSource"
# 
# # Assert
# $postedThreads = $mockDiscussionClient.GetPostedThreads()
# ValidateDiscussionThreadCollection $postedThreads @($message1A, $message1B, $comment6) "TestSource"

#Cleanup 
Unregister-Mock GetModifiedFilesInPR 


#
# Test 2 - Post more than the maximum allowed comments and test that the comments posted are ordered by priority
#

# Arrange 
$mockDiscussionClient = InitPostCommentsModule
Register-Mock GetModifiedFilesInPR { @("some/path/file.cs") }

$messages = New-Object "Collections.ArrayList"

# Add max number of allowed comments 
for($i=1; $i -le $PostCommentsModule_MaxMessagesToPost; $i++)
{
    $priority = Get-Random -Minimum 1 -Maximum 10
    $message = BuildTestMessage "CA issue $i" $i "some/path/file.cs" $priority
    $messages.Add($message) 
}

$message2 = BuildTestMessage "CA issue that will be ignored 1" 20 "some/path/file.cs" 15
$message3 = BuildTestMessage "CA issue that will be ignored 2" 10 "some/path/file.cs" 16

$messages.Add($message2)
$messages.Add($message3)

# Shuffle the array 
$messages = [System.Collections.ArrayList]($messages | Sort-Object {Get-Random})

# Act
PostAndResolveComments $messages "SQ Test Source"

# Assert
$messages.Remove($message2)
$messages.Remove($message3)
$postedThreads = $mockDiscussionClient.GetPostedThreads()
ValidateDiscussionThreadCollection $postedThreads $messages "SQ Test Source"

#Cleanup 
Unregister-Mock GetModifiedFilesInPR 

