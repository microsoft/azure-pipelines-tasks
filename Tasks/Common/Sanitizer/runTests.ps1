$startLoc = Get-Location

Set-Location $PSScriptRoot/../../..

try {
    Remove-Item .\_build\Tasks\Common\Sanitizer -Recurse -Force -ErrorAction SilentlyContinue
    node make build --task AzureFileCopyV5
    node make test --task Common/Sanitizer
}
finally {
    Set-Location $startLoc
}
