param(
    [string]$FilePath
)

$currentLocation = Get-Location

try {
    $repoRoot = Join-Path $PSScriptRoot ..
    Set-Location $repoRoot

    $jsonArray = @()

    $diffOutput = git diff --unified=0 $FilePath
    $lines = $diffOutput -split "`n"

    $metadataSkipped = $false
    foreach ($line in $lines) {
        if ($line -match '^@@ \-(\d+) \+(\d+) @@') {
            $removedLineNumber = [int]$matches[1]
            $addedLineNumber = [int]$matches[2]
            $metadataSkipped = $true
        }
        elseif ($line -match '^@@ \-(\d+),(\d+) \+(\d+),(\d+) @@' ) {
            $removedLineNumber = [int]$matches[1]
            $addedLineNumber = [int]$matches[3]
            $metadataSkipped = $true
        }

        if ($metadataSkipped) {
            if ($line -match '^\+(.*)') {
                $jsonObject = [PSCustomObject]@{
                    File    = $FilePath
                    Line    = $addedLineNumber
                    Change  = "Added"
                    Content = $matches[1]
                }
                $jsonArray += $jsonObject

                $addedLineNumber++
            }
            elseif ($line -match '^\-(.*)') {
                $jsonObject = [PSCustomObject]@{
                    File    = $FilePath
                    Line    = $removedLineNumber
                    Change  = "Removed"
                    Content = $matches[1]
                }
                $jsonArray += $jsonObject

                $removedLineNumber++
            }
        }
    }

    $jsonOutput = $jsonArray | ConvertTo-Json

    $jsonOutput
}
finally {
    Set-Location $currentLocation
}
