# Description: Checks the PowerShell syntax of the script using PSScriptAnalyzer.
param([String]$pathToBuiltTasks)

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

  $module = Get-Module -Name "PSScriptAnalyzer";
  if ($module -eq $null) {
    Write-Host "Installing PSScriptAnalyzer module..."
    Install-Module -Name "PSScriptAnalyzer" -Scope CurrentUser -Force
  }
  
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
  $module = Get-Module -Name "Newtonsoft.Json";
  if ($module -eq $null) {
    Write-Host "Installing Newtonsoft.Json module..."
    Install-Module -Scope CurrentUser -Name "Newtonsoft.Json" -Force
  }

  # Get the tasks which have a PowerShell handler.
  $tasks = Get-ChildItem $pathToBuiltTasks |
    Where-Object -FilterScript {
      (Check-PowershellHandler $_.FullName) -eq $true
    }

  $analyzerResults = Check-Tasks -taskPaths $tasks.FullName;

  return $analyzerResults;
}


$diagnostics = main $pathToBuiltTasks;

if ($diagnostics.Count -gt 0) {
  Write-Host "Found $($diagnostics.Count) diagnostic(s) error in the script."
  $diagnostics | Format-Table -AutoSize
  exit 1;
}

exit 0;