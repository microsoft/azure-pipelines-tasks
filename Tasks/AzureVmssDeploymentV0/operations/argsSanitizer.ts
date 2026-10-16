// Reuses the work-item-75787 argument sanitizer used by BashV3 and the
// PowerShell ArgumentsSanitizer. Three feature flags drive behavior:
//   AZP_75787_ENABLE_NEW_LOGIC      -> throw on disallowed characters
//   AZP_75787_ENABLE_NEW_LOGIC_LOG  -> warn on disallowed characters (audit)
//   AZP_75787_ENABLE_COLLECT        -> emit telemetry only
//
// The protected Windows path requires the old and new task feature gates.
// It transports arguments as data and validates their syntax on the target.
// Legacy activation/audit/telemetry behavior is retained when the fix is off.

import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
import { IssueSource } from 'azure-pipelines-task-lib/internal';

export const VmssCustomScriptArgsValidationFixEnabled = 'VmssCustomScriptArgsValidationFixEnabled';

export interface ScriptArgsPolicy {
    scriptType: string;
    isPowerShell: boolean;
    legacyValidationEnabled: boolean;
    protectedWindows: boolean;
    activate: boolean;
    audit: boolean;
    telemetry: boolean;
}

export function resolveScriptArgsPolicy(scriptType: string): ScriptArgsPolicy {
    const normalizedType = (scriptType || '').toLowerCase();
    const isPowerShell = normalizedType === 'ps' || normalizedType === 'pscore';
    const legacyValidationEnabled = tl.getPipelineFeature('EnableVmssCustomScriptArgsValidation');
    // Additive rollout: the old gate remains required; activation does not weaken protected mode.
    const protectedWindows = isPowerShell && legacyValidationEnabled
        && tl.getPipelineFeature(VmssCustomScriptArgsValidationFixEnabled);
    return {
        scriptType: normalizedType,
        isPowerShell,
        legacyValidationEnabled,
        protectedWindows,
        activate: protectedWindows || tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC'),
        audit: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC_LOG'),
        telemetry: tl.getBoolFeatureFlag('AZP_75787_ENABLE_COLLECT')
    };
}

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
    validator: (args: string, type: string, policy: ScriptArgsPolicy) => void = validateScriptArgs
): ScriptArgsPolicy {
    const policy = resolveScriptArgsPolicy(scriptType);
    if (!policy.legacyValidationEnabled) {
        return policy;
    }
    try {
        validator(inputArguments, scriptType, policy);
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
    return policy;
}

export function validateScriptArgs(
    inputArguments: string,
    scriptType: string,
    featureFlags: ScriptArgsPolicy = resolveScriptArgsPolicy(scriptType)
): void {
    const isVmssCustomScriptArgsValidationFixEnabled = featureFlags.protectedWindows;

    if (!(featureFlags.activate || featureFlags.audit || featureFlags.telemetry)) {
        return;
    }

    if (!inputArguments) {
        return;
    }

    tl.debug('Validating script args...');

    const normalizedScriptType = featureFlags.scriptType;
    const isPowerShell = featureFlags.isPowerShell;

    // No env expansion: the custom script runs on the remote VMSS VM, so expanding $env:/$VAR
    // against the agent's environment is the wrong context and only risks false-positive blocks.
    // The allowlist below still blocks separator/metacharacter injection on the literal args.
    const envTelemetry = null;

    const [sanitizedArgs, sanitizerTelemetry] = isPowerShell
        ? sanitizeArgs(inputArguments, {
            // PowerShell allowlist: word chars + \ ` _ ' " - = / : . * , + ~ ? % #
            // Constructor punctuation also requires target AST validation.
            // The hardened exception is limited to dollar-prefixed constant words.
            // CR/LF are rejected unconditionally below; the (?<!`) lookbehind can't guarantee it.
            // Execution primitives $( ) ; & | remain blocked.
            argsSplitSymbols: '``',
            saniziteRegExp: isVmssCustomScriptArgsValidationFixEnabled
                ? new RegExp("(?<!`)(\\$(?!true\\b|false\\b|null\\b)|[^\\w\\\\` _'\"\\-=\\/:\\.*,+~?%#@{}\\[\\]$])", 'ig')
                : new RegExp("(?<!`)([^\\w\\\\` _'\"\\-=\\/:\\.*,+~?%#@{}\\[\\]])(?!true|false)", 'ig')
        })
        : sanitizeArgs(inputArguments, {
            // BashV3 allowlist (also used for batch and unknown scriptType).
            argsSplitSymbols: '\\\\',
            saniziteRegExp: new RegExp("(?<!\\\\)([^a-zA-Z0-9\\\\ _'\"\\-=\\/:.*+%])", 'g')
        });

    // CR/LF must be rejected unconditionally on the PowerShell path: the allowlist's escape-aware
    // (?<!`) lookbehind would otherwise exempt a backtick-preceded newline, which survives to the
    // Invoke-Expression sink as a statement separator (WI-75787).
    const hasPsNewline = isPowerShell && /[\r\n]/.test(inputArguments);

    if (sanitizedArgs === inputArguments && !hasPsNewline) {
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

    if (sanitizedArgs !== inputArguments || hasPsNewline) {
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
