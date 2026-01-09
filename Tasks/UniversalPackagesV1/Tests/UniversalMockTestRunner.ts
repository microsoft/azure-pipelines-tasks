import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

/**
 * Extended MockTestRunner that can be extended in the future if needed.
 * Currently just wraps the base MockTestRunner functionality.
 */
export class UniversalMockTestRunner extends MockTestRunner {
    constructor(testPath: string) {
        super(testPath);
    }
}
