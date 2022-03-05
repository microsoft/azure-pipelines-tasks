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
    #    $titleText,
        [Parameter(Mandatory = $true)]
        [string]$messageText,
    #    $messageText,
        [Parameter(Mandatory = $true)]
        [string]$themeColor
    #    $themeColor
    )
    
    $titleText
    $titleText.GetType()
    $messageText
    $messageText.GetType()
    $themeColor
    $themeColor.GetType()

    $body = [PSCustomObject]@{
        title = $titleText
        text = $messageText
        themeColor = $themeColor
    } | ConvertTo-Json
    
    #Invoke-RestMethod -Uri $($MSTeamsUri) -Method Post -Body $body -ContentType 'application/json'
    Invoke-RestMethod -Uri $($env:TEAMS_WEBHOOK) -Method Post -Body $body -ContentType 'application/json' 
}

$wikiLink = "[Wiki](https://mseng.visualstudio.com/AzureDevOps/_wiki/wikis/AzureDevOps.wiki/25317/Release-of-pipeline-tasks)"

if ($IsPRCreated) {
    $pullRequestLink = "[PR $($env:PrID)]($($env:PrLink))"
    $titleText = ("Courtesy Bump of Tasks PR created - ID $($env:PrID)").ToString()
    $messageText = ("Created Courtesy Bump of Tasks PR. Please review and approve/merge $pullRequestLink. Related article in $wikiLink.").ToString()
    $themeColor = ("#FFFF00").ToString()
}
else {
    $pipelineLink = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI$env:SYSTEM_TEAMPROJECT/_build/results?buildId=$env:BUILD_BUILDID&_a=summary"
    $buildLink = "[ID $($env:BUILD_BUILDID)]($($pipelineLink))"
    $titleText = ("Courtesy push build failed - ID $($env:BUILD_BUILDID)").ToString()
    $messageText = ("Failed to create Courtesy Bump of Tasks PR. Please review the results of failed build $buildLink. Related article in $wikiLink.").ToString()
    $themeColor = ("#FF0000").ToString()
}

$titleText = ("JustTitleText").ToString()
$messageText = ("JustMessageText").ToString()
$themeColor = ("JustColor").ToString()

$titleText
$titleText.GetType()
$messageText
$messageText.GetType()
$themeColor
$themeColor.GetType()
Send-Notification -titleText $titleText -messageText $messageText -themeColor $themeColor
