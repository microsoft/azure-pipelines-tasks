param(
    [Parameter(Mandatory)]
    [string]
    $SourceBranch
)

# Getting a created PR. Result object has interface in accordance with article https://docs.github.com/en/rest/reference/pulls#get-a-pull-request
function Get-PullRequest() {
    return (gh api -X GET repos/:owner/:repo/pulls -F head=":owner:$SourceBranch" -f state=open -f base=master | ConvertFrom-Json)
}

$openedPR=Get-PullRequest

if ($openedPR.html_url.length -ne 0) {
    throw "A PR from $SourceBranch to master already exists."
}

$buildUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
$body = "This is TEST PR was auto-generated. Please ignore this."

gh pr create --base 'users/denis-tikhomirov/issue2123-loc' --head $SourceBranch --title 'DRAFT Localization update' --body $body --draft

# Getting a number to the opened PR
$PR_NUMBER = (Get-PullRequest).number
Write-Host "##vso[task.setvariable variable=PR_NUMBER]$PR_NUMBER"

# Getting a link to the opened PR
$PR_LINK = (Get-PullRequest).html_url
Write-Host "##vso[task.setvariable variable=PR_LINK]$PR_LINK"
