import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

/**
 * Extended MockTestRunner that can be extended in the future if needed.
 * Currently just wraps the base MockTestRunner functionality.
 */
export class UniversalMockTestRunner extends MockTestRunner {
    constructor(testPath: string) {
        super(testPath);
    }

    /**
     * Parses ##vso[task.setvariable] commands from stdout and returns a map of variable names to values.
     * Handles both regular variables (tl.setVariable) and task variables (tl.setTaskVariable).
     */
    getSetVariables(): Map<string, string> {
        const vars = new Map<string, string>();
        const regex = /##vso\[task\.set(?:task)?variable\s+[^\]]*variable=([^;\]]+)[^\]]*\](.*)/g;
        let match;
        while ((match = regex.exec(this.stdout)) !== null) {
            vars.set(match[1], match[2]);
        }
        return vars;
    }
}
