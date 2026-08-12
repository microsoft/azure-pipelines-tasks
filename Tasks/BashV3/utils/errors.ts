// MSRC 129198: re-export the single shared sanitizer error so `instanceof` in bash.ts matches
// the exception thrown by the shared validateScriptArgs.
export { ArgsSanitizingError } from 'azure-pipelines-tasks-args-sanitizer/argsSanitizer';
