$ErrorActionPreference='Stop'
$m=[version]'2.115.0'
if (([version]$env:AGENT_VERSION) -lt $m) { throw "Min agent $m" }
$v='5.10.1'
$d="$env:AGENT_TOOLSDIRECTORY\node\$v\x64"
$c="$d.complete"
$u="https://nodejs.org/dist/v5.10.1/win-x64/node"
if (!(Test-Path $c)) {
    "rm $d"
    ri $d -rec -for -ea 0
    md $d
    "downloading"
    $w=New-Object System.Net.WebClient
    $w.DownloadFile("$u.exe", "$d\node.exe")
    $w.DownloadFile("$u.lib", "$d\node.lib")
    New-Item $c -Type File
}
"##vso[task.prependpath]$d"
