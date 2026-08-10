// Reuses the work-item-75787 argument sanitizer used by BashV3 and the
// PowerShell ArgumentsSanitizer. Three feature flags drive behavior:
//   AZP_75787_ENABLE_NEW_LOGIC      -> throw on disallowed characters
//   AZP_75787_ENABLE_NEW_LOGIC_LOG  -> warn on disallowed characters (audit)
//   AZP_75787_ENABLE_COLLECT        -> emit telemetry only
//
// The sanitizer is dispatched per scriptType so that allowlists and pre-
// expansion match the target shell the custom script runs in on the VMSS:
//   * bash         -> BashV3 allowlist (a-zA-Z0-9 _'"-=/:.*+%) and $VAR /
//                     ${VAR} expansion of process env (catches value-
//                     injected secrets like VAR=";rm -rf /").
//   * pscore / ps  -> PowerShellV2 allowlist (adds \n , ~ ? # and backtick
//                     escaping, plus $true/$false via lookahead) and
//                     $env:VAR / ${env:VAR} expansion. The allowlist also
//                     accepts the PowerShell *data* constructors `@ { } [ ]`
//                     (hashtable, splatting, array, indexing). The execution
//                     primitives that turn data into code (`$( )`, `;`, `&`,
//                     `|`, `` ` `` outside the escape position) remain blocked.

import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
import { IssueSource } from 'azure-pipelines-task-lib/internal';

export class ArgsSanitizingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ArgsSanitizingError';
    }
}

// Outer gate (`EnableVmssCustomScriptArgsValidation`, default OFF) decides
// whether the sanitizer runs at all. When it runs, every exception thrown by
// the validator (intentional `ArgsSanitizingError` blocks as well as
// unexpected errors) is reported as an `ArgsValidationFailure` telemetry event
// and then rethrown so the task fails.
export function tryValidateScriptArgs(
    inputArguments: string,
    scriptType: string,
    validator: (args: string, type: string) => void = validateScriptArgs
): void {
    if (!tl.getPipelineFeature('EnableVmssCustomScriptArgsValidation')) {
        return;
    }
    try {
        validator(inputArguments, scriptType);
    } catch (err) {
        const e = err as { name?: string; message?: string };
        tl.debug(`validateScriptArgs threw: ${e?.message ?? err}`);
        try {
            emitTelemetry('TaskHub', 'AzureVmssDeploymentV0', {
                event: 'ArgsValidationFailure',
                scriptType: (scriptType || 'unknown').toLowerCase(),
                errorName: e?.name ?? 'Unknown',
                errorMessage: e?.message ?? String(err)
            });
        } catch (telemetryErr) {
            tl.debug(`Failed to emit ArgsValidationFailure telemetry: ${telemetryErr}`);
        }
        throw err;
    }
}

export function validateScriptArgs(inputArguments: string, scriptType: string): void {
    const featureFlags = {
        audit: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC_LOG'),
        activate: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC'),
        telemetry: tl.getBoolFeatureFlag('AZP_75787_ENABLE_COLLECT')
    };

    if (!(featureFlags.activate || featureFlags.audit || featureFlags.telemetry)) {
        return;
    }

    if (!inputArguments) {
        return;
    }

    tl.debug('Validating script args...');

    const normalizedScriptType = (scriptType || '').toLowerCase();
    const isPowerShell = normalizedScriptType === 'pscore' || normalizedScriptType === 'ps';

    // No env expansion: the custom script runs on the remote VMSS VM, so expanding $env:/$VAR
    // against the agent's environment is the wrong context and only risks false-positive blocks.
    // The allowlist below still blocks separator/metacharacter injection on the literal args.
    const envTelemetry = null;

    const [sanitizedArgs, sanitizerTelemetry] = isPowerShell
        ? sanitizeArgs(inputArguments, {
            // PowerShell allowlist: word chars + \ ` _ ' " - = / : . * , + ~ ? % #
            // plus the data constructors @ { } [ ] (hashtable, splatting, array, indexing).
            // Backtick is PowerShell's escape symbol; (?!true|false) lets $True / $false pass.
            // CR/LF are rejected: at the Invoke-Expression sink LF is a statement separator (WI-75787).
            // Execution primitives $( ) ; & | remain blocked.
            argsSplitSymbols: '``',
            saniziteRegExp: new RegExp("(?<!`)([^\\w\\\\` _'\"\\-=\\/:\\.*,+~?%#@{}\\[\\]])(?!true|false)", 'ig')
        })
        : sanitizeArgs(inputArguments, {
            // BashV3 allowlist (also used for batch and unknown scriptType).
            argsSplitSymbols: '\\\\',
            saniziteRegExp: new RegExp("(?<!\\\\)([^a-zA-Z0-9\\\\ _'\"\\-=\\/:.*+%])", 'g')
        });

    if (sanitizedArgs === inputArguments) {
        return;
    }

    if (featureFlags.telemetry && (sanitizerTelemetry || envTelemetry)) {
        const telemetry = {
            scriptType: normalizedScriptType || 'unknown',
            ...(envTelemetry ?? {}),
            ...(sanitizerTelemetry ?? {})
        };
        try {
            emitTelemetry('TaskHub', 'AzureVmssDeploymentV0', telemetry);
        } catch (e) {
            tl.debug(`Failed to emit script-args sanitizer telemetry: ${e}`);
        }
    }

    if (sanitizedArgs !== inputArguments) {
        const offendingChars = collectOffendingChars(
            (sanitizerTelemetry as { removedSymbols?: Record<string, number> } | null)?.removedSymbols
        );
        // PowerShell escapes with backtick; bash escapes with backslash. Pick the matching guidance.
        let message = isPowerShell ? tl.loc('ScriptArgsSanitized') : tl.loc('ScriptArgsSanitizedBash');
        if (offendingChars) {
            message = `${message} Offending characters: ${offendingChars}.`;
        }
        if (featureFlags.activate) {
            throw new ArgsSanitizingError(message);
        }
        if (featureFlags.audit) {
            tl.warning(message, IssueSource.TaskInternal, 1);
        }
    }
}

// Build a human-readable list of the disallowed characters that were removed
// during sanitization, so the error message names exactly what to fix.
// Whitespace characters (\n, \r, \t) are excluded because they typically come
// from YAML folded scalars (`arguments: >`) rather than from author intent;
// they are still counted in telemetry via removedSymbols.
function collectOffendingChars(removedSymbols: Record<string, number> | undefined): string {
    if (!removedSymbols) {
        return '';
    }
    const whitespace = new Set(['\n', '\r', '\t']);
    const chars = Object.keys(removedSymbols).filter(c => !whitespace.has(c));
    if (chars.length === 0) {
        return '';
    }
    return chars.map(c => `'${c}'`).join(', ');
}
