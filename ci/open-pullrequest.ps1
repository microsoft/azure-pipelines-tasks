param(
    [Parameter(Mandatory)]
    [string]
    $SourceBranch
)

function Get-PullRequest() {
    $prInfo = (gh api -X GET repos/:owner/:repo/pulls -F head=":owner:$SourceBranch" -f state=open -f base=master | ConvertFrom-Json)
    return $prInfo.html_url
}

$openedPR=Get-PullRequest

if ($openedPR.length -ne 0) {
    throw "A PR from $SourceBranch to master already exists."
}

$buildUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
$body = "This PR was auto-generated with [the localization pipeline build]($buildUrl)."

gh pr create --head $SourceBranch --title 'Localization update' --body $body

# Getting a link to the opened PR
$env:PR_LINK = Get-PullRequest
