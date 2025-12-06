import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import * as cmdm from 'azure-pipelines-task-lib/taskcommand';

/**
 * Extended MockTestRunner that parses and exposes task.setvariable commands,
 * specifically capturing the authentication token used during test execution.
 */
export class UniversalMockTestRunner extends MockTestRunner {
    public usedToken: string | undefined;
    private variables: { [key: string]: string } = {};

    constructor(testPath: string) {
        super(testPath);
    }

    /**
     * Override runAsync to parse task.setvariable commands in addition to base behavior
     */
    public async runAsync(nodeVersion?: number): Promise<void> {
        // Call parent implementation
        await super.runAsync(nodeVersion);

        // Parse stdout for task.setvariable commands
        const lines: string[] = this.stdout.replace(/\r\n/g, '\n').split('\n');
        lines.forEach((line: string) => {
            const ci = line.indexOf('##vso[');
            if (ci >= 0) {
                const cmd = cmdm.commandFromString(line.substring(ci));
                if (cmd.command === 'task.setvariable') {
                    const varName = cmd.properties['variable'];
                    const varValue = cmd.message;
                    if (varName) {
                        this.variables[varName] = varValue;
                        
                        // Specifically capture the auth token
                        if (varName === 'CAPTURED_AUTH_TOKEN') {
                            this.usedToken = varValue;
                        }
                    }
                }
            }
        });
    }

    /**
     * Gets a variable that was set via task.setvariable during test execution
     */
    public getVariable(name: string): string | undefined {
        return this.variables[name];
    }
}
