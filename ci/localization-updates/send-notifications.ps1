param(
    [Parameter(Mandatory = $true)]
    [bool]$IsPRCreated,
    [Parameter(Mandatory = $true)]
    [string]$RepoName
)

# Function sends Office 365 connector card to webhook.
# It requires title and message text displyed in card and theme color used to hignlight card.
function Send-Notification {
    param (
        [Parameter(Mandatory = $true)]
        [string]$titleText,
        [Parameter(Mandatory = $true)]
        [string]$messageText,
        [Parameter(Mandatory = $true)]
        [string]$themeColor
    )

    $body = [PSCustomObject]@{
        title = $titleText
        text = $messageText
        themeColor = $themeColor
    } | ConvertTo-Json

    Invoke-RestMethod -Uri $($env:TEAMS_WEBHOOK) -Method Post -Body $body -ContentType 'application/json' 
}

$wikiLink = "[Wiki](https://mseng.visualstudio.com/AzureDevOps/_wiki/wikis/AzureDevOps.wiki/16150/Localization-update)"

if ($IsPRCreated) {
    $pullRequestLink = "[PR $($env:PR_NUMBER)]($($env:PR_LINK))"
    $titleText = "Azure Pipelines $RepoName Localization update PR created - ID $($env:PR_NUMBER)"
    $messageText = "Created $RepoName Localization update PR. Please review and approve/merge $pullRequestLink. Related article in $wikiLink."
    $themeColor = "#FFFF00"
}
else {
    $buildUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$($env:BUILD_BUILDID)&_a=summary"
    $buildLink = "[ID $($env:BUILD_BUILDID)]($($buildUrl))"
    $titleText = "Azure Pipelines $RepoName Localization build failed - ID $($env:BUILD_BUILDID)"
    $messageText = "Failed to create $RepoName Localization update PR. Please review the results of failed build $buildLink. Related article in $wikiLink."
    $themeColor = "#FF0000"
}

Send-Notification -titleText $titleText -messageText $messageText -themeColor $themeColor
