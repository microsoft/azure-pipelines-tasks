param(
    [string]$TaskName,
    [string]$Version,
    [switch]$ShowRelease
)

<#
.SYNOPSIS
    List all unique versions of an Azure Pipelines task and show the commit link for each version, or search for a particular version.
.DESCRIPTION
    This script scans the git history of a task's task.json file and outputs all unique versions found, sorted in version order. 
    It provides clickable commit links if a remote is set, or commit hashes otherwise. 
    You can choose to see all versions or search for a particular version.
    Output is shown as a table for easy reading.
.PARAMETER TaskName
    The name of the task (e.g., CopyFilesV2)
.EXAMPLE
    pwsh ./Find-FirstTaskVersionCommit.ps1
#>
function Show-ErrorAndExit($msg) {
    Write-Host "[ERROR] $msg" -ForegroundColor Red
    exit 1
}

# Only prompt for parameters if not provided
if (-not $TaskName) {
    Write-Host ""  # Add spacing
    Write-Host "View (A)ll versions of a task, or (S)earch for a particular version" -ForegroundColor Cyan
    $action = Read-Host 'Enter "A" for all, or "S" for search'
    if ($action -notin @('A', 'a', 'S', 's')) {
        Show-ErrorAndExit "Invalid action. Please enter 'A' for all versions or 'S' for search."
    }
    $TaskName = Read-Host 'Enter the task name (e.g CopyFilesV2)'
    if($TaskName -eq '') {
        Show-ErrorAndExit "Task name cannot be empty. Please provide a valid task name."
    }
    $searchMode = $action -eq 's'
    if ($searchMode) {
        Write-Host ""  # Add spacing
        $Major = Read-Host 'Enter the Major version number'
        $Minor = Read-Host 'Enter the Minor version number'
        $Patch = Read-Host 'Enter the Patch version number'
        $showReleaseInput = Read-Host 'Do you want to show the release tag? (Y/N)'
        if ($showReleaseInput -match '^(y|yes)$') {
            $ShowRelease = $true
        } else {
            $ShowRelease = $false
        }
    }
} else {
    $searchMode = $false
    if ($Version) {
        $searchMode = $true
        $versionParts = $Version -split '\.'
        if ($versionParts.Length -eq 3) {
            $Major = $versionParts[0]
            $Minor = $versionParts[1]
            $Patch = $versionParts[2]
        } else {
            Show-ErrorAndExit "Version must be in the format Major.Minor.Patch (e.g., 2.252.0)"
        }
    }
}

$TaskJsonPath = "../../Tasks/${TaskName}/task.json"
if (-not (Test-Path $TaskJsonPath)) {
    Show-ErrorAndExit "Task not found: $TaskName. Please check the task name and try again."
}

# Try to get the remote URL for link generation
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl) {
    if ($remoteUrl -like 'git@*') {
        $remoteUrl = $remoteUrl -replace ':', '/' -replace 'git@', 'https://'
        $remoteUrl = $remoteUrl -replace '.git$', ''
    } elseif ($remoteUrl -like 'http*') {
        $remoteUrl = $remoteUrl -replace '.git$', ''
    }
}

$commits = git log --format="%H" -- $TaskJsonPath
if (-not $commits) {
    Show-ErrorAndExit "No git history found for $TaskJsonPath. Please ensure Task exists"
}

$versions = @{}
foreach ($commit in $commits) {
    $content = git show "${commit}:$TaskJsonPath" 2>$null
    if ($content) {
        try {
            $json = $content | ConvertFrom-Json
            $ver = "$($json.version.Major).$($json.version.Minor).$($json.version.Patch)"
            if (-not $versions.ContainsKey($ver)) {
                $commitInfo = git show -s --format="%an" $commit
                $commitDateRaw = git show -s --format="%ad" --date=iso $commit
                $commitDate = (Get-Date $commitDateRaw).ToString('dd-MM-yyyy')
                $commitUrl = $remoteUrl ? "$remoteUrl/commit/$commit" : $commit
                $versions[$ver] = [PSCustomObject]@{
                    Version = $ver
                    LinkOrCommit = $commitUrl
                    Date = $commitDate
                    Author = $commitInfo
                    CommitHash = $commit
                }
            }
        } catch {
            Write-Host "[WARN] Could not parse JSON for commit $commit. Skipping." -ForegroundColor DarkYellow
        }
    }
}

