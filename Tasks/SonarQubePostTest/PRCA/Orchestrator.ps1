#
# Main entry point into the PRCA experience
#
function HandleCodeAnalysisReporting
{	
    Write-Verbose "HandleCodeAnalysisReporting"
    if (IsPrBuild)
    {   
        Write-Host "Fetching code analysis issues and posting them to the PR..."
           
        Import-Module -Name "$PSScriptRoot/ReportProcessor-Module.psm1"
        Import-Module -Name "$PSScriptRoot/PostComments-Module.psm1"
             
        $newIssues = FetchAnnotatedNewIssues                
        
        $vssConnection = GetVssConnection 
        InitPostCommentsModule $vssConnection
        $comments = GetCommentsFromIssues $newIssues
        
        PostAndResolveComments $comments "SonarQube Code Analysis"
    }	
}

#region Private 

function GetVssConnection
{
    $vssConnection = [Microsoft.TeamFoundation.DistributedTask.Task.Internal.Core.TaskContextHelper]::GetVssConnection($distributedTaskContext); 
    Assert ( $vssConnection -ne $null ) "Internal error: could not retrieve the VssConnection object"

    return $vssConnection
}

#
# The issues, as reported by SonarQube, need to be transformed to a simpler structure that the PostComments module can consume
# 
function GetCommentsFromIssues
{
    param ([Array]$issues)
    
    Write-Verbose "Transforming SonarQube analysis issues to PR comments"
    
    $comments = New-Object System.Collections.ArrayList

    foreach ($issue in $issues)
    {
        $priority = GetCommentPriority $issue

        Assert ( ![String]::IsNullOrWhiteSpace($issue.message) ) "Internal error: the SonarQube reported issues do not have a property named 'message'"
        Assert ( ![String]::IsNullOrWhiteSpace($issue.line) ) "Internal error: the SonarQube reported issues do not have a property named 'line'"        
        Assert ( ![String]::IsNullOrWhiteSpace($issue.relativePath) ) "Internal error: the SonarQube reported issues do not have a property named 'relativePath'"
        Assert ( ![String]::IsNullOrWhiteSpace($issue.rule) ) "Internal error: the SonarQube reported issues do not have a property named 'rule'"
        
        $ruleId = GetRuleId $issue
        
        $properties = @{
            Content = $issue.message + " ($ruleId)"
            Line = $issue.line
            RelativePath = $issue.relativePath
            Priority = $priority 
        }

        $comment = new-object PSObject -Property $properties

        [void]$comments.Add($comment)
    }
    
    return $comments
}

#
# The rule string is of form <repository>:<ruleId>. This function extracts the ruleId
#
function GetRuleId
{
    param($issue)
    
    $parts = $issue.rule.Split(':')
    Assert (($parts -ne $null) -and ($parts.Count -ge 2))  "Could not extract the rule id from $($issue.Rule)"
    
    return $parts[1]
}

#
# Remark: The PostComments module limits the number of messages it will post so it needs a way to find the most important comments 
# 
function GetCommentPriority
{
    param([PSObject]$issue)

    switch ($issue.severity)  # case insensitive exact match 
    {
         "blocker" { return 1 }
         "critical" { return 2 }
         "major" { return 3 }
         "minor" { return 4 }
         "info" { return 5 }
         default { return 6 }                                   
    }
}

#endregion
