[CmdletBinding()]
param()

Import-Module -Name "$PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\PRCA\ReportProcessor-Module.psm1" -Verbose

. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1

#
# This test validates the ReportProcessor that is responsible for loading the new issues 
# from the SonarQube json report and computing the relative path to the associated code file. 
#

# Arrange 
Register-Mock GetSonarQubeOutDirectory { "$PSScriptRoot\data\out\" }

# The repo local path matches the reportFilePath property from the projectInfo.xml files 
Register-Mock Get-TaskVariable { "C:\agent\_work\3\s" } -- -Context $distributedTaskContext -Name "Build.Repository.LocalPath"

# Act
$actualIssues = FetchAnnotatedNewIssues

# Assert
Assert-AreEqual 2 $actualIssues.Count "Expected to find 2 new issues"
$actualIssues | ForEach-Object {Assert-AreEqual $_.isNew $true "All identified issues should be marked as new" }

$issue1 = $actualIssues | Where-Object {$_.key -eq "01532D5DA0E13EE55C"}
$issue2 = $actualIssues | Where-Object {$_.key -eq "01532D5DA0C93EE550"}

Assert-AreEqual "fxcop:RemoveUnusedLocals" $issue1.rule "Invalid rule string"
Assert-AreEqual "csharpsquid:S1481" $issue2.rule "Invalid rule string"

# the relativePath property is added by matching the component with the path using ProjectInfo.xml
Assert-AreEqual "/CSProj2/Class1.cs" $issue1.relativePath "Expecting the relativePath property to be correctly on an issue"
Assert-AreEqual "/ConsoleApplication1/Program.cs" $issue2.relativePath "Expecting the relativePath property to be correctly on an issue"

# Cleanup
Unregister-Mock GetSonarQubeOutDirectory
Unregister-Mock Get-TaskVariable