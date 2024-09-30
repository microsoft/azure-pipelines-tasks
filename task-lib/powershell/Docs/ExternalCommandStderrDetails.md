# Details regarding external commands and STDERR

When the agent invokes your task script, by default STDERR from external commands and will not produce an error record. Many programs treat STDERR as an alternate stream. So this behavior is appropriate for many external commands.

This behavior is also consistent with PowerShell.exe (Console Host). Other hosts may differ. For example PowerShell ISE by default converts STDERR from external commands into error records. For this reason, the recommendation is to test your task script using PowerShell.exe.

However, depending upon how the pipelines are manipulated, error records may be produced in some cases.

## These cases do not produce an error record:

When redirection is not applied to the external command. Example:

```PowerShell
& cmd.exe /c nosuchcommand
```

When redirection is applied indirectly to the external command and the output is (naturally or directly) piped to `Out-Default`. Examples:

```PowerShell
. { & cmd.exe /c nosuchcommand } 2>&1
. { & cmd.exe /c nosuchcommand } 2>&1 | Out-Default
```

## These cases produce an error record:

When redirection is applied directly to the external command. Example:

```PowerShell
& cmd.exe /c nosuchcommand 2>&1
```

When redirection is applied indirectly to the external command, and the output is piped to any command before it is (naturally or directly) piped to `Out-Default`. Examples:

```PowerShell
. { & cmd.exe /c nosuchcommand } 2>&1 | Foreach-Object { $_ }
. { & cmd.exe /c nosuchcommand } 2>&1 | Foreach-Object { $_ } | Out-Default
. { & cmd.exe /c nosuchcommand } 2>&1 | Out-Host
```
