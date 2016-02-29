[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\PRCA\Orchestrator.ps1

# Arrange 
Register-Mock GetSonarQubeOutDirectory { "$PSScriptRoot\test output\" }


# Act
$issues = FetchAnnotatedNewIssues

echo $issues