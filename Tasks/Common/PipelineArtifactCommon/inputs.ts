/** Reads task inputs and pipeline variables. Implemented with task-lib at run time and by fakes in tests. */
export interface TaskInputs {
    input(name: string, required?: boolean): string;
    boolInput(name: string): boolean;
    variable(name: string): string | undefined;
}

/**
 * What the task does once its inputs are processed: the ArtifactTool arguments and environment for the transfer,
 * errors and warnings to report (neither fails the task), variables to set before the transfer, and variables to set only when it succeeds.
 */
export interface ToolPlan {
    args: string[];
    environment: Record<string, string>;
    errors: string[];
    warnings: string[];
    variables: Record<string, string>;
    variablesOnSuccess: Record<string, string>;
}

export function emptyPlan(args: string[]): ToolPlan {
    return { args, environment: {}, errors: [], warnings: [], variables: {}, variablesOnSuccess: {} };
}
