param(
    [Parameter(Mandatory)]
    [string]
    $SourceBranch
)

function Get-PullRequest() {
    return (gh api -X GET repos/:owner/:repo/pulls -F head=":owner:$SourceBranch" -f state=open -f base=master | ConvertFrom-Json)
}

$openedPR=Get-PullRequest

if ($openedPR.html_url.length -ne 0) {
    throw "A PR from $SourceBranch to master already exists."
}

$buildUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
$body = "[Draft] This PR was auto-generated during testing of new notifications. Please ignore this."

gh pr create --base 'TestBranch-for-new-notifications' --head $SourceBranch --title '[Draft] Localization update' --body $body

# Getting a number to the opened PR
$PR_NUMBER = (Get-PullRequest).number
Write-Host "##vso[task.setvariable variable=PR_NUMBER]$PR_NUMBER"

# Getting a link to the opened PR
$PR_LINK = (Get-PullRequest).html_url
Write-Host "##vso[task.setvariable variable=PR_LINK]$PR_LINK"
