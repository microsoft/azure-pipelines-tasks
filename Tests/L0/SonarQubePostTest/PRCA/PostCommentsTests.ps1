[CmdletBinding()]
param()

# import the module before initializing the test library to avoid "import-module" being mocked
Import-Module -Name "$PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\PRCA\PostComments-Module.psm1" -Verbose

. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1

#
# The tests do not have access to the TFS client assemblies because those live only on the build agent. As such instead of mocking 
# types such as DiscussionThread, these need to be completly replaced. Since the client API is binary compatible with future versions, this 
# should not cause a test hole. 
#
$source = @"

using System.Collections;
using System.Collections.Generic;

namespace Microsoft.VisualStudio.Services.WebApi
{
    public class PropertiesCollection : Dictionary<string, object>
    {
        
    }
}

namespace Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi
{
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

# Builds the input, similar to the ReportProcessor module output 
function BuildTestComment 
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
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threadCollection, [Array]$inputComments)
    
    $endLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::EndLine
    $startLineName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartLine
    $itemPathName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::ItemPath
    
    ValidateCommonThreadAttributes $threadCollection
    Assert-AreEqual $inputComments.Count $threadCollection.Count "Inconsistent number of threads. There should be 1 thread for each comment."    
    foreach ($inputComment in $inputComments)
    {
        $thread = $threadCollection | Where-Object {
            ($_.Comments[0].Content -eq $inputComment.Content) -and 
            ($_.Properties[$startLineName] -eq $inputComment.Line) }
            
        Assert-IsNotNullOrEmpty $thread "Could not find a thread associated with the comment on line $($inputComment.Line) with message $($inputComment.Content)"
        Assert-AreEqual $inputComment.RelativePath $thread.Properties[$itemPathName] "Invalid ItemPath property"
        Assert-AreEqual $inputComment.Line $thread.Properties[$endLineName] "The EndLine should be the same as the comment's line"
    }
    
    return $true
}

#
# Validates static thread properties that are not tied to the original comment  
#
function ValidateCommonThreadAttributes
{
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threadCollection)
    
    $startColumnName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::StartColumn
    $positionContextName = [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadPropertyNames]::PositionContext
    
    $threadCollection | ForEach-Object {Assert-AreEqual "artifact uri" $_.ArtifactUri "Each thread should have the same ArtifactUri"}
    $threadCollection | ForEach-Object {
        Assert-AreEqual 
        [Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionStatus]::Active 
        $_.Status 
        "Each thread should be active"}
    $threadCollection | ForEach-Object {Assert-AreEqual 1 $_.Comments.Count "Each thread should have a single comment"}
    $threadCollection | ForEach-Object {Assert-AreEqual $false $_.Comments.IsDeleted "Each thread should be marked as not deleted"}
    
    $threadCollection | ForEach-Object {Assert-AreEqual 8 $_.Properties.Count "Each thread should have 8 properties"}
    
    $threadCollection | ForEach-Object {Assert-AreEqual "Source Commit" $_.Properties["CodeReviewSourceCommit"] "Invalid CodeReviewSourceCommit property"}
    $threadCollection | ForEach-Object {Assert-AreEqual "Target Commit" $_.Properties["CodeReviewTargetCommit"] "Invalid CodeReviewTargetCommit property"}
    $threadCollection | ForEach-Object { Assert-AreEqual 1 $_.Properties[$startColumnName] "Invalid StartColumn property."}
    $threadCollection | ForEach-Object { Assert-AreEqual "RightBuffer" $_.Properties[$positionContextName] "Invalid PositionContext property."}
    $threadCollection | ForEach-Object { Assert-AreEqual "CodeAnalysisIssue" $_.Properties["CodeAnalysisThreadType"] "Invalid CodeAnalysisThreadType property."}
}

function InitPostCommentsModule 
{
    $mockGitClient = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitHttpClient"
    $mockPullRequest = New-Object -TypeName "Microsoft.TeamFoundation.SourceControl.WebApi.GitPullRequest"

    # Legacy PR
    $mockPullRequest.CodeReviewId = 0
    $mockPullRequest.LastMergeSourceCommit = "Source Commit"
    $mockPullRequest.LastMergeTargetCommit = "Target Commit"

    Test-InitPostCommentsModule $mockGitClient $mockPullRequest "artifact uri"
}

InitPostCommentsModule

# Test 1 (happy path) - Post 2 comments 

# Arrange
Register-Mock PostDiscussionThreads

$comment1 = BuildTestComment "CA issue 1" 14 "some/path1" 1 
$comment2 = BuildTestComment "CA issue 2" 15 "some/path2" 5
$inputComments = @($comment1, $comment2) 

# Act
PostAndResolveComments $inputComments

# Assert
Assert-WasCalled PostDiscussionThreads -ArgumentsEvaluator {ValidateDiscussionThreadCollection $args[0] $inputComments}

#Cleanup 
Unregister-Mock PostDiscussionThreads

#
# Test 2 - Post more than the maximum allowed comments and test that the comments posted are ordered by priority
#

# Arrange 
Register-Mock PostDiscussionThreads
$inputComments = New-Object "Collections.ArrayList"

# Add max number of allowed comments 
for($i=1; $i -le $PostCommentsModule_MaxIssuesToPost; $i++)
{
    $priority = Get-Random -Minimum 1 -Maximum 10
    $comment = BuildTestComment "CA issue $i" $i "some/path" $priority
    $inputComments.Add($comment) 
}

$comment2 = BuildTestComment "CA issue that will be ignored 1" 1 "some/path" 15
$comment3 = BuildTestComment "CA issue that will be ignored 2" 2 "some/path" 16
$inputComments.Add($comment2)
$inputComments.Add($comment3)

# Shuffle the array 
$inputComments = [System.Collections.ArrayList]($inputComments | Sort-Object {Get-Random})

# Act
PostAndResolveComments $inputComments

# Assert
$inputComments.Remove($comment2)
$inputComments.Remove($comment3)
Assert-WasCalled PostDiscussionThreads -ArgumentsEvaluator {ValidateDiscussionThreadCollection $args[0] $inputComments}

#Cleanup 
Unregister-Mock PostDiscussionThreads