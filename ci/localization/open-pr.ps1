function Get-PullRequest() {
    $prInfo = (gh api -X GET repos/:owner/:repo/pulls -F head=":owner:$(git branch --show-current)" -f state=open -f base=master | ConvertFrom-Json)
    return $prInfo.html_url
}

if (Get-PullRequest.length -ne 0) {
    throw 'A PR from Localization branch to master already exists.'
}

$buildUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
$body = "This PR was auto-generated with [the localization pipeline build]($buildUrl)."

gh pr create --title 'Localization update' --body $body

# Getting a link to the opened PR
$env:PR_LINK = Get-PullRequest