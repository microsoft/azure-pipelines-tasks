import { validateScriptArgs, expandBashEnvVariables } from 'azure-pipelines-tasks-args-sanitizer/argsSanitizer';

// Re-exported so the existing unit tests keep importing it from './helpers'.
export { expandBashEnvVariables };

// MSRC 129198 consolidation: route Bash FilePath arguments through the single shared Node sanitizer
// (bash allowlist + $VAR/${VAR} expansion). No outer pipeline-feature gate; the AZP_75787_* flags
// alone drive it, exactly as before.
export function validateFileArgs(inputArguments: string): void {
    validateScriptArgs(inputArguments, 'bash', { taskName: 'BashV3' });
}