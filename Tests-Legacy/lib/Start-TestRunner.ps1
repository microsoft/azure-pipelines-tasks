[CmdletBinding()]
param()

# Workaround redirection limitation in PS 4.0. The information pipeline was not added until PS 5.0.
# Redirect all pipelines into the output pipeline.
# Place any caught error record into the output pipeline.
$script:scriptText = @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path)

try {
    Import-Module -Name Microsoft.PowerShell.Management, Microsoft.PowerShell.Utility
    $ErrorActionPreference = 'Stop'
    $VerbosePreference = 'Continue'
    $PSModuleAutoloadingPreference = 'None'
    if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Path does not exist: '$Path'"
    }

    if ($PSVersionTable.PSVersion -lt [version]'5.0') {
        function global:Write-Host {
            $OFS = ' '
            Write-Verbose "Write-Host $args"
        }
    }

    . $Path *>&1
} catch {
    $_
}
'@

function Invoke-Test {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path)

    # Create a new powershell engine with a separate session state.
    $powershell = [powershell]::Create(([initialsessionstate]::CreateDefault2()))
    $null = $powershell.
        AddScript($script:scriptText, $false). # Pass useLocalScope=$false so the script will not be run in a separate scope.
        AddParameter('Path', $Path)
    $powershell.Invoke() |
        ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                Write-Error -ErrorRecord $_ # Write error records to STDERR.
            } else {
                ,$_ # Put all other objects back into the pipeline without unraveling them.
            }
        }
    $powershell.Stop()
    $powershell.Dispose()
}

# Record the original environment variables.
$originalEnv = @{ }
foreach ($envVar in (Get-ChildItem -LiteralPath env:)) {
    $originalEnv[$envVar.Name] = $envVar.Value
}

while ($true) {
    # Prompt for a script to run.
    $path = [System.Console]::ReadLine()

    # Run the script in an isolated session.
    Write-Host "Running: '$path'"
    Invoke-Test -Path $path

    # Cleanup the environment variables.
    $currentMatches = @{ }
    foreach ($envVar in (Get-ChildItem -LiteralPath env:)) {
        # Remove the environment variable if it is new.
        if (!$originalEnv.ContainsKey($envVar.Name)) {
            Remove-Item -LiteralPath $envVar.PSPath
        } elseif ($originalEnv[$envVar.Name] -ceq $envVar.Value) {
            # Otherwise record it if it matches.
            $currentMatches[$envVar.Name] = $envVar.Value
        }
    }

    # Add or update the environment variables that are missing or changed.
    foreach ($key in $originalEnv.Keys) {
        if (!$currentMatches.ContainsKey($key)) {
            Set-Content -LiteralPath "env:$key" -Value "$($originalEnv[$key])"
        }
    }

    # Write a special "end-of-test" message over STDOUT.
    Write-Host '_END_OF_TEST_ce10a77a_'
}
