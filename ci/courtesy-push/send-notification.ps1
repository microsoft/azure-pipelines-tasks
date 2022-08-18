param(
    [Parameter(Mandatory = $true)]
    [bool]$IsPRCreated
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

$wikiLink = "[Wiki](https://mseng.visualstudio.com/AzureDevOps/_wiki/wikis/AzureDevOps.wiki/25317/Release-of-pipeline-tasks)"

if ($IsPRCreated) {
    $pullRequestLink = "[PR $($env:PrID)]($($env:PrLink))"
    $titleText = "Courtesy Bump of Tasks PR created - ID $($env:PrID)"
    $messageText = "Created Courtesy Bump of Tasks PR. Please review and approve/merge $pullRequestLink. Related article in $wikiLink."
    $themeColor = "#FFFF00"
}
else {
    $pipelineLink = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
    $buildLink = "[ID $($env:BUILD_BUILDID)]($($pipelineLink))"
    $titleText = "Courtesy push build failed - ID $($env:BUILD_BUILDID)"
    $messageText = "Failed to create Courtesy Bump of Tasks PR. Please review the results of failed build $buildLink. Related article in $wikiLink."
    $themeColor = "#FF0000"
}

Send-Notification -titleText $titleText -messageText $messageText -themeColor $themeColor
