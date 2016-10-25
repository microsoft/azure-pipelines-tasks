[CmdletBinding()]
param(
    [ValidateNotNull()]
    [Parameter()]
    [hashtable]$ModuleParameters = @{ })

if ($host.Name -ne 'ConsoleHost') {
    Write-Warning "VstsTaskSdk is designed for use with powershell.exe (ConsoleHost). Output may be different when used with other hosts."
}

# Private module variables.
[bool]$script:nonInteractive = "$($ModuleParameters['NonInteractive'])" -eq 'true'
Write-Verbose "NonInteractive: $script:nonInteractive"

# Import/export functions.
. "$PSScriptRoot\FindFunctions.ps1"
. "$PSScriptRoot\InputFunctions.ps1"
. "$PSScriptRoot\LocalizationFunctions.ps1"
. "$PSScriptRoot\LoggingCommandFunctions.ps1"
. "$PSScriptRoot\LongPathFunctions.ps1"
. "$PSScriptRoot\ServerOMFunctions.ps1"
. "$PSScriptRoot\ToolFunctions.ps1"
. "$PSScriptRoot\TraceFunctions.ps1"
. "$PSScriptRoot\OutFunctions.ps1" # Load the out functions after all of the other functions are loaded.
Export-ModuleMember -Function @(
        # Find functions.
        'Find-Files'
        # Input functions.
        'Get-Endpoint'
        'Get-Input'
        'Get-TaskVariable'
        'Get-TaskVariableInfo'
        'Set-TaskVariable'
        # Localization functions.
        'Get-LocString'
        'Import-LocStrings'
        # Logging command functions.
        'Write-AddAttachment'
        'Write-AddBuildTag'
        'Write-AssociateArtifact'
        'Write-LogDetail'
        'Write-SetProgress'
        'Write-SetResult'
        'Write-SetSecret'
        'Write-SetVariable'
        'Write-TaskDebug'
        'Write-TaskError'
        'Write-TaskVerbose'
        'Write-TaskWarning'
        'Write-UpdateBuildNumber'
        'Write-UploadArtifact'
        'Write-UploadBuildLog'
        # Out functions.
        'Out-Default'
        # Server OM functions.
        'Get-AssemblyReference'
        'Get-TfsClientCredentials'
        'Get-TfsService'
        'Get-VssCredentials'
        'Get-VssHttpClient'
        # Tool functions.
        'Assert-Path'
        'Invoke-Tool'
        # Trace functions.
        'Trace-EnteringInvocation'
        'Trace-LeavingInvocation'
        'Trace-Path'
    )

# Special internal exception type to control the flow. Not currently intended
# for public usage and subject to change. If the type has already
# been loaded once, then it is not loaded again.
Write-Verbose "Adding exceptions types."
Add-Type -WarningAction SilentlyContinue -Debug:$false -TypeDefinition @'
namespace VstsTaskSdk
{
    public class TerminationException : System.Exception
    {
        public TerminationException(System.String message) : base(message) { }
    }
}
'@

# Override Out-Default globally.
$null = New-Item -Force -Path "function:\global:Out-Default" -Value (Get-Command -CommandType Function -Name Out-Default -ListImported)
New-Alias -Name Out-Default -Value "global:Out-Default" -Scope global

# Perform some initialization in a script block to enable merging the pipelines.
$scriptText = @"
# Load the SDK resource strings.
Import-LocStrings "$PSScriptRoot\lib.json"

# Load the module that contains ConvertTo-SecureString.
if (!(Get-Module -Name Microsoft.PowerShell.Security)) {
    Write-Verbose "Importing the module 'Microsoft.PowerShell.Security'."
    Import-Module -Name Microsoft.PowerShell.Security 2>&1 |
        ForEach-Object {
            if (`$_ -is [System.Management.Automation.ErrorRecord]) {
                Write-Verbose `$_.Exception.Message
            } else {
                ,`$_
            }
        }
}
"@
. ([scriptblock]::Create($scriptText)) 2>&1 3>&1 4>&1 5>&1 | Out-Default

# Create Invoke-VstsTaskScript in a special way so it is not bound to the module.
# Otherwise calling the task script block would run within the module context.
#
# An alternative way to solve the problem is to close the script block (i.e. closure).
# However, that introduces a different problem. Closed script blocks are created within
# a dynamic module. Each module gets it's own session state separate from the global
# session state. When running in a regular script context, Import-Module calls import
# the target module into the global session state. When running in a module context,
# Import-Module calls import the target module into the caller module's session state.
#
# The goal of a task may include executing ad-hoc scripts. Therefore, task scripts
# should run in regular script context. The end user specifying an ad-hoc script expects
# the module import rules to be consistent with the default behavior (i.e. imported
# into the global session state).
$null = New-Item -Force -Path "function:\global:Invoke-VstsTaskScript" -Value ([scriptblock]::Create(@'
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock)

    try {
        $global:ErrorActionPreference = 'Stop'

        # Initialize the environment.
        $vstsModule = Get-Module -Name VstsTaskSdk
        Write-Verbose "$($vstsModule.Name) $($vstsModule.Version) commit $($vstsModule.PrivateData.PSData.CommitHash)" 4>&1 | Out-Default
        & $vstsModule Initialize-Inputs 4>&1 | Out-Default

        # Remove the local variable before calling the user's script.
        Remove-Variable -Name vstsModule

        # Call the user's script.
        $ScriptBlock |
            ForEach-Object {
                # Remove the scriptblock variable before calling it.
                Remove-Variable -Name ScriptBlock
                & $_ 2>&1 3>&1 4>&1 5>&1 | Out-Default
            }
    } catch [VstsTaskSdk.TerminationException] {
        # Special internal exception type to control the flow. Not currently intended
        # for public usage and subject to change.
        Write-Verbose "Task script terminated." 4>&1 | Out-Default
    } catch {
        Write-Verbose "Caught exception from task script." 4>&1 | Out-Default
        $_ | Out-Default
        Write-Host "##vso[task.complete result=Failed]"
    }
'@))
