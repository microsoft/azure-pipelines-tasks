import { validateScriptArgs, expandPowerShellEnvVariables } from 'azure-pipelines-tasks-args-sanitizer/argsSanitizer';

// Re-exported so the existing L0EnvExpansion unit test keeps importing it from './helpers'.
export { expandPowerShellEnvVariables };

// MSRC 129198: route FilePath script arguments through the single shared Node sanitizer.
// PowerShellV2 keeps its stricter allowlist (no @ { } [ ] data constructors) via
// allowDataConstructors:false and has no outer pipeline-feature gate, so the AZP_75787_* flags
// alone drive it - as before, plus the unconditional CR/LF reject the shared sanitizer adds.
export function validateFileArgs(inputArguments: string): void {
    validateScriptArgs(inputArguments, 'ps', { taskName: 'PowerShellV2', allowDataConstructors: false });
}