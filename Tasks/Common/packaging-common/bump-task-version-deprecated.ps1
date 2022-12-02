# NOTE: This script is deprecated as all packages will be using npm published azure-pipelines-tasks-packaging-common package
# instead of local build packaging-common binary. After we make changes in packaging-common, we will need to wait for the
# newer version of azure-pipelines-tasks-packaging-common to be published into npmjs and update the task package.json to
# point to the latest version.

# Bumps the version of all of the tasks that are technically modified when packaging-common is changed.
# Please validate the updated versions to confirm that nothing went horribly wrong.
Param(
[parameter(Mandatory=$true)]
# The current sprint, find at https://whatsprintis.it/
[int] $currentSprint,
# The path to the Tasks folder
[parameter()]
[string] $taskRoot = (Join-Path $PSScriptRoot "..\..")
)

# Bump patch version and adjust sprint
# not including task that are deprecated such as NpmV0.
<<<<<<< HEAD:Tasks/Common/packaging-common/bump-task-version-deprecated.ps1
"CargoAuthenticateV0","DotNetCoreCLIV2","DownloadPackageV0","DownloadPackageV1","MavenV2","MavenV3","NpmV1","NpmAuthenticateV0","NuGetV0","NuGetCommandV2","NuGetPublisherV0","NuGetToolInstallerV0","NuGetToolInstallerV1","PipAuthenticateV0","TwineAuthenticateV0","UniversalPackagesV0","UseNodeV1" | % {
=======
"DotNetCoreCLIV2","DownloadPackageV0","DownloadPackageV1","MavenV2","MavenV3","NpmV1","NpmAuthenticateV0","NuGetV0","NuGetCommandV2","NuGetPublisherV0","NuGetToolInstallerV0","NuGetToolInstallerV1","PipAuthenticateV0","TwineAuthenticateV0","UniversalPackagesV0","UseNodeV1" | % {
>>>>>>> origin:Tasks/Common/packaging-common/bump-task-version.ps1
    $taskLocation = Join-Path "$taskRoot/$_" "task.json"
    $taskContent = Get-Content $taskLocation 
    $task = $taskContent | ConvertFrom-Json
    $v = $task.version
    $newPatch = 0
    if ($v.Minor -eq $currentSprint) {
        $newPatch = $v.Patch + 1
    }
    Write-Output "${_}: $($v.Major).$($v.Minor).$($v.Patch) to $($v.Major).$currentSprint.$newPatch"
    # Doing an awkward string replace to not interfere with any custom task.json formatting
    $versionMatch = $taskContent | Select-String '"version":'
    $versionLine = $versionMatch.LineNumber
    $taskContent[$versionLine+1] = $taskContent[$versionLine+1].Replace(" $($v.Minor),", " $currentSprint,")
    $taskContent[$versionLine+2] = $taskContent[$versionLine+2].Replace(" $($v.Patch)", " $newPatch")
    $taskContent | Set-Content $taskLocation
    
    $taskLocLocation = Join-Path "$taskRoot/$_" "task.loc.json"
    $taskLocContent = Get-Content $taskLocLocation 
    $versionMatch = $taskLocContent | Select-String '"version":'
    $versionLine = $versionMatch.LineNumber
    $taskLocContent[$versionLine+1] = $taskLocContent[$versionLine+1].Replace(" $($v.Minor),", " $currentSprint,")
    $taskLocContent[$versionLine+2] = $taskLocContent[$versionLine+2].Replace(" $($v.Patch)", " $newPatch")
    $taskLocContent | Set-Content $taskLocLocation
}

# Just bump the patch version for these.
# Because Azure Artifacts doesn't own these packages, so instead of adjusting the minor #, we bump the patch #.
"UseDotNetV2","DownloadGitHubNugetPackageV1","DownloadGitHubNpmPackageV1" | % {
    $taskLocation = Join-Path "$taskRoot/$_" "task.json"
    $taskContent = Get-Content $taskLocation 
    $task = $taskContent | ConvertFrom-Json
    $v = $task.version
    $newPatch = $v.Patch + 1

    Write-Output "${_}: $($v.Major).$($v.Minor).$($v.Patch) to $($v.Major).$($v.Minor).$newPatch"
    # Doing an awkward string replace to not interfere with any custom task.json formatting
    $versionMatch = $taskContent | Select-String '"version":'
    $versionLine = $versionMatch.LineNumber
    $taskContent[$versionLine+2] = $taskContent[$versionLine+2].Replace(" $($v.Patch)", " $newPatch")
    $taskContent | Set-Content $taskLocation
    
    $taskLocLocation = Join-Path "$taskRoot/$_" "task.loc.json"
    $taskLocContent = Get-Content $taskLocLocation 
    $versionMatch = $taskLocContent | Select-String '"version":'
    $versionLine = $versionMatch.LineNumber
    $taskLocContent[$versionLine+2] = $taskLocContent[$versionLine+2].Replace(" $($v.Patch)", " $newPatch")
    $taskLocContent | Set-Content $taskLocLocation
}