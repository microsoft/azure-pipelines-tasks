# Send notifications by POST method to MS Teams webhook
# Body of message is compiled as Office 365 connector card
# More details about cards - https://docs.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-reference#office-365-connector-card

$wikiLink = "[Wiki](https://mseng.visualstudio.com/AzureDevOps/_wiki/wikis/AzureDevOps.wiki/25317/Release-of-pipeline-tasks)"

if ($env:PR_ID) {
    $pullRequestLink = "[PR $env:PR_ID]($env:PR_LINK)"
    $title = "Courtesy Bump of Tasks PR created - ID $env:PR_ID"
    $text = "Created Courtesy Bump of Tasks PR. Please review and approve/merge $pullRequestLink. Related article in $wikiLink."
    $themeColor = "#FFFF00"
}
else {
    $pipelineLink = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
    $buildLink = "[ID $($env:BUILD_BUILDID)]($($pipelineLink))"
    $title = "Courtesy push build failed - ID $($env:BUILD_BUILDID)"
    $text = "Failed to create Courtesy Bump of Tasks PR. Please review the results of failed build $buildLink. Related article in $wikiLink."
    $themeColor = "#FF0000"
}

$body = [PSCustomObject]@{
    title = $title
    text = $text
    themeColor = $themeColor
} | ConvertTo-Json

Invoke-RestMethod -Uri $env:TEAMS_WEBHOOK -Method Post -Body $body -ContentType "application/json"
