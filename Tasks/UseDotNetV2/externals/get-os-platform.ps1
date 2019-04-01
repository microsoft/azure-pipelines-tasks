function Get-Machine-Architecture()
{
    # possible values: AMD64, IA64, x86
    return $ENV:PROCESSOR_ARCHITECTURE
}

function Get-CLIArchitecture-From-Architecture([string]$Architecture)
{
    switch ($Architecture.ToLower())
    {
        { ($_ -eq "amd64") -or ($_ -eq "x64") } { return "x64" }
        { $_ -eq "x86" } { return "x86" }
        default { throw "Architecture not supported. If you think this is a bug, please report it at https://github.com/dotnet/cli/issues" }
    }
}

$CLIArchitecture = Get-CLIArchitecture-From-Architecture $(Get-Machine-Architecture)
Write-Output "Primary:win-$CLIArchitecture"