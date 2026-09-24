# Description: Checks the PowerShell syntax of the script using PSScriptAnalyzer.
param([String]$pathToBuiltTasks)

# Install helper modules from the public Azure DevOps Artifacts feed using
# PSResourceGet. The feed proxies PowerShell Gallery packages and only exposes versions
# already saved to the feed, so an unpinned install resolves to the latest saved version.
$AdoFeedName = "PipelineTools_PublicPackages"
$AdoFeedSource = "https://pkgs.dev.azure.com/mseng/PipelineTools/_packaging/PipelineTools_PublicPackages/nuget/v3/index.json"
$AdoFeedRegistered = $false

function Register-AdoFeed() {
  if (-not $script:AdoFeedRegistered) {
    Write-Host "Registering PSResourceRepository '$AdoFeedName'..."
    $null = Register-PSResourceRepository -Name $AdoFeedName -Uri $AdoFeedSource -Trusted -Force
    $script:AdoFeedRegistered = $true
  }
}

function Import-AdoModule() {
  param (
    [Parameter(Mandatory = $true)]
    [String]$name
  )

  if (Get-Module -Name $name) {
    return
  }

  $module = Get-Module -Name $name -ListAvailable |
    Sort-Object Version -Descending |
    Select-Object -First 1

  if ($null -eq $module) {
    Write-Host "Installing $name module from $AdoFeedName..."
    Register-AdoFeed
    $null = Install-PSResource -Name $name -Repository $AdoFeedName -Scope CurrentUser -TrustRepository -Quiet
    $module = Get-Module -Name $name -ListAvailable |
      Sort-Object Version -Descending |
      Select-Object -First 1
  }

  if ($null -eq $module) {
    throw "Module '$name' was not available after installation from '$AdoFeedName'."
  }

  Import-Module -Name $module.Path -Force
}

function Get-AnalyzerSettings() {
  return @{
    Severity=@('Error', 'Warning', 'Information', 'ParseError', 'ParseWarning')
    IncludeRules=@('PSUseCompatibleSyntax')
    Rules = @{
        PSUseCompatibleSyntax = @{
            # This turns the rule on (setting it to false will turn it off)
            Enable = $true
  
            # List the targeted versions of PowerShell here
            TargetVersions = @(
                '3.0',
                '4.0',
                '5.1',
                '6.2',
                '7.0'
            )
        }
    }
  }
}

function Invoke-AnalyzerToTask() {
  param (
    [Parameter(Mandatory = $true)]
    [String]$taskPath
  )

  if (-Not (Test-Path -Path $taskPath)) {
    Write-Host "Task file not found: $taskPath"
    exit 1
  }

  Import-AdoModule -Name "PSScriptAnalyzer"
  
  Write-Host "Running PSScriptAnalyzer for $taskPath."
  $settings = Get-AnalyzerSettings;

  $analyzerResult = Invoke-ScriptAnalyzer -Path $taskPath -Settings $settings;

  return $analyzerResult;
}

function Check-Tasks() {
  param (
    [Parameter(Mandatory = $true)]
    [String[]]$taskPaths
  )

  $analyzerResults = @();

  for ($i = 0; $i -lt $taskPaths.Length; $i++) {
    $analyzerResults += Invoke-AnalyzerToTask -taskPath $taskPaths[$i]; 
  }

  return $analyzerResults;
}

function Check-PowershellHandler() {
  param (
    [Parameter(Mandatory = $true)]
    [String]$pathToTaskFolder
  )

  $taskJsonPath = Get-ChildItem $pathToTaskFolder |
    Where-Object -FilterScript {
      $_.Name -eq "task.json"
    };
  
  if ($taskJsonPath -eq $null) {
    Write-Host "Task.json not found in $pathToTaskFolder";
    return $false;
  }

  # ToLower used to avoit duplicate keys
  $content = (Get-Content -Raw $taskJsonPath.FullName).ToLower() | ConvertFrom-JsonNewtonsoft;
  $executors = @('execution', 'prejobexecution', 'postjobexecution');

  foreach ($executor in $executors) {
    if ($content.$executor -ne $null) {
      $handlers = $content.$executor

      foreach ($handler in $handlers.Keys) {
        if ($handler -like "*powershell*") {
          return $true;
        }
      }
    }
  }

  return $false;
}

function main() {
  param ([String]$pathToBuiltTasks)

  # Install newtonsoft json to handler json object which has empty keys.
  # https://github.com/PowerShell/PowerShell/issues/1755
  Import-AdoModule -Name "Newtonsoft.Json"

  # Get the tasks which have a PowerShell handler.
  $tasks = Get-ChildItem $pathToBuiltTasks |
    Where-Object -FilterScript {
      (Check-PowershellHandler $_.FullName) -eq $true
    }

  if ($tasks.Count -eq 0) {
    Write-Host "No PowerShell handler found in the tasks."
    exit 0;
  }

  $analyzerResults = Check-Tasks -taskPaths $tasks.FullName;

  return $analyzerResults;
}


$diagnostics = main $pathToBuiltTasks;

# Keep only genuine analyzer results. Module setup can emit stray objects onto the
# success stream which would otherwise be counted as phantom "diagnostics".
# A real PSScriptAnalyzer result is a DiagnosticRecord, which always exposes a RuleName.
$diagnostics = @($diagnostics | Where-Object { $null -ne $_ -and $null -ne $_.PSObject.Properties['RuleName'] });

if ($diagnostics.Count -gt 0) {
  Write-Host "Found $($diagnostics.Count) diagnostic(s) error in the script."
  $diagnostics | Format-Table -AutoSize
  exit 1;
}

exit 0;