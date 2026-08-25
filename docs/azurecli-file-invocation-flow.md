# AzureCLI Task — File Invocation Flow (PR #22279)

## Original behavior (before PR)

All three stages go through CMD, which corrupts special characters.

```
Pipeline YAML
  └─ cmd.exe ─── powershell.exe -Command ". 'script.ps1'"     ← CORRUPTION #1
                     │
                     ├─ az.cmd login --password=Pa%ss^wo!rd    ← CORRUPTION #2
                     │    └─ cmd.exe ─── python.exe (corrupted password)
                     │
                     └─ User script runs:
                          az sql db export -p "Abc^#*!%"       ← CORRUPTION #3
                            └─ cmd.exe ─── python.exe (corrupted args)
```

## Fixed behavior (PR #22279, FF: AzureCliUseFileInvocation)

```
Pipeline YAML
│
├─ - task: AzureCLI@2
│     inlineScript: |
│       az sql db export -p "Abc^#*!%Def"
│
▼
┌──────────────────────────────────────────────────────────────────┐
│ azureclitask.ts                                                  │
│                                                                  │
│ STEP 1 — LOGIN (FIX #2: direct python.exe)                      │
│ ──────────────────────────────────────────                       │
│ Code: azureclitask.ts, loginAzureRM(), line ~377                 │
│                                                                  │
│   if (win32 && FF) {                                             │
│     azPath = tl.which('az')                                      │
│       → "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"│
│     pythonPath = dirname(dirname(azPath)) + '/python.exe'        │
│       → "C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe" │
│                                                                  │
│     tl.execSync(pythonPath,                                      │
│       "-IBm azure.cli login --password=\"Pa%ss^wo!rd\" ...")     │
│   }                                                              │
│                                                                  │
│   Execution:                                                     │
│     python.exe -IBm azure.cli login --password="Pa%ss^wo!rd"    │
│     ✅ No az.cmd, no CMD — password preserved                    │
│                                                                  │
│   Fallback: if python.exe not found → az.cmd login (original)   │
│                                                                  │
│ STEP 2 — SCRIPT GENERATION (FIX #3: function az)                │
│ ────────────────────────────────────────────────                 │
│ Code: Utility.ts, getPowerShellScriptPath(), line ~44            │
│                                                                  │
│   Writes script.ps1 to disk:                                     │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ $ErrorActionPreference = 'stop'                          │   │
│   │ $ErrorView = 'NormalView'                                │   │
│   │ function az {                                            │   │
│   │   $env:AZ_INSTALLER = 'MSI'                             │   │
│   │   & 'C:\...\python.exe' -IBm azure.cli @args            │   │
│   │ }                                                        │   │
│   │ # ── user's inline script below ──                       │   │
│   │ az sql db export -p "Abc^#*!%Def"                        │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ STEP 3 — LAUNCH (FIX #1: -File invocation)                      │
│ ──────────────────────────────────────────                       │
│ Code: ScriptType.ts, getToolWithFileInvocation(), line ~78       │
│                                                                  │
│   powershell.exe -NoLogo -NoProfile -NonInteractive              │
│     -ExecutionPolicy Unrestricted -File script.ps1               │
│   ✅ PowerShell reads file directly — no CMD expansion           │
│                                                                  │
│   Fallback: if tool construction fails →                         │
│     powershell.exe -Command ". 'script.ps1'" (original)          │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ PowerShell session (script.ps1 running via -File)                │
│                                                                  │
│ Under -File, script scope = global scope (top-level process)     │
│                                                                  │
│ ① function az { ... } is defined in global scope                 │
│                                                                  │
│ ② User's code runs:                                              │
│    az sql db export -p "Abc^#*!%Def"                             │
│                                                                  │
│    PowerShell command resolution order:                           │
│      1. Aliases      → none                                      │
│      2. Functions    → FOUND: function az    ← WINS              │
│      3. Cmdlets      → (skipped)                                 │
│      4. Applications → az.cmd (never reached)                    │
│                                                                  │
│    Executes:                                                     │
│      python.exe -IBm azure.cli sql db export -p "Abc^#*!%Def"   │
│    ✅ Args passed directly — no az.cmd, no CMD, no corruption    │
│                                                                  │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│                                                                  │
│ ③ REGRESSION: user's script imports a module                     │
│                                                                  │
│    Import-Module Bluebird                                        │
│      └─ Confirm-InstalledTools                                   │
│           └─ $cmd = Get-Command az                               │
│                │                                                 │
│                ▼                                                 │
│           Resolution: function az wins (priority #2)             │
│           $cmd.CommandType = "Function"                          │
│           $cmd.Source      = ""  ← EMPTY (functions have no path)│
│                │                                                 │
│                ▼                                                 │
│           Module checks:                                         │
│             if ([string]::IsNullOrWhiteSpace($cmd.Source))        │
│               throw "Could not find az in PATH!!"                │
│                                                                  │
│    ❌ MODULE FAILS — function has no .Source property             │
│                                                                  │
│    Root cause: PowerShell functions always rank above             │
│    Applications (az.cmd) in command resolution. Any code         │
│    that checks .Source, .Path, or .CommandType gets the           │
│    function instead of the expected az.cmd executable.            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Summary of each fix

| Fix | File | What it protects | How |
|-----|------|-----------------|-----|
| #1 `-File` invocation | `ScriptType.ts` | Script launch — prevents CMD from expanding the script command line | `powershell.exe -File script.ps1` instead of `-Command ". 'script.ps1'"` |
| #2 Direct python login | `azureclitask.ts` | Service principal password during `az login` | Calls `python.exe -IBm azure.cli login` directly instead of `az.cmd` |
| #3 `function az` wrapper | `Utility.ts` | User's `az` calls inside their script (all arguments) | Injects PowerShell function that routes to `python.exe`, bypassing `az.cmd` |

## Known regression from Fix #3

The `function az` wrapper causes `Get-Command az` to return a Function (CommandType=Function, Source="") instead of the expected Application (CommandType=Application, Source="C:\...\az.cmd"). This breaks any module or script that validates az's presence by checking `.Source` or `.CommandType`.
