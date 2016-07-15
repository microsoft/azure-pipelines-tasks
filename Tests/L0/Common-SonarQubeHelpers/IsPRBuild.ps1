[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1

# Test 1 - other repository provider
Register-Mock GetTaskContextVariable  {"3rdPartyGit"} -- "Build.Repository.Provider"
Register-Mock GetTaskContextVariable  {"refs/pull/12/dev"} -- "Build.SourceBranch"
Assert-AreEqual $false (IsPrBuild) "Only builds from TfsGit can be PR builds"
Unregister-Mock GetTaskContextVariable

# Test 2 - non PR build
Register-Mock GetTaskContextVariable  {"TfsGit"} -- "Build.Repository.Provider"
Register-Mock GetTaskContextVariable  {"dev"} -- "Build.SourceBranch"
Assert-AreEqual $false (IsPrBuild) "Expecting the build to not be a PR build"
Unregister-Mock GetTaskContextVariable


# Test 3 - PR Build
Register-Mock GetTaskContextVariable  {"TfsGit"} -- "Build.Repository.Provider"
Register-Mock GetTaskContextVariable  {"refs/pull/12/master"} -- "Build.SourceBranch"
Assert-AreEqual $true (IsPrBuild) "Expecting the build to be a PR build"
Unregister-Mock GetTaskContextVariable


