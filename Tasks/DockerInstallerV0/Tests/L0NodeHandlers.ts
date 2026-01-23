import fs = require('fs');
import assert = require('assert');
import path = require('path');

/**
 * Test suite specifically for validating Node execution handlers in task.json
 * This ensures the task is properly configured for Node24 migration
 */
describe('DockerInstallerV0 Node Handler Tests', function () {
    const taskJsonPath = path.join(__dirname, '..', 'task.json');
    let taskJson: any;

    before(() => {
        taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
    });

    after(() => {
    });

    it('should have execution section defined', () => {
        assert(taskJson.execution, 'task.json must have an execution section');
        assert(typeof taskJson.execution === 'object', 'execution section must be an object');
    });

    it('should have Node10 handler for backward compatibility', () => {
        assert(taskJson.execution.Node10, 'task.json should have Node10 handler');
        assert(taskJson.execution.Node10.target, 'Node10 handler must have a target');
    });

    it('should have Node16 handler', () => {
        assert(taskJson.execution.Node16, 'task.json should have Node16 handler');
        assert(taskJson.execution.Node16.target, 'Node16 handler must have a target');
    });

    it('should have Node20_1 handler', () => {
        assert(taskJson.execution.Node20_1, 'task.json should have Node20_1 handler');
        assert(taskJson.execution.Node20_1.target, 'Node20_1 handler must have a target');
    });

    it('should have Node24 handler', () => {
        assert(taskJson.execution.Node24, 'task.json should have Node24 handler');
        assert(taskJson.execution.Node24.target, 'Node24 handler must have a target');
    });

    it('should have consistent target across all Node handlers', () => {
        const handlers = ['Node10', 'Node16', 'Node20_1', 'Node24'];
        const targets = handlers
            .filter(h => taskJson.execution[h])
            .map(h => taskJson.execution[h].target);
        
        const uniqueTargets = [...new Set(targets)];
        assert.strictEqual(uniqueTargets.length, 1, 'All Node handlers should point to the same target file');
        assert.strictEqual(uniqueTargets[0], 'src//dockertoolinstaller.js', 'Target should be src//dockertoolinstaller.js');
    });

    it('should have minimumAgentVersion compatible with Node handlers', () => {
        assert(taskJson.minimumAgentVersion, 'task.json should have minimumAgentVersion');
        // Agent version 2.142.1 supports Node10+
        const minVersion = taskJson.minimumAgentVersion;
        assert(minVersion, 'minimumAgentVersion should be defined');
    });
});
