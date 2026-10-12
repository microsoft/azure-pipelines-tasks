"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalMockTestRunner = void 0;
const mock_test_1 = require("azure-pipelines-task-lib/mock-test");
/**
 * Extended MockTestRunner that can be extended in the future if needed.
 * Currently just wraps the base MockTestRunner functionality.
 */
class UniversalMockTestRunner extends mock_test_1.MockTestRunner {
    constructor(testPath) {
        super(testPath);
    }
    /**
     * Parses ##vso[task.setvariable] commands from stdout and returns a map of variable names to values.
     * Handles both regular variables (tl.setVariable) and task variables (tl.setTaskVariable).
     */
    getSetVariables() {
        const vars = new Map();
        const regex = /##vso\[task\.set(?:task)?variable\s+[^\]]*variable=([^;\]]+)[^\]]*\](.*)/g;
        let match;
        while ((match = regex.exec(this.stdout)) !== null) {
            vars.set(match[1], match[2]);
        }
        return vars;
    }
}
exports.UniversalMockTestRunner = UniversalMockTestRunner;
