function Get-Machine-Architecture() {
    Say-Invocation $MyInvocation

    # On PS x86, PROCESSOR_ARCHITECTURE reports x86 even on x64 systems.
    # To get the correct architecture, we need to use PROCESSOR_ARCHITEW6432.
    # PS x64 doesn't define this, so we fall back to PROCESSOR_ARCHITECTURE.
    # Possible values: amd64, x64, x86, arm64, arm
    if( $ENV:PROCESSOR_ARCHITEW6432 -ne $null ) {
        return $ENV:PROCESSOR_ARCHITEW6432
    }

    try {        
        if( ((Get-CimInstance -ClassName CIM_OperatingSystem).OSArchitecture) -like "ARM*") {
            if( [Environment]::Is64BitOperatingSystem )
            {
                return "arm64"
            }  
            return "arm"
        }
    }
    catch {
        # Machine doesn't support Get-CimInstance
    }

    return $ENV:PROCESSOR_ARCHITECTURE
}

function Get-CLIArchitecture-From-Architecture([string]$Architecture) {
    Say-Invocation $MyInvocation

    if ($Architecture -eq "<auto>") {
        $Architecture = Get-Machine-Architecture
    }

    switch ($Architecture.ToLowerInvariant()) {
        { ($_ -eq "amd64") -or ($_ -eq "x64") } { return "x64" }
        { $_ -eq "x86" } { return "x86" }
        { $_ -eq "arm" } { return "arm" }
        { $_ -eq "arm64" } { return "arm64" }
        default { throw "Architecture '$Architecture' not supported. If you think this is a bug, report it at https://github.com/dotnet/install-scripts/issues" }
    }
}

$CLIArchitecture = Get-CLIArchitecture-From-Architecture $(Get-Machine-Architecture)
Write-Output "Primary:win-$CLIArchitecture"