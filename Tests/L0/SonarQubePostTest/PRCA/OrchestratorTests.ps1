[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubehelpers\SonarQubeHelper.ps1
. $PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\PRCA\Orchestrator.ps1
. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1



function BuildIssue
{    
    param ([string]$message, [int]$line, [string]$severity, [string]$relativePath)
    
    $issue = New-Object -TypeName "Collections.Generic.Dictionary[String,Object]"
    
    $issue["line"] = $line
    $issue["message"] = $message
    $issue["severity"] = $severity
    $issue["relativePath"] = $relativePath
        
    return $issue   
}

#
# Test 1: transform 2 issues to comments (happy path)
#

# Arrange 
$issue1 = BuildIssue "CA issue 1" 14 "maJor" "some/path"
$issue2 = BuildIssue "CA issue 2" 15 "INfO" "some/other/path"

# Act
$comments = GetCommentsFromIssues @($issue1, $issue2)

 
# Assert
Assert-AreEqual 2 $comments.Count "Expected to find 2 comments"

$comment1 = $comments | Where-Object {$_.line -eq 14}
$comment2 = $comments | Where-Object {$_.line -eq 15}

# the relativePath property is added by matching the component with the path using ProjectInfo.xml
Assert-AreEqual "some/path" $comment1.RelativePath "Expecting the RelativePath to be set"
Assert-AreEqual "some/other/path" $comment2.RelativePath "Expecting the RelativePath to be set"

Assert-AreEqual "CA issue 1" $comment1.Content "Expecting the Content to be set"
Assert-AreEqual "CA issue 2" $comment2.Content "Expecting the Content to be set"

Assert-AreEqual 3 $comment1.Priority "Expecting the Priority to be 3 for a major issue"
Assert-AreEqual 5 $comment2.Priority "Expecting the Priority to be 5 for an info issue"

#
# Test 2 - issues must have a "message", a "line" and a "relativePath" property
#

$issue = BuildIssue "CA issue 1" 14 "maJor" "some/path"
$issue.Remove("message")
Assert-Throws { GetCommentsFromIssues @($issue) } "*message*"

$issue = BuildIssue "CA issue 1" 14 "maJor" "some/path"
$issue.Remove("line")
Assert-Throws { GetCommentsFromIssues @($issue) } "*line*"

$issue = BuildIssue "CA issue 1" 14 "maJor" "some/path"
$issue.Remove("relativePath")
Assert-Throws { GetCommentsFromIssues @($issue) } "*relativePath*"

#
# Test 3: Priority
#

# Arrange
$blockerIssue = BuildIssue "CA issue" 1 "blocker" "some/path"
$criticalIssue = BuildIssue "CA issue" 2 "critical" "some/path"
$majorIssue = BuildIssue "CA issue" 3 "major" "some/path"
$minorIssue = BuildIssue "CA issue" 4 "minor" "some/path"
$infoIssue = BuildIssue "CA issue" 5 "info" "some/path"

$noSeverityIssue = BuildIssue "CA issue" 6 "" "some/path"
$otherSeverityIssue = BuildIssue "CA issue" 7 "extremely important" "some/path"

# Act
$comments = GetCommentsFromIssues @($blockerIssue, $criticalIssue, $majorIssue, $minorIssue, $infoIssue, $noSeverityIssue, $otherSeverityIssue)

# Assert
Assert-AreEqual 1 ($comments | Where-Object {$_.line -eq 1}).Priority "Blocker issue - priority 1"
Assert-AreEqual 2 ($comments | Where-Object {$_.line -eq 2}).Priority "Crtical issue - priority 2"
Assert-AreEqual 3 ($comments | Where-Object {$_.line -eq 3}).Priority "Major issue - priority 3"
Assert-AreEqual 4 ($comments | Where-Object {$_.line -eq 4}).Priority "Minor issue - priority 4"
Assert-AreEqual 5 ($comments | Where-Object {$_.line -eq 5}).Priority "Info issue - priority 5"

Assert-AreEqual 6 ($comments | Where-Object {$_.line -eq 6}).Priority "No severity issue - priority 6"
Assert-AreEqual 6 ($comments | Where-Object {$_.line -eq 7}).Priority "Other severity issue - priority 6"
