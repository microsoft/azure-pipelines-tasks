# Determine current sprint.
$currentSprint = (Invoke-WebRequest https://whatsprintis.it -Headers @{"Accept" = "application/json" } | ConvertFrom-Json)

$sprint = $currentSprint.sprint
$week = $currentSprint.week

if ($sprint -notmatch "^\d{3}$") {
    throw "Sprint must be a three-digit number; received: $sprint"
} 
if ($week -notmatch "^[123]$") {
    throw "Week must be a number 1, 2 or 3; received: $week"
}

Write-Host "Current sprint: $sprint"
Write-Host "##vso[task.setVariable variable=currentSprint]$sprint"
Write-Host "Current sprint week: $week"
Write-Host "##vso[task.setVariable variable=currentSprintWeek]$week"
