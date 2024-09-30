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

# VstsTaskSdk.dll contains the TerminationException and NativeMethods for handle long path
# We used to do inline C# in this powershell module
# However when csc compile the inline C#, it will hit process env block size limit since it's not use unicode to encode env
# To solve the env block size problem, we choose to put all inline C# into an assembly VstsTaskSdk.dll, signing it, package with the PS modules.
Write-Verbose "Loading compiled helper $PSScriptRoot\VstsTaskSdk.dll."
Add-Type -LiteralPath $PSScriptRoot\VstsTaskSdk.dll

# Import/export functions.
. "$PSScriptRoot\FindFunctions.ps1"
. "$PSScriptRoot\InputFunctions.ps1"
. "$PSScriptRoot\LegacyFindFunctions.ps1"
. "$PSScriptRoot\LocalizationFunctions.ps1"
. "$PSScriptRoot\LoggingCommandFunctions.ps1"
. "$PSScriptRoot\LongPathFunctions.ps1"
. "$PSScriptRoot\ServerOMFunctions.ps1"
. "$PSScriptRoot\ToolFunctions.ps1"
. "$PSScriptRoot\TraceFunctions.ps1"
. "$PSScriptRoot\OutFunctions.ps1" # Load the out functions after all of the other functions are loaded.
Export-ModuleMember -Function @(
        # Find functions.
        'Find-Match'
        'New-FindOptions'
        'New-MatchOptions'
        'Select-Match'
        # Input functions.
        'Get-Endpoint'
        'Get-SecureFileTicket'
        'Get-SecureFileName'
        'Get-Input'
        'Get-TaskVariable'
        'Get-TaskVariableInfo'
        'Set-TaskVariable'
        'Get-PipelineFeature'
        # Legacy find functions.
        'Find-Files'
        # Localization functions.
        'Get-LocString'
        'Import-LocStrings'
        # Logging command functions.
        'Write-AddAttachment'
        'Write-AddBuildTag'
        'Write-AssociateArtifact'
        'Write-LogDetail'
        'Write-LoggingCommand'
        'Write-PrependPath'
        'Write-SetEndpoint'
        'Write-SetProgress'
        'Write-SetResult'
        'Write-SetSecret'
        'Write-SetVariable'
        'Write-TaskDebug'
        'Write-TaskError'
        'Write-TaskVerbose'
        'Write-TaskWarning'
        'Write-UpdateBuildNumber'
        'Write-UpdateReleaseName'
        'Write-UploadArtifact'
        'Write-UploadBuildLog'
        'Write-UploadFile'
        'Write-UploadSummary'
        # Out functions.
        'Out-Default'
        # Server OM functions.
        'Get-AssemblyReference'
        'Get-TfsClientCredentials'
        'Get-TfsService'
        'Get-VssCredentials'
        'Get-VssHttpClient'
        # Tool functions.
        'Assert-Agent'
        'Assert-Path'
        'Invoke-Tool'
        'Invoke-Process'
        # Trace functions.
        'Trace-EnteringInvocation'
        'Trace-LeavingInvocation'
        'Trace-Path'
        # Proxy functions
        'Get-WebProxy'
        # Client cert functions
        'Get-ClientCertificate'
    )

$IssueAuditActions = @{
    Unknown              = '0'
    ShellTasksValidation = '1'
}

Export-ModuleMember -Variable @(
    'IssueSources'
    $IssueAuditActions
)

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
        $global:__vstsNoOverrideVerbose = ''
        Write-Verbose "Task script terminated." 4>&1 | Out-Default
    } catch {
        $global:__vstsNoOverrideVerbose = ''
        Write-Verbose "Caught exception from task script." 4>&1 | Out-Default
        $_ | Out-Default
        Write-Host "##vso[task.complete result=Failed]"
    }
'@))
