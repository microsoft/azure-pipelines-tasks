[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1


# Test 1 - if $env:Build_SourceBranch is not set, throw
Assert-Throws { IsPrBuild }

# Test 2 - non PR build
$env:Build_SourceBranch = "dev"
Assert-AreEqual $false (IsPrBuild) "Expecting the build to not be a PR build"


# Test 3 - PR Build
$env:Build_SourceBranch = "refs/pull/12/master"
Assert-AreEqual $true (IsPrBuild) "Expecting the build to be a PR build"