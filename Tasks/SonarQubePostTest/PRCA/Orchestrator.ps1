#
# Main entry point into the PRCA experience
#
function HandleCodeAnalysisReporting
{	
    
    if (IsPrBuild)
    {   
        Write-Host "Fetching code analysis issues and posting them to the PR..."
           
        Import-Module -Name "$PSScriptRoot/ReportProcessor-Module.psm1"
        Import-Module -Name "$PSScriptRoot/PostComments-Module.psm1"
             
        $newIssues = FetchAnnotatedNewIssues                
        
        $vssConnection = GetVssConnection 
        InitPostCommentsModule $vssConnection
        $messages = GetMessagesFromIssues $newIssues
        
        PostAndResolveComments $messages "SonarQube Code Analysis"
    }	
    else
    {
        Write-Verbose "The build was not triggered by a Pull Request, not processing code analysis comments"   
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
function GetMessagesFromIssues
{
    param ([Array]$issues)
    
    $sw = new-object "Diagnostics.Stopwatch"
    $sw.Start();
     
    Write-Verbose "Transforming SonarQube analysis issues to PR comments"
    
    $comments = New-Object System.Collections.ArrayList
    
    foreach ($issue in $issues)
    {
        $priority = GetCommentPriority $issue

        if ([String]::IsNullOrWhiteSpace($issue.line) -or $issue.line -lt 0)
        {
            Write-Verbose "A SonarQube issue - $($issue.message) from $($issue.relativePath) - has no line associated with it. Placing it at the beginning of the file."
            $issue.line = 0
        }
        
        Assert ( ![String]::IsNullOrWhiteSpace($issue.message) ) ("Internal error: a SonarQube issue does not have a property named 'message' " + (DumpObject($issue)))
        Assert ( ![String]::IsNullOrWhiteSpace($issue.relativePath) ) ("Internal error: a SonarQube issue does not have a property named 'relativePath' " +(DumpObject($issue)))
        Assert ( ![String]::IsNullOrWhiteSpace($issue.rule) ) ("Internal error: a SonarQube issue does not have a property named 'rule' " + (DumpObject($issue)))
        
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
    
    Write-Verbose "Creating $($issues.Count) messages from issues took $($sw.ElapsedMilliseconds) ms"
         
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

function DumpObject()
{
    param ($obj)
    
    if ($obj -eq $null)
    {
        return "Null"
    }
    
    return ($obj | Format-Table | Out-String)   
}
