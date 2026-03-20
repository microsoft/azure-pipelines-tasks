
$taskMarkdown = Join-Path $PSScriptRoot "Tasks.md"

@"
# Task List
Here's some tasks...

| Name  | Version | Id  | Readme | Help |
|-------|---------|-----|--------|------|
|a<br/><br/>b|cd|ef|gh|ij|
"@ | Set-Content $taskMarkdown

$tasks = Get-ChildItem -Path $PSScriptRoot\Tasks\ -Recurse -Filter task.json
$tasks | ForEach-Object {
    Write-Host $_.FullName
    $folder = Split-Path -Parent $_.FullName
    $task = Get-Content $_.FullName | ConvertFrom-Json
    $version = "$($task.Version.Major).$($task.Version.Minor).$($task.Version.Patch)"
    $readme = Join-Path $folder "README.md"
    if (Test-Path $readme) {
        $readme = "[ReadMe]($(Resolve-Path $readme -Relative))"
    } else {
        $readme = ""
    }
     #| Resolve-Path -Relative -RelativeBasePath $PSScriptRoot
    $row = ($task.Name, $version, $task.Id, $readme, $task.helpMarkDown) -join " | "

    "| $row |"
} | Add-Content $taskMarkdown

@"

And there you go
"@ | Add-Content $taskMarkdown