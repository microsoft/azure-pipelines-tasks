# This file contains functions that are part of the PostComments-Module 
# and that interact only with the TFS Client objects  

#
# Initializes the module for posting to the current PR. Usses both vssConnection and env variables to initialize internal actors
# This function should be called again for a different PR.
#
function InitPostCommentsModule
{
    param ([ValidateNotNull()]$vssConnection)
    
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
    [Guid] $repositoryId = [Guid]::Empty
    [Guid]::TryParse((GetTaskContextVariable "build.repository.id"), [ref]$repositoryId)

    # There is a bug in core agent 2.103.0 and lower   
    if ($repositoryId -eq [Guid]::Empty)
    {
        throw "Cannot determine the repository id. Please ensure you're build agent is up to date"
    }   

    $script:project = GetTaskContextVariable "system.teamProject"

    Assert (![String]::IsNullOrWhiteSpace($script:project)) "Internal error: could not determine the system.teamProject"   

    $pullRequestId = GetPullRequestId
    Write-Verbose "Fetching the pull request object with id $pullRequestId"

    $request = InvokeByReflection $script:gitClient "GetPullRequestAsync" @([String], [Guid], [int]) @($script:project.ToString(),  [Guid]::Parse($repositoryId), $pullRequestId)
    $script:pullRequest = $request.Result

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
    param ([Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]$threads)

    if (($threads -eq $null) -or ($threads.Count -eq 0))
    {
        Write-Debug "No threads to post"
        return;
    }
    
    $vssJsonThreadCollection = New-Object -TypeName "Microsoft.VisualStudio.Services.WebApi.VssJsonCollectionWrapper[Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.DiscussionThreadCollection]" -ArgumentList @(,$threads)
    [void]$script:discussionClient.CreateThreadsAsync($vssJsonThreadCollection, $null, [System.Threading.CancellationToken]::None).Result
    
    Write-Host "Posted $($threads.Count) discussion threads"
}

#
# Retrieve existing discussion threads that were created by this module and that are active (i.e. not fixed)
#
function FetchActiveDiscussionThreads
{
    $request = $script:discussionClient.GetThreadsAsync($artifactUri, $null, [System.Threading.CancellationToken]::None)
    $threadsDictionary = $request.Result
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
        $request = InvokeByReflection  $script:discussionClient "GetCommentsAsync" @([Int]) @($discussionThread.DiscussionId)
        $commentsFromThread = $request.Result

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
    $request = InvokeByReflection $script:codeReviewClient "GetReviewAsync" @([Guid], [Int]) @($script:pullRequest.Repository.ProjectReference.Id, $script:pullRequest.CodeReviewId)
    $review = $request.Result;

    Assert ($review -ne $null) "Could not retrieve the review"
    Assert (HasElements $review.Iterations) "No iterations found on the review"
    
    $lastIterationId = ($review.Iterations.Id | Measure -Maximum).Maximum

    return $lastIterationId
}

function GetCodeFlowChanges
{
     param ([int]$iterationId)
     
     $request = InvokeByReflection $script:codeReviewClient "GetChangesAsync" @([Guid], [Int], [Int]) @($script:pullRequest.Repository.ProjectReference.Id, $script:pullRequest.CodeReviewId,$iterationId)
     $changes = $request.Result;
     
     if ($changes)
     {
        Write-Verbose "Change count: $($changes.Count)"
     }

     return $changes
}

function TryGetCodeFlowChangeTrackingId
{
    param ($changes, $path, [Ref][int]$changeId)

    $change = @($changes.ChangeEntries | Where-Object {$_.Modified.Path -eq $path})
    if (($change -eq $null) -or ($change.Count -ne 1))
    {
        return $false;
    }
    
    $changeId.Value = $change[0].ChangeTrackingId;
    return $true;
} 

#endregion 

#
# Invoke a method with optional params by reflection. 
# This can be used to overcome PS bugs in determining the correct overload candidate method from a .net assembly
#
# Remark: this does not work with polymorphic parameters
function InvokeByReflection
{
    param ($obj, $methodName, [Type[]] $parameterTypes, [Object[]] $parameterValues)

    # GetMethod(name, Type[]) could also be used, but the methods tend to have many parameters and to list them all make the code harder to read
    $publicMethods = $obj.GetType().GetMethods() | Where-Object {($_.Name -eq $methodName) -and  ($_.IsPublic -eq $true)}
    Assert ($publicMethods.Count -gt 0) "$methodName not found"

    foreach ($method in $publicMethods)
    {
        $methodParams = $method.GetParameters();
        if ((ParamTypesMatch $methodParams $parameterTypes) -eq $true) 
        {
            $paramValuesAndDefaults = New-Object "System.Collections.Generic.List[Object]"
            $paramValuesAndDefaults.AddRange($parameterValues);

            for ($i=0; $i -lt ($methodParams.Length - $parameterValues.Length); $i++)
            {
                $paramValuesAndDefaults.Add([Type]::Missing);
            } 

            return $method.Invoke($obj, [Reflection.BindingFlags]::OptionalParamBinding, $null, $paramValuesAndDefaults.ToArray(), [Globalization.CultureInfo]::CurrentCulture)
        }
    }

    throw "No suitable overload found for $methodName"
}

#
# Returns true if the candidate types match are a subset of method parameter types, on a position by position basis
# 
function ParamTypesMatch
{
   param ([Reflection.ParameterInfo[]] $methodParams, [Type[]] $candidateTypes)

   for ($i=0; $i -lt $candidateTypes.Length; $i++) {
       if ($methodParams[$i].ParameterType -ne $candidateTypes[$i])
       {
           return $false;
       }
   }
  
   return (($methodParams | select -Skip $candidateTypes.Length | Where-Object {$_.IsOptional -eq $false}).Count -eq 0)
}