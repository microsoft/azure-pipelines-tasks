#region Private Members

$script:gitClient = $null
$script:discussionClient = $null
$script:codeReviewClient = $null
$script:project = $null
$script:pullRequest = $null

#endregion

#region Public

function InitPostCommentsModule
{
    param ([Microsoft.VisualStudio.Services.Client.VssConnection][ValidateNotNull()]$vssConnection)
    
    Write-Verbose "InitPostCommentsModule"
    
    $tfsClientAssemblyDir =  GetTaskContextVariable "agent.serveromdirectory"
    LoadTfsClientAssemblies $tfsClientAssemblyDir
    InternalInit            
}

#endregion

#region Private

function LoadTfsClientAssemblies
{                    
    Write-Verbose "Loading TFS client object model assemblies packaged with the build agent"      
    
    $externalAssemblyNames = (             
        "Microsoft.TeamFoundation.Common.dll",
        "Microsoft.TeamFoundation.Core.WebApi.dll",
        "Microsoft.TeamFoundation.SourceControl.WebApi.dll",             
        "Microsoft.VisualStudio.Services.CodeReview.Common.dll",
        "Microsoft.VisualStudio.Services.CodeReview.Discussion.WebApi.dll",    
        "Microsoft.VisualStudio.Services.CodeReview.WebApi.dll",        
        "Microsoft.VisualStudio.Services.Common.dll",
        "Microsoft.VisualStudio.Services.WebApi.dll",
        "Newtonsoft.Json.dll")
       
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
    $artifactUri = GetArtifactUri $script:pullRequest.CodeReviewId $script:pullRequest.Repository.ProjectReference.Id $pullRequestId
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
 

#region Common Helpers 

function GetTaskContextVariable()
{
	param([string][ValidateNotNullOrEmpty()]$varName)
	return Get-TaskVariable -Context $distributedTaskContext -Name $varName
}

#
# C# like assert based on a condition. Note that PowerShell does not support actual assertions so 
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
Export-ModuleMember -Function 'InitPostCommentsModule', 'PostCommentsToPR'