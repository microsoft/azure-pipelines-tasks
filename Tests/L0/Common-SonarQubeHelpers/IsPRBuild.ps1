[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1


# Test 1 - other repository provider
$env:BUILD_REPOSITORY_PROVIDER = "3rdPartyGit"
$env:Build_SourceBranch = "refs/pull/12/dev"
Assert-AreEqual $false (IsPrBuild) "Only builds from TfsGit can be PR builds"

# Test 2 - non PR build
$env:BUILD_REPOSITORY_PROVIDER = "TfsGit"
$env:Build_SourceBranch = "dev"
Assert-AreEqual $false (IsPrBuild) "Expecting the build to not be a PR build"


# Test 3 - PR Build
$env:BUILD_REPOSITORY_PROVIDER = "TfsGit"
$env:Build_SourceBranch = "refs/pull/12/master"
Assert-AreEqual $true (IsPrBuild) "Expecting the build to be a PR build"

