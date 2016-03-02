[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\PRCA\Orchestrator.ps1
. $PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1

# Check the utility function that extracts the PR id from the source branch. The source branch format is refs/pull/{id}/{name}


Assert-Throws { RetrievePullRequestId "dev" } "Internal Error: *"
Assert-Throws { RetrievePullRequestId "a/b/4/c" } "Internal Error: *"
Assert-Throws { RetrievePullRequestId "refs/pull" } "Internal Error: *"  
Assert-Throws { RetrievePullRequestId "refs/pull/0/a" } "Internal Error: *"

Assert-AreEqual 14 (RetrievePullRequestId "refs/pull/14/master") 

