# Errors, warnings, and task result

## Error/Warning pipelines

Messages written to the error pipeline (`Write-Error`) are written as error logging commands. For example,

```PowerShell
Write-Error 'Something went wrong'
```

will be written over STDOUT as an instruction to the agent:
```
##vso[task.logissue type=error]Something went wrong
```

The agent will intercept the output and create an error issue asssociated with the task.

Likewise, messages written to the warning pipeline (`Write-Warning`) instruct the agent to create a warning issue.

## Default $ErrorActionPreference and outer catch handler

The `$ErrorActionPreference` is globally set to `'Stop'` when the agent runs your script.

This will cause error records written to the error pipeline (`Write-Error`) to be terminating errors, and an exception will be thrown.

The agent runs your script within a try/catch block. If an exception bubbles to the outer catch handler, the catch handler will create an error issue associated with your task, and set the task result to failed.

## Overriding $ErrorActionPreference (error issue != task failure)

Alternatively, the global error action preference can be overidden by your task script. For example, `$global:ErrorActionPreference = 'Continue'`.

With an error action preference of `'Continue'`, error records will still be logged as error issues. However, the task result will not automatically be set to failed.

Error issues are not tightly coupled with task result. This enables scenarios where errors issues can be logged, but the task ultimately succeeds (e.g. best effort scenarios).

## External commands and STDERR

When your task script is run by the agent, STDERR from external commands will not produce error records.

This is consistent with PowerShell.exe.

Note, depending on how the pipelines are manipulated, error records may be produced in some cases. [Details here](ExternalCommandStderrDetails.md).