# Function to get the release tag(s) for a given commit
function Get-ReleaseTagsForCommit($commitHash) {
    $tags = git tag --contains $commitHash 2>$null
    if ($tags) {
        $sortedTags = $tags | Sort-Object { [int]$_ } -ErrorAction SilentlyContinue
        return $sortedTags[0]
    } else {
        return $null
    }
}

if ($versions.Count -eq 0) {
    Show-ErrorAndExit "No valid versions found for ${TaskName}."
}

# Build $table in commit order (latest first, no need to sort)
$table = @()
foreach ($commit in $commits) {
    $ver = $null
    if ($versions.ContainsKey($commit)) {
        # Should never happen, but skip if duplicate
        continue
    }
    # Find the version for this commit
    foreach ($v in $versions.Keys) {
        if ($versions[$v].LinkOrCommit -like "*${commit}") {
            $ver = $v
            break
        }
    }
    if ($ver) {
        $row = $versions[$ver].PSObject.Copy()
        # If LinkOrCommit is a URL, make it a clickable hyperlink with text as the full commit hash
        if ($row.LinkOrCommit -match '^https?://') {
            $commitHash = $row.LinkOrCommit -replace '^.*\/([^\/]+)$', '$1'
            $row.LinkOrCommit = "`e]8;;$($row.LinkOrCommit)`e\$commitHash`e]8;;`e\"
        }
        $table += $row
    }
}

# If user provided a version, check if it ever existed
if ($searchMode) {
    # Enforce all parameters for search
    if (-not $Major -or -not $Minor -or -not $Patch) {
        Show-ErrorAndExit "All parameters (Major, Minor, Patch) are required for search. Please provide valid values."
    }

    # If Major, Minor, and Patch are provided, search for that specific version 
    if ($Major -and $Minor -and $Patch) {
        Write-Host ""  # Add spacing
        Write-Host "[INFO] Searching for version $Major.$Minor.$Patch..." -ForegroundColor Yellow
        Write-Host ""  # Add spacing
        $inputVersion = "$Major.$Minor.$Patch"
        if ($versions.ContainsKey($inputVersion)) {
            $row = $versions[$inputVersion].PSObject.Copy()
            # If LinkOrCommit is a URL, make it a clickable hyperlink with text as the full commit hash
            if ($row.LinkOrCommit -match '^https?://') {
                $commitHash = $row.LinkOrCommit -replace '^.*\/([^\/]+)$', '$1'
                $row.LinkOrCommit = "`e]8;;$($row.LinkOrCommit)`e\$commitHash`e]8;;`e\"
            }
            Write-Host "[SUCCESS] Version $inputVersion existed." -ForegroundColor Green
            Write-Host ""  # Add spacing
            $row | Format-Table Version, LinkOrCommit, Date, Author
            if ($ShowRelease) {
                $commitHash = $row.CommitHash
                $releaseTag = Get-ReleaseTagsForCommit $commitHash
                if ($releaseTag) {
                    if ($remoteUrl) {
                        $releaseUrl = "$remoteUrl/releases/tag/$releaseTag"
                        Write-Host "This version is part of release: $releaseTag" -ForegroundColor Green
                        Write-Host "Release link: $releaseUrl" -ForegroundColor Cyan
                    } else {
                        Write-Host "This version is part of release: $releaseTag" -ForegroundColor Green
                    }
                } else {
                    Write-Host "No release tag found for this version." -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "Version $inputVersion does not exist for ${TaskName}." -ForegroundColor Red
            Write-Host ""  # Add spacing
            Write-Host "[INFO] Valid versions for ${TaskName}:" -ForegroundColor Cyan
            $table | Format-Table Version, LinkOrCommit, Date, Author
        }
    }   
}
# If no search mode, just show all unique versions
else 
{
    Write-Host ""  # Add spacing
    Write-Host "[INFO] All unique versions found for ${TaskName} (latest first):" -ForegroundColor Cyan
    $table | Format-Table Version, LinkOrCommit, Date, Author
}
