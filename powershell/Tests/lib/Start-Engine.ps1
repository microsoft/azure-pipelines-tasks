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
foreach ($key in ([Environment]::GetEnvironmentVariables()).Keys) {
    if (!$originalEnv.ContainsKey($key)) {
        $value = [Environment]::GetEnvironmentVariable($key)
        $originalEnv[$key] = "$value"
    } else {
        # NPM on Windows is somehow able to create a duplicate environment variable cased differently.
        # For example, if the environment variable NPM_CONFIG_CACHE is defined, npm test is somehow able
        # to create a duplicate variable npm_config_cache. This causes powershell to error "An item with
        # the same key has already been added" when attempting to: Get-ChildItem -LiteralPath env:
        Write-Host "Squashing duplicate environment variable: $key"
        [Environment]::SetEnvironmentVariable($key, $null)
        [Environment]::SetEnvironmentVariable($key, $originalEnv[$key])
    }
}

while ($true) {
    # Prompt for a script to run.
    $path = [System.Console]::ReadLine()

    # Run the script in an isolated session.
    Write-Host "Running: '$path'"
    Invoke-Test -Path $path

    # Cleanup the environment variables.
    $currentMatches = @{ }
    foreach ($key in ([Environment]::GetEnvironmentVariables().Keys)) {
        $value = [Environment]::GetEnvironmentVariable($key)

        # Remove the environment variable if it is new.
        if (!$originalEnv.ContainsKey($key)) {
            [Environment]::SetEnvironmentVariable($key, $null)
        } elseif ($originalEnv[$key] -ceq $value) {
            # Otherwise record it if it matches.
            $currentMatches[$key] = $true
        }
    }

    # Add or update the environment variables that are missing or changed.
    foreach ($key in $originalEnv.Keys) {
        if (!$currentMatches.ContainsKey($key)) {
            [Environment]::SetEnvironmentVariable($key, $originalEnv[$key])
        }
    }

    # Write a special "end-of-test" message over STDOUT.
    Write-Host '_END_OF_TEST_ce10a77a_'
    [Console]::Out.Flush()
}
