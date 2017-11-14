#requires -Module VstsTaskSdk

# VstsTaskSdk is required above for Assert-VstsPath and Get-VstsTaskVariable
# defined in ToolFunctions.ps1 and prefixed by VstsTaskSdk.psd1 which specifies DefaultCommandPrefix = 'Vsts'

# Existing symbol binary layout
#   V1 agent
#   ...\agent\Worker\Tools\Pdbstr\pdbstr.exe
#   ...\agent\Worker\Tools\Symstore\dbghelp.dll
#   ...\agent\Worker\Tools\Symstore\srcsrv.dll
#   ...\agent\Worker\Tools\Symstore\symsrv.dll
#   ...\agent\Worker\Tools\Symstore\symstore.exe
#   V2 agent
#   ...\agent\externals\pdbstr\pdbstr.exe
#   ...\agent\externals\symstore\dbghelp.dll
#   ...\agent\externals\symstore\srcsrv.dll
#   ...\agent\externals\symstore\symsrv.dll
#   ...\agent\externals\symstore\symstore.exe
# New symbol binary layout
#   V1 & V2 agent
#   ...\tasks\PublishSymbols\{Version}\*.dll
#   ...\tasks\PublishSymbols\{Version}\*.exe

# # Ad-hoc test initialization
# node make.js build --task PublishSymbols
# $env:System_Culture = "en-US"
# Import-Module .\_build\Tasks\PublishSymbols\ps_modules\VstsTaskSdk\VstsTaskSdk.psd1
# Import-Module .\_build\Tasks\PublishSymbols\SymbolsCommon.psm1
# Get-Command -Module SymbolsCommon
#
# # Ad-hoc test cleanup
# Remove-Module SymbolsCommon
# Remove-Module VstsTaskSdk
# $env:Agent_HomeDirectory = $null
# $env:PublishSymbols_Debug = $null
# $env:PublishSymbols_UseDbgLkg = $null
# $env:System_Culture = $null
#
# # Ad-hoc test cases
#
# # V2 agent, UseDbgLkg true
# $env:Agent_HomeDirectory = "D:\Downloads\vsts-agent-win7-x64-2.117.1"
# $env:PublishSymbols_Debug = "true"
# $env:PublishSymbols_UseDbgLkg = "true"
# Get-DbghelpPath
# Get-PdbstrPath
# Get-SymStorePath
# 
# # V2 agent, UseDbgLkg false
# $env:Agent_HomeDirectory = "D:\Downloads\vsts-agent-win7-x64-2.117.1"
# $env:PublishSymbols_Debug = "true"
# $env:PublishSymbols_UseDbgLkg = $null
# Get-DbghelpPath
# Get-PdbstrPath
# Get-SymStorePath
# 
# # V1 agent, UseDbgLkg true
# $env:Agent_HomeDirectory = "\\artifactagent1\C$\B"
# $env:PublishSymbols_Debug = "true"
# $env:PublishSymbols_UseDbgLkg = "true"
# Get-DbghelpPath
# Get-PdbstrPath
# Get-SymStorePath
# 
# # V1 agent, UseDbgLkg false
# $env:Agent_HomeDirectory = "\\artifactagent1\C$\B"
# $env:PublishSymbols_Debug = "true"
# $env:PublishSymbols_UseDbgLkg = $null
# Get-DbghelpPath
# Get-PdbstrPath
# Get-SymStorePath

function Get-SymbolBinaryPath
{
    [CmdletBinding()]
    param(
        # Path relative to task script
        [Parameter(Mandatory = $true)]
        [string]$DbgLkgPath,
        # Path relative to Agent.HomeDirectory
        [Parameter(Mandatory = $true)]
        [string]$V2AgentPath,
        # Path relative to Agent.HomeDirectory
        [Parameter(Mandatory = $true)]
        [string]$V1AgentPath
    )

    $useDbgLkg = [System.Convert]::ToBoolean($env:PublishSymbols_UseDbgLkg)
    if($useDbgLkg)
    {
        # Use the latest symbol binaries as specified by variable "PublishSymbols_UseDbgLkg" in the build definition
        $path = [System.IO.Path]::GetFullPath("$PSScriptRoot\$DbgLkgPath")
    }
    else
    {
        # Use existing binaries shipped with the agent
        $agentRoot = Get-VstsTaskVariable -Name Agent.HomeDirectory -Require
        $path = "$agentRoot\$V2AgentPath"
        if (-not [System.IO.File]::Exists($path))
        {
            $path = "$agentRoot\$V1AgentPath"
        }
    }

    $debug = [System.Convert]::ToBoolean($env:PublishSymbols_Debug)
    if ($debug)
    {
        Write-Host "Get-SymbolBinaryPath: $path"
    }

    Assert-VstsPath -LiteralPath $path -PathType Leaf
    return $path
}

function Get-PdbstrPath {
    [CmdletBinding()]
    param()
    return Get-SymbolBinaryPath `
        -DbgLkgPath  "pdbstr.exe" `
        -V2AgentPath "externals\pdbstr\pdbstr.exe" `
        -V1AgentPath "Agent\Worker\Tools\Pdbstr\pdbstr.exe"
}

function Get-DbghelpPath
{
    [CmdletBinding()]
    param()
    return Get-SymbolBinaryPath `
        -DbgLkgPath  "dbghelp.dll" `
        -V2AgentPath "externals\symstore\dbghelp.dll" `
        -V1AgentPath "Agent\Worker\Tools\Symstore\dbghelp.dll"
}

function Get-SymStorePath {
    [CmdletBinding()]
    param()
    return Get-SymbolBinaryPath `
        -DbgLkgPath  "symstore.exe" `
        -V2AgentPath "externals\symstore\symstore.exe" `
        -V1AgentPath "Agent\Worker\Tools\Symstore\symstore.exe"
}

Export-ModuleMember -Function @("Get-PdbstrPath", "Get-DbghelpPath", "Get-SymStorePath")