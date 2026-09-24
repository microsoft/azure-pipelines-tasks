[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TasksRoot,
    [ValidateRange(1, 8)]
    [int]$ThrottleLimit = 4
)

$ErrorActionPreference = 'Stop'

$tasksRootPath = (Resolve-Path -LiteralPath $TasksRoot).Path
$taskDirectories = @(
    Get-ChildItem -LiteralPath $tasksRootPath -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'node_modules') }
)

Write-Host "Generating node_modules catalogs for $($taskDirectories.Count) task(s) with $ThrottleLimit worker(s)."

$pending = [Collections.Generic.Queue[IO.DirectoryInfo]]::new()
foreach ($taskDirectory in $taskDirectories) {
    $pending.Enqueue($taskDirectory)
}

$activeJobs = [Collections.Generic.List[System.Management.Automation.Job]]::new()
$completedCount = 0

try {
    while ($pending.Count -gt 0 -or $activeJobs.Count -gt 0) {
        while ($pending.Count -gt 0 -and $activeJobs.Count -lt $ThrottleLimit) {
            $taskDirectory = $pending.Dequeue()
            $nodeModulesPath = Join-Path $taskDirectory.FullName 'node_modules'
            $catalogPath = Join-Path $taskDirectory.FullName 'node_modules.cat'
            $mockeryPath = Join-Path $nodeModulesPath 'mockery'

            if (Test-Path -LiteralPath $catalogPath) {
                Remove-Item -LiteralPath $catalogPath -Force
            }

            # Packaging already omits this test-only module. Remove it before hashing so the
            # catalog describes the exact node_modules content that is shipped.
            if (Test-Path -LiteralPath $mockeryPath) {
                Remove-Item -LiteralPath $mockeryPath -Recurse -Force
                Write-Host "Removed packaging-excluded module: $mockeryPath"
            }

            $job = Start-Job -Name $taskDirectory.Name -ArgumentList $nodeModulesPath, $catalogPath -ScriptBlock {
                param($SourcePath, $CatalogPath)

                $ErrorActionPreference = 'Stop'
                $timer = [Diagnostics.Stopwatch]::StartNew()
                New-FileCatalog -Path $SourcePath -CatalogFilePath $CatalogPath -CatalogVersion 2.0 | Out-Null
                $timer.Stop()

                [pscustomobject]@{
                    Task = Split-Path -Path (Split-Path -Path $SourcePath -Parent) -Leaf
                    Catalog = $CatalogPath
                    Elapsed = $timer.Elapsed
                }
            }

            $activeJobs.Add($job)
        }

        $finishedJob = Wait-Job -Job $activeJobs -Any
        $jobErrors = @()
        $result = Receive-Job -Job $finishedJob -ErrorAction SilentlyContinue -ErrorVariable jobErrors

        if ($finishedJob.State -ne 'Completed' -or $jobErrors.Count -gt 0) {
            $details = if ($jobErrors.Count -gt 0) {
                $jobErrors -join [Environment]::NewLine
            } elseif ($finishedJob.ChildJobs[0].JobStateInfo.Reason) {
                $finishedJob.ChildJobs[0].JobStateInfo.Reason.Message
            } else {
                "Job ended in state '$($finishedJob.State)'."
            }

            throw "Catalog generation failed for task '$($finishedJob.Name)': $details"
        }

        $completedCount++
        Write-Host "[$completedCount/$($taskDirectories.Count)] Generated $($result.Catalog) in $($result.Elapsed)."

        [void]$activeJobs.Remove($finishedJob)
        Remove-Job -Job $finishedJob
    }
} finally {
    foreach ($job in $activeJobs) {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Generated $completedCount node_modules catalog(s)."
