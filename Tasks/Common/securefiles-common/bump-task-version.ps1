# Bumps the version of all of the tasks that are technically modified when securefiles-common is changed.
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
"AndroidSigningV2", "AndroidSigningV3", "DownloadSecureFileV1", "HelmDeployV0", "InstallAppleCertificateV2", "InstallAppleProvisioningProfileV1", "InstallSSHKeyV0" | % {
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