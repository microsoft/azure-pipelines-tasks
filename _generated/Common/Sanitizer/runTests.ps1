## Temp script to run L0 tests for Sanitizer.
## TODO: Remove after https://github.com/microsoft/azure-pipelines-tasks/pull/19108 will be merged.

$startLoc = Get-Location

$projectRoot = "$PSScriptRoot/../../.."
Set-Location $projectRoot

$buildPath = "$projectRoot/_build/Tasks/Common/Sanitizer"

try {
    Remove-Item $buildPath -Recurse -Force -ErrorAction SilentlyContinue

    ## Workaround to build common package
    node make build --task WindowsMachineFileCopyV1

    Write-Host "Running L0 tests..."
    Set-Location $buildPath/Tests
    mocha ./L0.js
}
finally {
    Set-Location $startLoc
}