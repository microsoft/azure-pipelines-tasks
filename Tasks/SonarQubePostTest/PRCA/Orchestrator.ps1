. $PSScriptRoot/ReportProcessor.ps1
. $PSScriptRoot/IssuesProcessor.ps1

function HandleCodeAnalysisReporting
{	
    Write-Verbose "HandleCodeAnalysisReporting..."
    if (IsPrBuild)
    {   
        Write-Host "Fetching code analysis issues and posting them to the PR..."        
        $newIssues = FetchAnnotatedNewIssues                
        
        if ( ($newIssues -eq $null) -or ($newIssues.Length -eq 0))
        {
            Write-Host "The SonarQube analysis did not find any new issues."
            return
        }

    
        LoadClientOMAssemblies
        
        $vssConnection = GetVssConnection 
        $pullRequestId = GetPullRequestId
    
        PostIssuesToCodeReview $newIssues $vssConnection  $pullRequestId
    }	
}


function GetVssConnection
{
    $vssConnection = [Microsoft.TeamFoundation.DistributedTask.Task.Internal.Core.TaskContextHelper]::GetVssConnection($distributedTaskContext); 
    Assert ( $vssConnection -ne $null ) "Internal error: could not retrieve the VssConnection object"
    
    echo $vssConnection.GetType()
    
    return $vssConnection
}

#region Private 

function LoadClientOMAssemblies
{                    
    Write-Verbose "Loading TFS client object model assemblies packaged with the build agent"
    
    $tfsClientOMDir = $env:AGENT_SERVEROMDIRECTORY
    
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
       
    $externalAssemblyPaths = $externalAssemblyNames | foreach { [System.IO.Path]::Combine($tfsClientOMDir, $_)}                        
    $externalAssemblyPaths | foreach {Add-Type -Path $_}    
    
    Write-Verbose "Loaded $externalAssemblyPaths"
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
 

#endregion
